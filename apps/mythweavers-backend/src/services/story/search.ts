/**
 * Story-wide text search.
 *
 * There was no text search of any kind before this — the existing `contains`
 * queries only ever touch story names and tags. `ParagraphEmbedding` exists in
 * the schema but nothing writes it and there is no vector index, so semantic
 * search would be a full table scan over a dead table.
 *
 * This is deliberately plain: case-insensitive substring matching (ILIKE) over
 * current paragraph revisions, character fields, context items and node
 * summaries. It answers "where did I mention the amulet", which is the actual
 * question, without a migration or an embedding pipeline.
 */

import { countWordsInHtml } from '../../lib/chapterWordCount.js'
import { prisma } from '../../lib/prisma.js'
import { badRequest } from './errors.js'
import { requireStory } from './resolve.js'

export type SearchScope = 'prose' | 'characters' | 'context' | 'summaries' | 'all'

export const SEARCH_SCOPES: SearchScope[] = ['prose', 'characters', 'context', 'summaries', 'all']

export interface SearchOptions {
  scope?: SearchScope
  /** Max hits per scope. */
  limit?: number
  /** Characters of surrounding text to include either side of a prose match. */
  contextChars?: number
}

export interface ProseHit {
  kind: 'prose'
  paragraphId: string
  messageId: string
  sceneId: string
  sceneName: string
  chapterId: string
  chapterName: string
  snippet: string
}

export interface CharacterHit {
  kind: 'character'
  id: string
  name: string
  field: string
  snippet: string
}

export interface ContextItemHit {
  kind: 'contextItem'
  id: string
  name: string
  type: string
  field: string
  snippet: string
}

export interface SummaryHit {
  kind: 'summary'
  nodeKind: 'book' | 'arc' | 'chapter' | 'scene'
  id: string
  name: string
  field: string
  snippet: string
}

export type SearchHit = ProseHit | CharacterHit | ContextItemHit | SummaryHit

export interface SearchResult {
  storyId: string
  query: string
  scope: SearchScope
  truncated: boolean
  hits: SearchHit[]
}

const DEFAULT_LIMIT = 40
const DEFAULT_CONTEXT_CHARS = 90

/** Character fields worth searching, in the order they're reported. */
const CHARACTER_FIELDS = [
  'firstName',
  'middleName',
  'lastName',
  'nickname',
  'description',
  'background',
  'personality',
  'personalityQuirks',
  'likes',
  'dislikes',
  'distinguishingFeatures',
  'writingStyle',
] as const

const SUMMARY_FIELDS = ['summary', 'sentenceSummary', 'paragraphSummary'] as const

export async function searchStory(
  userId: number,
  storyId: string,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const trimmed = query.trim()
  if (trimmed.length < 2) {
    throw badRequest('Search query must be at least 2 characters.')
  }

  await requireStory(userId, storyId)

  const scope = options.scope ?? 'all'
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), 200)
  const contextChars = options.contextChars ?? DEFAULT_CONTEXT_CHARS
  const insensitive = { contains: trimmed, mode: 'insensitive' as const }

  const wants = (target: SearchScope) => scope === 'all' || scope === target

  const [prose, characters, contextItems, summaries] = await Promise.all([
    wants('prose') ? searchProse(storyId, insensitive, limit, contextChars, trimmed) : Promise.resolve([]),
    wants('characters') ? searchCharacters(storyId, trimmed, limit, contextChars) : Promise.resolve([]),
    wants('context') ? searchContextItems(storyId, insensitive, limit, contextChars, trimmed) : Promise.resolve([]),
    wants('summaries') ? searchSummaries(storyId, trimmed, limit, contextChars) : Promise.resolve([]),
  ])

  const hits: SearchHit[] = [...prose, ...characters, ...contextItems, ...summaries]
  const truncated =
    prose.length >= limit || characters.length >= limit || contextItems.length >= limit || summaries.length >= limit

  return { storyId, query: trimmed, scope, truncated, hits }
}

