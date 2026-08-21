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
  /** Return script metadata without paragraph prose bodies. */
  scriptsOnly?: boolean
  /** For a scene script read, include every scene preceding it in story order. */
  includePreceding?: boolean
}

export interface ContentParagraph {
  id: string
  messageRevisionId: string
  sortOrder: number
  currentParagraphRevisionId: string | null
  body: string
  contentSchema: string | null
  state: string | null
  plotPointActions: unknown[]
  inventoryActions: unknown[]
  script: string | null
  words: number
}

export interface ContentMessage {
  id: string
  sortOrder: number
  instruction: string | null
  script: string | null
  currentMessageRevisionId: string | null
  createdAt: string
  /** null for normal prose; 'branch' | 'event' | 'background' | 'audio' etc. */
  type: string | null
  isQuery: boolean
  options: unknown
  backgroundFileId: string | null
  backgroundFile: { id: string; path: string } | null
  audioFileId: string | null
  audioFile: { id: string; path: string } | null
  revision: {
    id: string
    model: string | null
    tokensPerSecond: number | null
    totalTokens: number | null
    promptTokens: number | null
    cacheCreationTokens: number | null
    cacheReadTokens: number | null
    think: string | null
    showThink: boolean
  } | null
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

  let sceneWhere: Record<string, unknown>
  if (options.includePreceding) {
    if (node.kind !== 'scene' || !options.scriptsOnly) {
      throw badRequest('includePreceding is only supported for scriptsOnly reads rooted at a scene.')
    }
    const target = await prisma.scene.findUniqueOrThrow({
      where: { id: node.id },
      select: {
        sortOrder: true,
        chapterId: true,
        chapter: {
          select: {
            sortOrder: true,
            arcId: true,
            arc: { select: { sortOrder: true, bookId: true, book: { select: { sortOrder: true } } } },
          },
        },
      },
    })
    sceneWhere = {
      deleted: false,
      chapter: { arc: { book: { storyId: node.storyId } } },
      OR: [
        { chapter: { arc: { book: { sortOrder: { lt: target.chapter.arc.book.sortOrder } } } } },
        {
          chapter: {
            arc: { bookId: target.chapter.arc.bookId, sortOrder: { lt: target.chapter.arc.sortOrder } },
          },
        },
        { chapter: { arcId: target.chapter.arcId, sortOrder: { lt: target.chapter.sortOrder } } },
        { chapterId: target.chapterId, sortOrder: { lt: target.sortOrder } },
      ],
    }
  } else {
    sceneWhere =
      node.kind === 'scene'
        ? { id: node.id, deleted: false }
        : { deleted: false, chapter: { ...chapterFilter, deleted: false } }
  }

  const scenes = await prisma.scene.findMany({
    where: sceneWhere,
    orderBy: [
      { chapter: { arc: { book: { sortOrder: 'asc' } } } },
      { chapter: { arc: { sortOrder: 'asc' } } },
      { chapter: { sortOrder: 'asc' } },
      { sortOrder: 'asc' },
    ],
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
          sortOrder: true,
          instruction: true,
          script: true,
          currentMessageRevisionId: true,
          createdAt: true,
          type: true,
          isQuery: true,
          options: true,
          backgroundFileId: true,
          backgroundFile: { select: { id: true, path: true } },
          audioFileId: true,
          audioFile: { select: { id: true, path: true } },
          currentMessageRevision: {
            select: {
              id: true,
              model: true,
              tokensPerSecond: true,
              totalTokens: true,
              promptTokens: true,
              cacheCreationTokens: true,
              cacheReadTokens: true,
              think: true,
              showThink: true,
              paragraphs: {
                orderBy: { sortOrder: 'asc' },
                select: {
                  id: true,
                  messageRevisionId: true,
                  sortOrder: true,
                  currentParagraphRevisionId: true,
                  currentParagraphRevision: {
                    select: {
                      body: true,
                      contentSchema: true,
                      state: true,
                      plotPointActions: true,
                      inventoryActions: true,
                      script: true,
                    },
                  },
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
        const storedBody = paragraph.currentParagraphRevision?.body
        if (storedBody === undefined || storedBody === null) continue
        const body = options.scriptsOnly ? '' : storedBody
        const words = options.scriptsOnly ? 0 : countWordsInHtml(body)
        sceneWords += words
        paragraphs.push({
          id: paragraph.id,
          messageRevisionId: paragraph.messageRevisionId,
          sortOrder: paragraph.sortOrder,
          currentParagraphRevisionId: paragraph.currentParagraphRevisionId,
          body,
          contentSchema: paragraph.currentParagraphRevision?.contentSchema ?? null,
          state: paragraph.currentParagraphRevision?.state ?? null,
          plotPointActions: (paragraph.currentParagraphRevision?.plotPointActions as unknown[]) ?? [],
          inventoryActions: (paragraph.currentParagraphRevision?.inventoryActions as unknown[]) ?? [],
          script: paragraph.currentParagraphRevision?.script ?? null,
          words,
        })
      }

      // Skip empty normal messages entirely; keep structural ones even when
      // they carry no prose, because they change how the scene reads. Script-only
      // reads also retain message shells so message scripts execute in order.
      const structural = message.type !== null || message.isQuery
      if (paragraphs.length === 0 && !structural && !options.scriptsOnly) continue

      messages.push({
        id: message.id,
        sortOrder: message.sortOrder,
        instruction: message.instruction,
        script: message.script,
        currentMessageRevisionId: message.currentMessageRevisionId,
        createdAt: message.createdAt.toISOString(),
        type: message.type,
        isQuery: message.isQuery,
        options: message.options,
        backgroundFileId: message.backgroundFileId,
        backgroundFile: message.backgroundFile,
        audioFileId: message.audioFileId,
        audioFile: message.audioFile,
        revision: message.currentMessageRevision
          ? {
              id: message.currentMessageRevision.id,
              model: message.currentMessageRevision.model,
              tokensPerSecond: message.currentMessageRevision.tokensPerSecond,
              totalTokens: message.currentMessageRevision.totalTokens,
              promptTokens: message.currentMessageRevision.promptTokens,
              cacheCreationTokens: message.currentMessageRevision.cacheCreationTokens,
              cacheReadTokens: message.currentMessageRevision.cacheReadTokens,
              think: message.currentMessageRevision.think,
              showThink: message.currentMessageRevision.showThink,
            }
          : null,
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
