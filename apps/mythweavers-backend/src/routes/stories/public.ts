import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { errorSchema, paginationSchema } from '../../schemas/common.js'

// Enums from Prisma schema
const storyStatusSchema = z.enum(['COMPLETED', 'ONGOING', 'HIATUS']).meta({
  description: 'Story publication status',
  example: 'ONGOING',
})

const storyTypeSchema = z.enum(['FANFICTION', 'ORIGINAL']).meta({
  description: 'Story type',
  example: 'ORIGINAL',
})

// Owner info (subset of user data for public view)
const ownerSchema = z.strictObject({
  id: z.number().meta({
    description: 'Owner user ID',
    example: 1,
  }),
  username: z.string().meta({
    description: 'Owner username',
    example: 'johndoe',
  }),
})

// Public story response schema (what we show to anonymous users)
const publicStorySchema = z.strictObject({
  id: z.string().meta({
    description: 'Story ID',
    example: 'clx1234567890',
  }),
  name: z.string().meta({
    description: 'Story name/title',
    example: 'My Epic Adventure',
  }),
  summary: z.string().nullable().meta({
    description: 'Story summary/description',
    example: 'A tale of heroes and dragons',
  }),
  owner: ownerSchema,
  status: storyStatusSchema,
  type: storyTypeSchema,
  coverColor: z.string().meta({
    description: 'Cover background color',
    example: '#000000',
  }),
  coverTextColor: z.string().meta({
    description: 'Cover text color',
    example: '#FFFFFF',
  }),
  coverFontFamily: z.string().meta({
    description: 'Cover font family',
    example: 'Georgia',
  }),
  pages: z.number().nullable().meta({
    description: 'Estimated page count',
    example: 120,
  }),
  createdAt: z.string().meta({
    description: 'Creation timestamp',
    example: '2025-12-05T12:00:00.000Z',
  }),
  updatedAt: z.string().meta({
    description: 'Last update timestamp',
    example: '2025-12-05T12:00:00.000Z',
  }),
})

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

// Helper to format story for public response
function formatPublicStory(story: any) {
  return {
    id: story.id,
    name: story.name,
    summary: story.summary,
    owner: {
      id: story.owner.id,
      username: story.owner.username,
    },
    status: story.status,
    type: story.type,
    coverColor: story.coverColor,
    coverTextColor: story.coverTextColor,
    coverFontFamily: story.coverFontFamily,
    pages: story.pages,
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
  }
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

// Chapter content schema
const chapterContentSchema = z.strictObject({
  id: z.string().meta({
    description: 'Chapter ID',
    example: 'clx1234567890',
  }),
  name: z.string().meta({
    description: 'Chapter name',
    example: 'Chapter 1: The Beginning',
  }),
  content: z.string().meta({
    description: 'Chapter content as HTML',
    example: '<p>Once upon a time...</p>',
  }),
  previousChapterId: z.string().nullable().meta({
    description: 'ID of the previous chapter',
    example: 'clx1234567889',
  }),
  nextChapterId: z.string().nullable().meta({
    description: 'ID of the next chapter',
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
              })),
          })),
      })),
  }
}

// Helper to extract chapter content from scenes/messages/paragraphs
function extractChapterContent(chapter: any): string {
  const parts: string[] = []

  // Sort scenes by sortOrder
  const scenes = (chapter.scenes || []).sort((a: any, b: any) => a.sortOrder - b.sortOrder)

  for (const scene of scenes) {
    // Sort messages by sortOrder
    const messages = (scene.messages || []).sort((a: any, b: any) => a.sortOrder - b.sortOrder)

    for (const message of messages) {
      const revision = message.currentMessageRevision
      if (!revision) continue

      // Sort paragraphs by sortOrder
      const paragraphs = (revision.paragraphs || []).sort((a: any, b: any) => a.sortOrder - b.sortOrder)

      for (const paragraph of paragraphs) {
        const paraRevision = paragraph.currentParagraphRevision
        if (paraRevision?.body) {
          parts.push(`<p>${paraRevision.body}</p>`)
        }
      }
    }
  }

  return parts.join('\n')
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

        // Build where clause - only show published stories
        const where: any = {
          published: true,
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
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params

        const story = await prisma.story.findFirst({
          where: {
            id,
            published: true, // Only show if published
          },
          include: {
            owner: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

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
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params

        const story = await prisma.story.findFirst({
          where: {
            id,
            published: true, // Only show if published
          },
          include: {
            owner: {
              select: {
                id: true,
                username: true,
              },
            },
            books: {
              include: {
                arcs: {
                  include: {
                    chapters: {
                      select: {
                        id: true,
                        name: true,
                        sortOrder: true,
                        summary: true,
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

        return {
          story: formatPublicStoryWithStructure(story),
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
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id: storyId, chapterId } = request.params

        // First, verify the story is published and the chapter belongs to it
        const story = await prisma.story.findFirst({
          where: {
            id: storyId,
            published: true,
          },
          select: { id: true },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Get the chapter with its content
        const chapter = await prisma.chapter.findFirst({
          where: {
            id: chapterId,
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
                  },
                },
              },
            },
          },
        })

        if (!chapter) {
          return reply.status(404).send({ error: 'Chapter not found' })
        }

        // Get all chapters in the story to find prev/next
        const allChapters = await prisma.chapter.findMany({
          where: {
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

        return {
          chapter: {
            id: chapter.id,
            name: chapter.name,
            content: extractChapterContent(chapter),
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
