import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { errorSchema, paginationSchema } from '../../schemas/common.js'
import {
  formatPublicStory,
  publicStorySchema,
  storyStatusSchema,
  storyTypeSchema,
  storyVisibleWhere,
} from '../../schemas/story.js'

// List query parameters
const listPublicStoriesQuerySchema = z.strictObject({
  page: z.coerce.number().int().positive().default(1).meta({
    description: 'Page number',
    example: 1,
  }),
  pageSize: z.coerce.number().int().positive().max(100).default(20).meta({
    description: 'Items per page (max 100)',
    example: 20,
  }),
  search: z.string().optional().meta({
    description: 'Search query (searches name and summary)',
    example: 'dragon',
  }),
  status: storyStatusSchema.optional().meta({
    description: 'Filter by story status',
  }),
  type: storyTypeSchema.optional().meta({
    description: 'Filter by story type',
  }),
  sortBy: z.enum(['recent', 'popular', 'title', 'random']).default('recent').meta({
    description: 'Sort order (random returns shuffled results)',
    example: 'recent',
  }),
})

// Path parameters
const storyIdParamSchema = z.strictObject({
  id: z.string().meta({
    description: 'Story ID',
    example: 'clx1234567890',
  }),
})

// Response schemas
const listPublicStoriesResponseSchema = z.strictObject({
  stories: z.array(publicStorySchema),
  pagination: paginationSchema,
})

const getPublicStoryResponseSchema = z.strictObject({
  story: publicStorySchema,
})

// ---- Visibility filter helpers ----
// `storyVisibleWhere` is shared via schemas/story.ts — duplicate kept here for
// chapter visibility, which has stricter rules (deleted: false plus parent
// story visibility).
function chapterVisibleWhere(now: Date) {
  return { deleted: false, publishedAt: { not: null, lte: now } } as const
}

// ---- ETag / conditional response helper ----
// Builds a weak ETag from a list of timestamps plus a stable identifier.
// Returns 304 (without body) when the client's If-None-Match matches.
function buildETag(id: string, timestamps: Array<Date | null | undefined>): string {
  const max = timestamps
    .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()))
    .reduce((acc, d) => (d.getTime() > acc ? d.getTime() : acc), 0)
  return `W/"${id}-${max}"`
}

function setCacheHeaders(reply: any, etag: string, lastModified?: Date | null) {
  reply.header('ETag', etag)
  if (lastModified) {
    reply.header('Last-Modified', lastModified.toUTCString())
  }
  // Reader content is semi-dynamic; allow short shared caching but require
  // revalidation so publishedAt scheduling / updates aren't stuck in caches.
  reply.header('Cache-Control', 'public, max-age=0, must-revalidate')
}

// Chapter schema for public view
const publicChapterSchema = z.strictObject({
  id: z.string().meta({
    description: 'Chapter ID',
    example: 'clx1234567890',
  }),
  name: z.string().meta({
    description: 'Chapter name',
    example: 'Chapter 1: The Beginning',
  }),
  sortOrder: z.number().meta({
    description: 'Sort order within arc',
    example: 1,
  }),
  summary: z.string().nullable().meta({
    description: 'Chapter summary',
    example: 'Our hero sets out on their journey',
  }),
  publishedAt: z.string().meta({
    description: 'When this chapter became publicly visible (ISO-8601). Always set for public responses.',
    example: '2025-12-05T12:00:00.000Z',
  }),
  wordCount: z.number().int().meta({
    description: 'Cached total word count for this chapter',
    example: 2500,
  }),
})

// Arc schema for public view
const publicArcSchema = z.strictObject({
  id: z.string().meta({
    description: 'Arc ID',
    example: 'clx1234567890',
  }),
  name: z.string().meta({
    description: 'Arc name',
    example: 'Part 1',
  }),
  sortOrder: z.number().meta({
    description: 'Sort order within book',
    example: 1,
  }),
  chapters: z.array(publicChapterSchema),
})

// Book schema for public view
const publicBookSchema = z.strictObject({
  id: z.string().meta({
    description: 'Book ID',
    example: 'clx1234567890',
  }),
  name: z.string().meta({
    description: 'Book name',
    example: 'Volume 1',
  }),
  sortOrder: z.number().meta({
    description: 'Sort order within story',
    example: 1,
  }),
  arcs: z.array(publicArcSchema),
})