async function searchProse(
  storyId: string,
  insensitive: { contains: string; mode: 'insensitive' },
  limit: number,
  contextChars: number,
  needle: string,
): Promise<ProseHit[]> {
  // Only the *current* revision of each paragraph, and only paragraphs hanging
  // off the current revision of a live message — otherwise every historical
  // edit shows up as its own hit.
  const paragraphs = await prisma.paragraph.findMany({
    where: {
      currentParagraphRevision: { body: insensitive },
      messageRevision: {
        currentRevisionFor: {
          some: {
            deleted: false,
            scene: {
              deleted: false,
              chapter: { deleted: false, arc: { deleted: false, book: { deleted: false, storyId } } },
            },
          },
        },
      },
    },
    take: limit,
    select: {
      id: true,
      currentParagraphRevision: { select: { body: true } },
      messageRevision: {
        select: {
          currentRevisionFor: {
            where: { deleted: false },
            take: 1,
            select: {
              id: true,
              scene: {
                select: {
                  id: true,
                  name: true,
                  chapter: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  const hits: ProseHit[] = []
  for (const paragraph of paragraphs) {
    const message = paragraph.messageRevision.currentRevisionFor[0]
    if (!message) continue
    hits.push({
      kind: 'prose',
      paragraphId: paragraph.id,
      messageId: message.id,
      sceneId: message.scene.id,
      sceneName: message.scene.name,
      chapterId: message.scene.chapter.id,
      chapterName: message.scene.chapter.name,
      snippet: excerpt(paragraph.currentParagraphRevision?.body ?? '', needle, contextChars),
    })
  }
  return hits
}

async function searchCharacters(
  storyId: string,
  needle: string,
  limit: number,
  contextChars: number,
): Promise<CharacterHit[]> {
  const characters = await prisma.character.findMany({
    where: {
      storyId,
      OR: CHARACTER_FIELDS.map((field) => ({ [field]: { contains: needle, mode: 'insensitive' as const } })),
    },
    take: limit,
  })

  return characters.map((character) => {
    const record = character as unknown as Record<string, string | null>
    const field = CHARACTER_FIELDS.find((candidate) => matches(record[candidate], needle)) ?? 'description'
    return {
      kind: 'character' as const,
      id: character.id,
      name: [character.firstName, character.lastName].filter(Boolean).join(' ') || character.firstName,
      field,
      snippet: excerpt(record[field] ?? '', needle, contextChars),
    }
  })
}

async function searchContextItems(
  storyId: string,
  insensitive: { contains: string; mode: 'insensitive' },
  limit: number,
  contextChars: number,
  needle: string,
): Promise<ContextItemHit[]> {
  const items = await prisma.contextItem.findMany({
    where: { storyId, OR: [{ name: insensitive }, { description: insensitive }] },
    take: limit,
  })

  return items.map((item) => {
    const field = matches(item.name, needle) ? 'name' : 'description'
    return {
      kind: 'contextItem' as const,
      id: item.id,
      name: item.name,
      type: item.type,
      field,
      snippet: excerpt(field === 'name' ? item.name : item.description, needle, contextChars),
    }
  })
}

async function searchSummaries(
  storyId: string,
  needle: string,
  limit: number,
  contextChars: number,
): Promise<SummaryHit[]> {
  const or = SUMMARY_FIELDS.map((field) => ({ [field]: { contains: needle, mode: 'insensitive' as const } }))

  const [books, arcs, chapters, scenes] = await Promise.all([
    prisma.book.findMany({ where: { storyId, deleted: false, OR: or }, take: limit }),
    prisma.arc.findMany({ where: { book: { storyId }, deleted: false, OR: or }, take: limit }),
    prisma.chapter.findMany({ where: { arc: { book: { storyId } }, deleted: false, OR: or }, take: limit }),
    prisma.scene.findMany({
      where: { chapter: { arc: { book: { storyId } } }, deleted: false, OR: or },
      take: limit,
    }),
  ])

  const build = (nodeKind: SummaryHit['nodeKind']) => (row: { id: string; name: string }) => {
    const record = row as unknown as Record<string, string | null>
    const field = SUMMARY_FIELDS.find((candidate) => matches(record[candidate], needle)) ?? 'summary'
    return {
      kind: 'summary' as const,
      nodeKind,
      id: row.id,
      name: row.name,
      field,
      snippet: excerpt(record[field] ?? '', needle, contextChars),
    }
  }

  return [
    ...books.map(build('book')),
    ...arcs.map(build('arc')),
    ...chapters.map(build('chapter')),
    ...scenes.map(build('scene')),
  ].slice(0, limit)
}

function matches(value: string | null | undefined, needle: string): boolean {
  return typeof value === 'string' && value.toLowerCase().includes(needle.toLowerCase())
}

/**
 * Pull the matching span out of a longer body with a little context either
 * side. Tags are stripped first so a match inside markup doesn't produce a
 * snippet full of angle brackets.
 */
function excerpt(source: string, needle: string, contextChars: number): string {
  const text = source
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const index = text.toLowerCase().indexOf(needle.toLowerCase())
  if (index === -1) {
    return text.length > contextChars * 2 ? `${text.slice(0, contextChars * 2)}…` : text
  }

  const start = Math.max(0, index - contextChars)
  const end = Math.min(text.length, index + needle.length + contextChars)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

/** Exposed for tests and for callers that want to size a result set. */
export { countWordsInHtml }
