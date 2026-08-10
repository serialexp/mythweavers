/**
 * Prose reads.
 *
 * Reading a chapter through the existing endpoints costs 1 + scenes + messages
 * requests (scene list, then messages per scene, then paragraphs per message
 * revision). This does it in one query and returns paragraphs with their ids
 * attached, so a caller can turn around and edit them without a second lookup.
 *
 * Paragraph bodies are stored as the editor serializes them — mostly plain
 * text, sometimes with inline HTML (`<em>`, `<strong>`). They are passed
 * through verbatim in both directions rather than converted to Markdown; a
 * lossy round-trip through another format would quietly mangle formatting on
 * every agent edit.
 */

import { countWordsInHtml } from '../../lib/chapterWordCount.js'
import { prisma } from '../../lib/prisma.js'
import { badRequest } from './errors.js'
import { type ResolvedNode, requireNode } from './resolve.js'

/** Default ceiling on a single read, in words. */
export const DEFAULT_MAX_WORDS = 6000

export interface ReadContentOptions {
  /**
   * Refuse the read (with a breakdown) rather than returning more than this
   * many words. Guards against a single call swallowing a whole novel.
   */
  maxWords?: number
  /**
   * Include message-level grouping for every message. By default only
   * structurally significant messages (branch/event/background/audio) are
   * surfaced, since normal messages are just generation units and add noise.
   */
  includeAllMessages?: boolean
}

export interface ContentParagraph {
  id: string
  body: string
  state: string | null
  words: number
}

export interface ContentMessage {
  id: string
  /** null for normal prose; 'branch' | 'event' | 'background' | 'audio' etc. */
  type: string | null
  isQuery: boolean
  options: unknown
  paragraphs: ContentParagraph[]
}

export interface ContentScene {
  id: string
  name: string
  status: string | null
  perspective: string | null
  viewpointCharacterId: string | null
  viewpointCharacterName: string | null
  goal: string | null
  includeInFull: number
  words: number
  messages: ContentMessage[]
}

export interface ContentChapter {
  id: string
  name: string
  status: string | null
  words: number
  scenes: ContentScene[]
}

export interface StoryContent {
  storyId: string
  root: { kind: string; id: string; name: string }
  words: number
  chapters: ContentChapter[]
}

/**
 * Thrown instead of returning content when the requested subtree is larger
 * than `maxWords`. Carries the breakdown so the caller can pick a smaller
 * target without another round trip.
 */
export interface TooLargeBreakdown {
  requestedWords: number
  maxWords: number
  chapters: Array<{ id: string; name: string; words: number }>
}

export class ContentTooLargeError extends Error {
  /** Read by Fastify's error handler; see StoryServiceError. */
  readonly statusCode = 413
  readonly breakdown: TooLargeBreakdown

  constructor(breakdown: TooLargeBreakdown) {
    const list = breakdown.chapters
      .map((chapter) => `  ${chapter.id}  ${chapter.words.toLocaleString()}w  ${chapter.name}`)
      .join('\n')
    super(
      `That subtree is ${breakdown.requestedWords.toLocaleString()} words, over the ${breakdown.maxWords.toLocaleString()}-word limit for one read. ` +
        `Read a smaller node, or raise maxWords if you really want it all.\n\nChapters:\n${list}`,
    )
    this.name = 'ContentTooLargeError'
    this.breakdown = breakdown
  }
}

/**
 * Read the prose under a node. Accepts a chapter or scene directly; books and
 * arcs work too, subject to the word budget.
 */