// Story with structure schema
const publicStoryWithStructureSchema = publicStorySchema.extend({
  books: z.array(publicBookSchema),
})

const getPublicStoryWithStructureResponseSchema = z.strictObject({
  story: publicStoryWithStructureSchema,
})

// Chapter content schema — structured into scenes and per-scene blocks so the
// reader can intersperse `paragraphs` runs with `background` markers driving
// the crossfading background image. Adjacent paragraph-bearing messages are
// collapsed into a single paragraphs block; a background message breaks the
// run and emits its own block.
const paragraphsBlockSchema = z.strictObject({
  type: z.literal('paragraphs'),
  html: z.string().meta({
    description: 'HTML for this run of contiguous paragraphs',
    example: '<p>Once upon a time...</p><p>...the rain came down.</p>',
  }),
})
const backgroundBlockSchema = z.strictObject({
  type: z.literal('background'),
  url: z.string().meta({
    description: 'Relative URL of the background image (resolve against the backend origin)',
    example: '/files/1/2025/12/storm.jpg',
  }),
  fileId: z.string().meta({
    description: 'File ID of the background image',
    example: 'clx1234567890',
  }),
})
// Inline audio embed. Reader renders an <audio controls> element; playback is
// reader-initiated, never autoplay, so unlike `background` there is no
// carry-forward / scroll-trigger semantics.
const audioBlockSchema = z.strictObject({
  type: z.literal('audio'),
  url: z.string().meta({
    description: 'Relative URL of the audio file (resolve against the backend origin)',
    example: '/files/1/2025/12/song.mp3',
  }),
  fileId: z.string().meta({
    description: 'File ID of the audio embed',
    example: 'clx1234567890',
  }),
  mimeType: z.string().meta({
    description: 'Audio mime type so the reader can pass it to <audio type="…">',
    example: 'audio/mpeg',
  }),
})
const chapterBlockSchema = z.union([paragraphsBlockSchema, backgroundBlockSchema, audioBlockSchema])

const chapterSceneSchema = z.strictObject({
  id: z.string().meta({ description: 'Scene ID', example: 'clx1234567890' }),
  blocks: z.array(chapterBlockSchema),
})

const chapterContentSchema = z.strictObject({
  id: z.string().meta({
    description: 'Chapter ID',
    example: 'clx1234567890',
  }),
  name: z.string().meta({
    description: 'Chapter name',
    example: 'Chapter 1: The Beginning',
  }),
  enteringBackgroundUrl: z.string().nullable().meta({
    description:
      'Background image URL active at the start of this chapter, carried in from the most recent prior `background` message in earlier chapters of the same story. Null when no prior background has been set.',
    example: '/files/1/2025/12/dawn.jpg',
  }),
  scenes: z.array(chapterSceneSchema).meta({
    description: 'Ordered scenes, each containing an ordered list of paragraph/background blocks',
  }),
  publishedAt: z.string().meta({
    description: 'When this chapter became publicly visible (ISO-8601).',
    example: '2025-12-05T12:00:00.000Z',
  }),
  previousChapterId: z.string().nullable().meta({
    description: 'ID of the previous visible chapter',
    example: 'clx1234567889',
  }),
  nextChapterId: z.string().nullable().meta({
    description: 'ID of the next visible chapter',
    example: 'clx1234567891',
  }),
})

const getChapterContentResponseSchema = z.strictObject({
  chapter: chapterContentSchema,
})

const chapterIdParamSchema = z.strictObject({
  id: z.string().meta({
    description: 'Story ID',
    example: 'clx1234567890',
  }),
  chapterId: z.string().meta({
    description: 'Chapter ID',
    example: 'clx1234567890',
  }),
})

// Helper to format story with structure for public response
function formatPublicStoryWithStructure(story: any) {
  return {
    ...formatPublicStory(story),
    books: story.books
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
      .map((book: any) => ({
        id: book.id,
        name: book.name,
        sortOrder: book.sortOrder,
        arcs: book.arcs
          .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
          .map((arc: any) => ({
            id: arc.id,
            name: arc.name,
            sortOrder: arc.sortOrder,
            chapters: arc.chapters
              .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
              .map((chapter: any) => ({
                id: chapter.id,
                name: chapter.name,
                sortOrder: chapter.sortOrder,
                summary: chapter.summary,
                publishedAt: chapter.publishedAt.toISOString(),
                wordCount: chapter.wordCount ?? 0,
              })),
          })),
      })),
  }
}

// Block + scene types matching the public response schema.
type ParagraphsBlock = { type: 'paragraphs'; html: string }
type BackgroundBlock = { type: 'background'; url: string; fileId: string }
type AudioBlock = { type: 'audio'; url: string; fileId: string; mimeType: string }
type ChapterBlock = ParagraphsBlock | BackgroundBlock | AudioBlock
type ChapterScene = { id: string; blocks: ChapterBlock[] }

/**
 * Build the structured per-scene block list for a chapter.
 *
 * Two sources can emit `background` blocks:
 *
 *   1. **Scene-level default**: if a scene has its own explicit
 *      `defaultBackgroundFileId`, we emit a block at the very start of that
 *      scene so the reader switches to it as soon as scene content scrolls
 *      into view. This is the firing rule: only nodes that *explicitly* set
 *      a default fire — inheritance never does. So a scene with a null
 *      `defaultBackgroundFileId` emits nothing at its boundary, and any
 *      previously-active background (whether an inline override or a
 *      higher-level default) persists into it.
 *
 *   2. **Inline `type: 'background'` messages**: act as mid-scene overrides.
 *      They flush the running paragraphs buffer and emit their own block.
 *      Because nothing fires at the next scene boundary unless that scene
 *      sets its own default, an inline override naturally persists across
 *      scene boundaries until something explicit overrides it.
 *
 * The chapter-level firing (chapter has its own explicit default) is folded
 * into `enteringBackgroundUrl` by the caller, so we don't emit anything
 * extra at the chapter's first scene for it.
 *
 * Other non-paragraph message types (`event`, `branch`, `chapter`) are
 * skipped, same as the legacy flat extractor.
 */
function buildChapterScenes(chapter: any): ChapterScene[] {
  const scenes = (chapter.scenes || []).sort((a: any, b: any) => a.sortOrder - b.sortOrder)
  return scenes.map((scene: any): ChapterScene => {
    const blocks: ChapterBlock[] = []
    let paragraphsBuffer: string[] = []
    const flushParagraphs = () => {
      if (paragraphsBuffer.length > 0) {
        blocks.push({ type: 'paragraphs', html: paragraphsBuffer.join('\n') })
        paragraphsBuffer = []
      }
    }

    // Scene-level firing: emit a background change at the scene's start if
    // the scene has its own explicit default (and the file still exists —
    // FK is SetNull on file delete).
    const sceneDefault = scene.defaultBackgroundFile
    if (scene.defaultBackgroundFileId && sceneDefault?.path && sceneDefault.id) {
      blocks.push({ type: 'background', url: sceneDefault.path, fileId: sceneDefault.id })
    }

    const messages = (scene.messages || []).sort((a: any, b: any) => a.sortOrder - b.sortOrder)
    for (const message of messages) {
      if (message.deleted) continue
      if (message.type === 'background') {
        // A background message emits a marker block, but only if the file
        // still exists (FK is SetNull on file delete — we silently drop the
        // marker rather than break the flow).
        flushParagraphs()
        const file = message.backgroundFile
        if (file?.path && file.id) {
          blocks.push({ type: 'background', url: file.path, fileId: file.id })
        }
        continue
      }
      if (message.type === 'audio') {
        // Inline audio embed. Same SetNull-on-delete safety as background:
        // skip the block entirely if the file row is gone, rather than
        // emitting a broken player.
        flushParagraphs()
        const file = message.audioFile
        if (file?.path && file.id && file.mimeType) {
          blocks.push({ type: 'audio', url: file.path, fileId: file.id, mimeType: file.mimeType })
        }
        continue
      }

      const revision = message.currentMessageRevision
      if (!revision) continue
      const paragraphs = (revision.paragraphs || []).sort((a: any, b: any) => a.sortOrder - b.sortOrder)
      for (const paragraph of paragraphs) {
        const paraRevision = paragraph.currentParagraphRevision
        if (paraRevision?.body) {
          paragraphsBuffer.push(`<p>${paraRevision.body}</p>`)
        }
      }
    }
    flushParagraphs()
    return { id: scene.id, blocks }
  })
}