export async function readContent(
  userId: number,
  nodeId: string,
  options: ReadContentOptions = {},
): Promise<StoryContent> {
  const maxWords = options.maxWords ?? DEFAULT_MAX_WORDS
  const node = await requireNode(userId, nodeId)

  if (node.kind === 'story') {
    throw badRequest(
      'Reading a whole story at once is not supported — it would be hundreds of thousands of words. ' +
        'Use the outline to pick a book, arc, chapter or scene.',
    )
  }

  // Cheap pre-check: chapters carry a cached wordCount, so the size of any
  // subtree is known without touching a single paragraph body.
  const chapterFilter = chapterFilterFor(node)
  const candidateChapters = await prisma.chapter.findMany({
    where: { ...chapterFilter, deleted: false },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, wordCount: true },
  })

  const estimate = candidateChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0)
  // A single scene is always a fraction of its chapter, so skip the guard
  // there — the cached count belongs to the whole chapter and would be wrong.
  if (node.kind !== 'scene' && estimate > maxWords) {
    throw new ContentTooLargeError({
      requestedWords: estimate,
      maxWords,
      chapters: candidateChapters.map((chapter) => ({
        id: chapter.id,
        name: chapter.name,
        words: chapter.wordCount,
      })),
    })
  }

  const sceneWhere: Record<string, unknown> =
    node.kind === 'scene'
      ? { id: node.id, deleted: false }
      : { deleted: false, chapter: { ...chapterFilter, deleted: false } }

  const scenes = await prisma.scene.findMany({
    where: sceneWhere,
    orderBy: [{ chapter: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    select: {
      id: true,
      name: true,
      status: true,
      perspective: true,
      viewpointCharacterId: true,
      goal: true,
      includeInFull: true,
      chapterId: true,
      chapter: { select: { id: true, name: true, status: true, sortOrder: true, wordCount: true } },
      messages: {
        where: { deleted: false },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          type: true,
          isQuery: true,
          options: true,
          currentMessageRevision: {
            select: {
              paragraphs: {
                orderBy: { sortOrder: 'asc' },
                select: {
                  id: true,
                  currentParagraphRevision: { select: { body: true, state: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  // POV character names make the output readable without a second lookup.
  const viewpointIds = [...new Set(scenes.map((s) => s.viewpointCharacterId).filter(Boolean))] as string[]
  const characters = viewpointIds.length
    ? await prisma.character.findMany({
        where: { id: { in: viewpointIds } },
        select: { id: true, firstName: true, lastName: true, nickname: true },
      })
    : []
  const characterNames = new Map(
    characters.map((c) => [c.id, [c.firstName, c.lastName].filter(Boolean).join(' ') || c.nickname || c.id]),
  )

  const chaptersById = new Map<string, ContentChapter>()
  let totalWords = 0

  for (const scene of scenes) {
    const messages: ContentMessage[] = []
    let sceneWords = 0

    for (const message of scene.messages) {
      const paragraphs: ContentParagraph[] = []
      for (const paragraph of message.currentMessageRevision?.paragraphs ?? []) {
        const body = paragraph.currentParagraphRevision?.body
        if (body === undefined || body === null) continue
        const words = countWordsInHtml(body)
        sceneWords += words
        paragraphs.push({
          id: paragraph.id,
          body,
          state: paragraph.currentParagraphRevision?.state ?? null,
          words,
        })
      }

      // Skip empty normal messages entirely; keep structural ones even when
      // they carry no prose, because they change how the scene reads.
      const structural = message.type !== null || message.isQuery
      if (paragraphs.length === 0 && !structural) continue

      messages.push({
        id: message.id,
        type: message.type,
        isQuery: message.isQuery,
        options: message.options,
        paragraphs,
      })
    }

    totalWords += sceneWords

    let chapter = chaptersById.get(scene.chapterId)
    if (!chapter) {
      chapter = {
        id: scene.chapter.id,
        name: scene.chapter.name,
        status: scene.chapter.status,
        words: 0,
        scenes: [],
      }
      chaptersById.set(scene.chapterId, chapter)
    }

    chapter.words += sceneWords
    chapter.scenes.push({
      id: scene.id,
      name: scene.name,
      status: scene.status,
      perspective: scene.perspective,
      viewpointCharacterId: scene.viewpointCharacterId,
      viewpointCharacterName: scene.viewpointCharacterId
        ? (characterNames.get(scene.viewpointCharacterId) ?? null)
        : null,
      goal: scene.goal,
      includeInFull: scene.includeInFull,
      words: sceneWords,
      messages,
    })
  }

  // A scene read skips the cached pre-check, so enforce the budget on the
  // measured total instead.
  if (node.kind === 'scene' && totalWords > maxWords) {
    throw new ContentTooLargeError({
      requestedWords: totalWords,
      maxWords,
      chapters: [...chaptersById.values()].map((c) => ({ id: c.id, name: c.name, words: c.words })),
    })
  }

  return {
    storyId: node.storyId,
    root: { kind: node.kind, id: node.id, name: node.name },
    words: totalWords,
    chapters: [...chaptersById.values()],
  }
}

/** Prisma `where` on Chapter selecting everything under the given node. */
function chapterFilterFor(node: ResolvedNode): Record<string, unknown> {
  switch (node.kind) {
    case 'book':
      return { arc: { bookId: node.id } }
    case 'arc':
      return { arcId: node.id }
    case 'chapter':
      return { id: node.id }
    case 'scene':
      return { id: node.ancestors.chapterId }
    default:
      return { arc: { book: { storyId: node.storyId } } }
  }
}