/**
 * Find the background URL active at the *start* of the given chapter,
 * after applying the chapter's own boundary firing (if it has an explicit
 * `defaultBackgroundFileId`).
 *
 * Six firing sources are merged in narrative order; the last one before the
 * chapter's first scene wins:
 *
 *   1. Story-level default (position: outermost / before everything)
 *   2. Book-level defaults (position: at the book's structural boundary)
 *   3. Arc-level defaults (position: at the arc's structural boundary)
 *   4. Chapter-level defaults — including the *current* chapter, so its own
 *      boundary firing is folded into the entering value
 *   5. Scene-level defaults — only in *prior* chapters; current chapter's
 *      scene firings are emitted by buildChapterScenes()
 *   6. Inline `type: 'background'` messages — only in *prior* chapters
 *
 * Visibility filter: chapter/scene/message-sourced events only count if the
 * containing chapter is visible (publishedAt set & in the past), since
 * unpublished chapters aren't experienced by the reader. Story/book/arc
 * defaults always fire — they exist as structural metadata regardless of
 * which chapters are published.
 */
async function getEnteringBackgroundUrl(
  storyId: string,
  currentChapter: { id: string; sortOrder: number; arc: { sortOrder: number; book: { sortOrder: number } } },
  now: Date,
): Promise<string | null> {
  const cur = {
    book: currentChapter.arc.book.sortOrder,
    arc: currentChapter.arc.sortOrder,
    chapter: currentChapter.sortOrder,
  }

  // Position tuple (book, arc, chapter, scene, message). -Infinity is used
  // for unspecified/structural levels (e.g. a book-level default fires
  // before any of its arcs, so its arc/chapter/scene/message slots are -Inf).
  type Event = { pos: [number, number, number, number, number]; url: string }
  const events: Event[] = []

  // (1) Story default — fires at the very start of the story.
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { defaultBackgroundFile: { select: { path: true } } },
  })
  if (story?.defaultBackgroundFile?.path) {
    events.push({
      pos: [-Infinity, -Infinity, -Infinity, -Infinity, -Infinity],
      url: story.defaultBackgroundFile.path,
    })
  }

  // (2) Book defaults at-or-before current book.
  const books = await prisma.book.findMany({
    where: {
      storyId,
      deleted: false,
      sortOrder: { lte: cur.book },
      defaultBackgroundFileId: { not: null },
    },
    select: { sortOrder: true, defaultBackgroundFile: { select: { path: true } } },
  })
  for (const b of books) {
    if (b.defaultBackgroundFile?.path) {
      events.push({
        pos: [b.sortOrder, -Infinity, -Infinity, -Infinity, -Infinity],
        url: b.defaultBackgroundFile.path,
      })
    }
  }

  // (3) Arc defaults at-or-before current arc (in same book) or in any prior book.
  const arcs = await prisma.arc.findMany({
    where: {
      deleted: false,
      defaultBackgroundFileId: { not: null },
      book: { storyId, deleted: false },
    },
    select: {
      sortOrder: true,
      defaultBackgroundFile: { select: { path: true } },
      book: { select: { sortOrder: true } },
    },
  })
  for (const a of arcs) {
    const b = a.book.sortOrder
    if (b > cur.book) continue
    if (b === cur.book && a.sortOrder > cur.arc) continue
    if (a.defaultBackgroundFile?.path) {
      events.push({
        pos: [b, a.sortOrder, -Infinity, -Infinity, -Infinity],
        url: a.defaultBackgroundFile.path,
      })
    }
  }

  // (4) Chapter defaults at-or-before currentChapter (visibility-gated).
  //     Includes currentChapter itself — its own chapter-level firing is
  //     part of the entering value.
  const chapters = await prisma.chapter.findMany({
    where: {
      ...chapterVisibleWhere(now),
      defaultBackgroundFileId: { not: null },
      arc: { book: { storyId } },
    },
    select: {
      sortOrder: true,
      defaultBackgroundFile: { select: { path: true } },
      arc: { select: { sortOrder: true, book: { select: { sortOrder: true } } } },
    },
  })
  for (const c of chapters) {
    const b = c.arc.book.sortOrder
    const a = c.arc.sortOrder
    if (b > cur.book) continue
    if (b === cur.book && a > cur.arc) continue
    if (b === cur.book && a === cur.arc && c.sortOrder > cur.chapter) continue
    if (c.defaultBackgroundFile?.path) {
      events.push({
        pos: [b, a, c.sortOrder, -Infinity, -Infinity],
        url: c.defaultBackgroundFile.path,
      })
    }
  }

  // (5) Scene defaults in chapters STRICTLY BEFORE currentChapter.
  //     Current chapter's scene firings are emitted by buildChapterScenes.
  const scenes = await prisma.scene.findMany({
    where: {
      deleted: false,
      defaultBackgroundFileId: { not: null },
      chapter: {
        ...chapterVisibleWhere(now),
        NOT: { id: currentChapter.id },
        arc: { book: { storyId } },
      },
    },
    select: {
      sortOrder: true,
      defaultBackgroundFile: { select: { path: true } },
      chapter: {
        select: {
          sortOrder: true,
          arc: { select: { sortOrder: true, book: { select: { sortOrder: true } } } },
        },
      },
    },
  })
  for (const s of scenes) {
    const b = s.chapter.arc.book.sortOrder
    const a = s.chapter.arc.sortOrder
    const c = s.chapter.sortOrder
    if (b > cur.book) continue
    if (b === cur.book && a > cur.arc) continue
    if (b === cur.book && a === cur.arc && c >= cur.chapter) continue
    if (s.defaultBackgroundFile?.path) {
      events.push({
        pos: [b, a, c, s.sortOrder, -Infinity],
        url: s.defaultBackgroundFile.path,
      })
    }
  }

  // (6) Inline background messages in chapters STRICTLY BEFORE currentChapter.
  const messages = await prisma.message.findMany({
    where: {
      type: 'background',
      deleted: false,
      backgroundFileId: { not: null },
      backgroundFile: { is: {} },
      scene: {
        deleted: false,
        chapter: {
          ...chapterVisibleWhere(now),
          NOT: { id: currentChapter.id },
          arc: { book: { storyId } },
        },
      },
    },
    select: {
      sortOrder: true,
      backgroundFile: { select: { path: true } },
      scene: {
        select: {
          sortOrder: true,
          chapter: {
            select: {
              sortOrder: true,
              arc: { select: { sortOrder: true, book: { select: { sortOrder: true } } } },
            },
          },
        },
      },
    },
  })
  for (const m of messages) {
    const b = m.scene.chapter.arc.book.sortOrder
    const a = m.scene.chapter.arc.sortOrder
    const c = m.scene.chapter.sortOrder
    if (b > cur.book) continue
    if (b === cur.book && a > cur.arc) continue
    if (b === cur.book && a === cur.arc && c >= cur.chapter) continue
    if (m.backgroundFile?.path) {
      events.push({
        pos: [b, a, c, m.scene.sortOrder, m.sortOrder],
        url: m.backgroundFile.path,
      })
    }
  }

  if (events.length === 0) return null
  events.sort((x, y) => {
    for (let i = 0; i < 5; i++) {
      const xv = x.pos[i]
      const yv = y.pos[i]
      if (xv !== yv) return xv - yv
    }
    return 0
  })
  return events[events.length - 1].url
}

const publicStoriesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /stories - Browse published stories (public, no auth)
  fastify.get(
    '/',
    {
      schema: {
        description: 'Browse published stories (public, no authentication required)',
        tags: ['stories'],
        querystring: listPublicStoriesQuerySchema,
        response: {
          200: listPublicStoriesResponseSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { page, pageSize, search, status, type, sortBy } = request.query

        const skip = (page - 1) * pageSize

        // Build where clause - only show stories whose publishedAt window has
        // opened (publishedAt != null AND <= now). The legacy `published`
        // boolean is still dual-written by the writer endpoints but we filter
        // exclusively on publishedAt to support scheduled publication.
        const now = new Date()
        const where: any = {
          ...storyVisibleWhere(now),
        }

        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { summary: { contains: search, mode: 'insensitive' } },
          ]
        }

        if (status) {
          where.status = status
        }

        if (type) {
          where.type = type
        }

        // Get total count
        const total = await prisma.story.count({ where })

        // Determine sort order
        let orderBy: any
        const isRandom = sortBy === 'random'

        switch (sortBy) {
          case 'popular':
            // TODO: Add view count or popularity metric later
            orderBy = [{ pages: 'desc' }, { updatedAt: 'desc' }]
            break
          case 'title':
            orderBy = { name: 'asc' }
            break
          case 'random':
            // For random, we'll fetch and shuffle
            orderBy = { id: 'asc' }
            break
          default:
            orderBy = { updatedAt: 'desc' }
            break
        }

        // Get stories with owner info
        let stories = await prisma.story.findMany({
          where,
          orderBy,
          skip: isRandom ? 0 : skip, // For random, get all then shuffle and slice
          take: isRandom ? undefined : pageSize,
          include: {
            owner: {
              select: {
                id: true,
                username: true,
              },
            },
            coverArtFile: true,
          },
        })

        // Shuffle for random sort
        if (isRandom) {
          // Fisher-Yates shuffle
          for (let i = stories.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[stories[i], stories[j]] = [stories[j], stories[i]]
          }
          stories = stories.slice(skip, skip + pageSize)
        }

        const totalPages = Math.ceil(total / pageSize)

        return {
          stories: stories.map(formatPublicStory),
          pagination: {
            page,
            pageSize,
            total,
            totalPages,
          },
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to list public stories')
        return reply.status(500).send({ error: 'Failed to list stories' })
      }
    },
  )

  // GET /stories/:id - View single published story (public, no auth)
  fastify.get(
    '/:id',
    {
      schema: {
        description: 'View a single published story (public, no authentication required)',
        tags: ['stories'],
        params: storyIdParamSchema,
        response: {
          200: getPublicStoryResponseSchema,
          304: z.null().meta({ description: 'Not Modified (ETag match)' }),
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params
        const now = new Date()

        const story = await prisma.story.findFirst({
          where: {
            id,
            ...storyVisibleWhere(now),
          },
          include: {
            owner: {
              select: {
                id: true,
                username: true,
              },
            },
            coverArtFile: true,
          },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        const etag = buildETag(story.id, [
          story.updatedAt,
          story.publishedAt,
          story.lastChapterReleasedAt,
        ])
        if (request.headers['if-none-match'] === etag) {
          return reply.status(304).send()
        }
        setCacheHeaders(reply, etag, story.updatedAt)

        return {
          story: formatPublicStory(story),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get public story')
        return reply.status(500).send({ error: 'Failed to get story' })
      }
    },
  )

  // GET /stories/:id/structure - View story with books/arcs/chapters structure (public, no auth)
  fastify.get(
    '/:id/structure',
    {
      schema: {
        description: 'View a story with its full book/arc/chapter structure (public, no authentication required)',
        tags: ['stories'],
        params: storyIdParamSchema,
        response: {
          200: getPublicStoryWithStructureResponseSchema,
          304: z.null().meta({ description: 'Not Modified (ETag match)' }),
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params
        const now = new Date()

        const story = await prisma.story.findFirst({
          where: {
            id,
            ...storyVisibleWhere(now),
          },
          include: {
            owner: {
              select: {
                id: true,
                username: true,
              },
            },
            coverArtFile: true,
            books: {
              include: {
                arcs: {
                  include: {
                    chapters: {
                      // IMPORTANT: this is the visibility filter that stops
                      // unpublished / scheduled / soft-deleted chapters from
                      // leaking into the reader's table of contents.
                      where: chapterVisibleWhere(now),
                      select: {
                        id: true,
                        name: true,
                        sortOrder: true,
                        summary: true,
                        publishedAt: true,
                        updatedAt: true,
                        wordCount: true,
                      },
                    },
                  },
                },
              },
            },
          },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Prune empty branches from the tree. Prisma's `where` on the
        // `chapters` include already hides unpublished/scheduled/soft-deleted
        // chapters, but arcs/books with zero visible chapters would still come
        // through and clutter the reader's table of contents. Drop them here.
        const visibleBooks = story.books
          .map((book) => ({
            ...book,
            arcs: book.arcs.filter((arc) => arc.chapters.length > 0),
          }))
          .filter((book) => book.arcs.length > 0)

        // Collect chapter timestamps for ETag (max of publishedAt/updatedAt
        // across all visible chapters + the story's own updatedAt).
        const chapterTimestamps: Date[] = []
        for (const book of visibleBooks) {
          for (const arc of book.arcs) {
            for (const ch of arc.chapters) {
              chapterTimestamps.push(ch.publishedAt as Date, ch.updatedAt)
            }
          }
        }
        const etag = buildETag(story.id, [story.updatedAt, story.publishedAt, ...chapterTimestamps])
        if (request.headers['if-none-match'] === etag) {
          return reply.status(304).send()
        }
        setCacheHeaders(reply, etag, story.updatedAt)

        return {
          story: formatPublicStoryWithStructure({ ...story, books: visibleBooks }),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get public story structure')
        return reply.status(500).send({ error: 'Failed to get story structure' })
      }
    },
  )

  // GET /stories/:id/chapters/:chapterId - View chapter content (public, no auth)
  fastify.get(
    '/:id/chapters/:chapterId',
    {
      schema: {
        description: "View a chapter's content (public, no authentication required)",
        tags: ['stories'],
        params: chapterIdParamSchema,
        response: {
          200: getChapterContentResponseSchema,
          304: z.null().meta({ description: 'Not Modified (ETag match)' }),
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id: storyId, chapterId } = request.params
        const now = new Date()

        // First, verify the story's publishedAt window is open.
        const story = await prisma.story.findFirst({
          where: {
            id: storyId,
            ...storyVisibleWhere(now),
          },
          select: { id: true },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Get the chapter with its content — must also be visible (publishedAt
        // set and <= now, not soft-deleted). This is the primary leak fix:
        // previously ANY chapter of a published story was readable, including
        // drafts and scheduled-for-the-future chapters.
        const chapter = await prisma.chapter.findFirst({
          where: {
            id: chapterId,
            ...chapterVisibleWhere(now),
            arc: {
              book: {
                storyId: storyId,
              },
            },
          },
          include: {
            arc: {
              include: {
                book: true,
              },
            },
            scenes: {
              include: {
                // Hydrate the scene's own default background file so
                // buildChapterScenes can emit a scene-boundary firing
                // when the scene has its own explicit default.
                defaultBackgroundFile: { select: { id: true, path: true } },
                messages: {
                  include: {
                    currentMessageRevision: {
                      include: {
                        paragraphs: {
                          include: {
                            currentParagraphRevision: true,
                          },
                        },
                      },
                    },
                    // Hydrate the file record for `background` messages so
                    // the structured extractor can emit { url, fileId }.
                    backgroundFile: { select: { id: true, path: true } },
                    // Hydrate the audio file (with mimeType) for `audio`
                    // messages so the reader's <audio> tag knows its format.
                    audioFile: { select: { id: true, path: true, mimeType: true } },
                  },
                },
              },
            },
          },
        })

        if (!chapter) {
          return reply.status(404).send({ error: 'Chapter not found' })
        }

        // Get all *visible* chapters in the story to find prev/next. Drafts
        // and future-scheduled chapters must be skipped so readers don't hit
        // a 404 when clicking "next".
        const allChapters = await prisma.chapter.findMany({
          where: {
            ...chapterVisibleWhere(now),
            arc: {
              book: {
                storyId: storyId,
              },
            },
          },
          include: {
            arc: {
              include: {
                book: true,
              },
            },
          },
          orderBy: [{ arc: { book: { sortOrder: 'asc' } } }, { arc: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
        })

        // Find current chapter index and get prev/next
        const currentIndex = allChapters.findIndex((c) => c.id === chapterId)
        const previousChapterId = currentIndex > 0 ? allChapters[currentIndex - 1].id : null
        const nextChapterId = currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1].id : null

        // ETag: chapter.updatedAt + publishedAt. Note that paragraph-level
        // revisions don't currently bump Chapter.updatedAt, so content edits
        // made via revisions won't invalidate the cache. TODO: propagate
        // paragraph/scene updates up to Chapter.updatedAt (or compute ETag
        // from a nested max).
        const etag = buildETag(chapter.id, [chapter.updatedAt, chapter.publishedAt])
        if (request.headers['if-none-match'] === etag) {
          return reply.status(304).send()
        }
        setCacheHeaders(reply, etag, chapter.updatedAt)

        const enteringBackgroundUrl = await getEnteringBackgroundUrl(
          storyId,
          {
            id: chapter.id,
            sortOrder: chapter.sortOrder,
            arc: { sortOrder: chapter.arc.sortOrder, book: { sortOrder: chapter.arc.book.sortOrder } },
          },
          now,
        )

        return {
          chapter: {
            id: chapter.id,
            name: chapter.name,
            enteringBackgroundUrl,
            scenes: buildChapterScenes(chapter),
            publishedAt: (chapter.publishedAt as Date).toISOString(),
            previousChapterId,
            nextChapterId,
          },
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get chapter content')
        return reply.status(500).send({ error: 'Failed to get chapter content' })
      }
    },
  )
}

export default publicStoriesRoutes
