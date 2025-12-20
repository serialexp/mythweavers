import { Prisma } from '@prisma/client'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
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

const perspectiveSchema = z.enum(['FIRST', 'SECOND', 'THIRD']).meta({
  description: 'Narrative perspective',
  example: 'THIRD',
})

const tenseSchema = z.enum(['PAST', 'PRESENT']).meta({
  description: 'Narrative tense',
  example: 'PAST',
})

// Light schema for list endpoint - only fields needed for display
const storyListItemSchema = z.strictObject({
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
  updatedAt: z.string().meta({
    description: 'Last update timestamp',
    example: '2025-12-05T12:00:00.000Z',
  }),
  characterCount: z.number().meta({
    description: 'Number of characters in story',
    example: 10,
  }),
  chapterCount: z.number().meta({
    description: 'Number of chapters in story',
    example: 25,
  }),
  messageCount: z.number().meta({
    description: 'Number of messages in story',
    example: 100,
  }),
})

// Full story response schema (what we return to the client)
const storySchema = z.strictObject({
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
  ownerId: z.number().meta({
    description: 'Owner user ID',
    example: 1,
  }),
  importedFromId: z.string().nullable().meta({
    description: 'Original story ID from migration source',
    example: 'abc123',
  }),
  royalRoadId: z.number().nullable().meta({
    description: 'Royal Road story ID for publishing',
    example: 12345,
  }),
  published: z.boolean().meta({
    description: 'Whether the story is published',
    example: false,
  }),
  status: storyStatusSchema,
  type: storyTypeSchema,
  wordsPerWeek: z.number().nullable().meta({
    description: 'Target words per week',
    example: 5000,
  }),
  spellingLevel: z.number().nullable().meta({
    description: 'Spelling difficulty level',
    example: 3,
  }),
  chapters: z.number().nullable().meta({
    description: 'Number of chapters',
    example: 10,
  }),
  firstChapterReleasedAt: z.string().nullable().meta({
    description: 'First chapter release date',
    example: '2025-01-01T12:00:00.000Z',
  }),
  lastChapterReleasedAt: z.string().nullable().meta({
    description: 'Last chapter release date',
    example: '2025-12-01T12:00:00.000Z',
  }),
  coverArtFileId: z.string().nullable().meta({
    description: 'Cover art file ID',
    example: 'clx1234567890',
  }),
  defaultPerspective: perspectiveSchema.nullable(),
  defaultTense: tenseSchema.nullable(),
  genre: z.string().nullable().meta({
    description: 'Story genre (fantasy, sci-fi, etc.)',
    example: 'fantasy',
  }),
  paragraphsPerTurn: z.number().meta({
    description: 'Target paragraphs per AI generation turn',
    example: 3,
  }),
  defaultProtagonistId: z.string().nullable().meta({
    description: 'Default protagonist character ID',
    example: 'clx1234567890',
  }),
  provider: z.string().meta({
    description: 'LLM provider',
    example: 'anthropic',
  }),
  model: z.string().nullable().meta({
    description: 'LLM model',
    example: 'claude-sonnet-4',
  }),
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
  sortOrder: z.number().meta({
    description: "Sort order for user's story list",
    example: 0,
  }),
  pages: z.number().nullable().meta({
    description: 'Estimated page count',
    example: 120,
  }),
  timelineStartTime: z.number().nullable().meta({
    description: 'Timeline start time in minutes from epoch',
    example: -525600,
  }),
  timelineEndTime: z.number().nullable().meta({
    description: 'Timeline end time in minutes from epoch',
    example: 525600,
  }),
  timelineGranularity: z.string().meta({
    description: 'Timeline granularity (hour or day)',
    example: 'hour',
  }),
  defaultCalendarId: z.string().nullable().meta({
    description: 'Default calendar ID',
    example: 'clx1234567890',
  }),
  branchChoices: z.any().nullable().meta({
    description: 'Branch choices JSON object',
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

// Create story request body
const createStoryBodySchema = z.strictObject({
  name: z.string().min(1).max(200).meta({
    description: 'Story name/title',
    example: 'My Epic Adventure',
  }),
  summary: z.string().optional().meta({
    description: 'Story summary/description',
    example: 'A tale of heroes and dragons',
  }),
  type: storyTypeSchema.optional(),
  defaultPerspective: perspectiveSchema.optional(),
  defaultTense: tenseSchema.optional(),
  genre: z.string().optional().meta({
    description: 'Story genre (fantasy, sci-fi, etc.)',
    example: 'fantasy',
  }),
  paragraphsPerTurn: z.number().optional().meta({
    description: 'Target paragraphs per AI generation turn',
    example: 3,
  }),
  provider: z.string().optional().meta({
    description: 'LLM provider',
    example: 'anthropic',
  }),
  model: z.string().optional().meta({
    description: 'LLM model name',
    example: 'claude-sonnet-4',
  }),
})

// Update story request body (all fields optional)
const updateStoryBodySchema = z.strictObject({
  name: z.string().min(1).max(200).optional().meta({
    description: 'Story name/title',
    example: 'My Epic Adventure',
  }),
  summary: z.string().nullable().optional().meta({
    description: 'Story summary/description',
    example: 'A tale of heroes and dragons',
  }),
  published: z.boolean().optional().meta({
    description: 'Whether the story is publicly published',
    example: true,
  }),
  status: storyStatusSchema.optional(),
  type: storyTypeSchema.optional(),
  defaultPerspective: perspectiveSchema.nullable().optional(),
  defaultTense: tenseSchema.nullable().optional(),
  genre: z.string().nullable().optional().meta({
    description: 'Story genre (fantasy, sci-fi, etc.)',
    example: 'fantasy',
  }),
  paragraphsPerTurn: z.number().optional().meta({
    description: 'Target paragraphs per AI generation turn',
    example: 3,
  }),
  timelineStartTime: z.number().nullable().optional().meta({
    description: 'Timeline start time in minutes from epoch',
    example: -525600,
  }),
  timelineEndTime: z.number().nullable().optional().meta({
    description: 'Timeline end time in minutes from epoch',
    example: 525600,
  }),
  timelineGranularity: z.string().optional().meta({
    description: 'Timeline granularity (hour or day)',
    example: 'hour',
  }),
  provider: z.string().optional().meta({
    description: 'LLM provider',
    example: 'anthropic',
  }),
  model: z.string().nullable().optional().meta({
    description: 'LLM model name',
    example: 'claude-sonnet-4',
  }),
  coverColor: z.string().optional(),
  coverTextColor: z.string().optional(),
  coverFontFamily: z.string().optional(),
  sortOrder: z.number().optional(),
})

// List query parameters
const listStoriesQuerySchema = z.strictObject({
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
})

// Path parameters
const storyIdParamSchema = z.strictObject({
  id: z.string().meta({
    description: 'Story ID',
    example: 'clx1234567890',
  }),
})

// Response schemas
const createStoryResponseSchema = z.strictObject({
  success: z.literal(true),
  story: storySchema,
})

const listStoriesResponseSchema = z.strictObject({
  stories: z.array(storyListItemSchema),
  pagination: paginationSchema,
})

const getStoryResponseSchema = z.strictObject({
  story: storySchema,
})

const updateStoryResponseSchema = z.strictObject({
  success: z.literal(true),
  story: storySchema,
})

const deleteStoryResponseSchema = z.strictObject({
  success: z.literal(true),
})

// Export endpoint response schema - complete story with all nested data
const exportStoryResponseSchema = z.strictObject({
  story: storySchema,
  books: z.array(
    z.strictObject({
      id: z.string(),
      storyId: z.string(),
      name: z.string(),
      summary: z.string().nullable(),
      sortOrder: z.number(),
      coverArtFileId: z.string().nullable(),
      spineArtFileId: z.string().nullable(),
      pages: z.number().nullable(),
      nodeType: z.enum(['story', 'non-story', 'context']),
      createdAt: z.string(),
      updatedAt: z.string(),
      arcs: z.array(
        z.strictObject({
          id: z.string(),
          bookId: z.string(),
          name: z.string(),
          summary: z.string().nullable(),
          sortOrder: z.number(),
          nodeType: z.enum(['story', 'non-story', 'context']),
          createdAt: z.string(),
          updatedAt: z.string(),
          chapters: z.array(
            z.strictObject({
              id: z.string(),
              arcId: z.string(),
              name: z.string(),
              summary: z.string().nullable(),
              sortOrder: z.number(),
              nodeType: z.enum(['story', 'non-story', 'context']),
              publishedOn: z.string().nullable(),
              royalRoadId: z.number().nullable(),
              createdAt: z.string(),
              updatedAt: z.string(),
              scenes: z.array(
                z.strictObject({
                  id: z.string(),
                  chapterId: z.string(),
                  name: z.string(),
                  summary: z.string().nullable(),
                  sortOrder: z.number(),
                  perspective: perspectiveSchema.nullable(),
                  viewpointCharacterId: z.string().nullable(),
                  activeCharacterIds: z.array(z.string()),
                  activeContextItemIds: z.array(z.string()),
                  goal: z.string().nullable(),
                  storyTime: z.number().nullable(),
                  createdAt: z.string(),
                  updatedAt: z.string(),
                  messages: z.array(
                    z.strictObject({
                      id: z.string(),
                      sceneId: z.string(),
                      sortOrder: z.number(),
                      instruction: z.string().nullable(),
                      script: z.string().nullable(),
                      currentMessageRevisionId: z.string().nullable(),
                      createdAt: z.string(),
                      updatedAt: z.string(),
                      revision: z
                        .strictObject({
                          id: z.string(),
                          messageId: z.string(),
                          version: z.number(),
                          model: z.string().nullable(),
                          tokensPerSecond: z.number().nullable(),
                          totalTokens: z.number().nullable(),
                          promptTokens: z.number().nullable(),
                          cacheCreationTokens: z.number().nullable(),
                          cacheReadTokens: z.number().nullable(),
                          think: z.string().nullable(),
                          showThink: z.boolean(),
                          createdAt: z.string(),
                          paragraphs: z.array(
                            z.strictObject({
                              id: z.string(),
                              messageRevisionId: z.string(),
                              sortOrder: z.number(),
                              currentParagraphRevisionId: z.string().nullable(),
                              createdAt: z.string(),
                              updatedAt: z.string(),
                              revision: z
                                .strictObject({
                                  id: z.string(),
                                  paragraphId: z.string(),
                                  version: z.number(),
                                  body: z.string(),
                                  contentSchema: z.string().nullable(),
                                  state: z.string().nullable(),
                                  plotPointActions: z.array(z.any()),
                                  inventoryActions: z.array(z.any()),
                                  createdAt: z.string(),
                                })
                                .nullable(),
                            }),
                          ),
                        })
                        .nullable(),
                    }),
                  ),
                }),
              ),
            }),
          ),
        }),
      ),
    }),
  ),
  characters: z.array(
    z.strictObject({
      id: z.string(),
      storyId: z.string(),
      firstName: z.string(),
      middleName: z.string().nullable(),
      lastName: z.string().nullable(),
      nickname: z.string().nullable(),
      description: z.string().nullable(),
      personality: z.string().nullable(),
      personalityQuirks: z.string().nullable(),
      background: z.string().nullable(),
      likes: z.string().nullable(),
      dislikes: z.string().nullable(),
      age: z.string().nullable(),
      gender: z.string().nullable(),
      sexualOrientation: z.string().nullable(),
      height: z.number().nullable(),
      hairColor: z.string().nullable(),
      eyeColor: z.string().nullable(),
      distinguishingFeatures: z.string().nullable(),
      writingStyle: z.string().nullable(),
      pictureFileId: z.string().nullable(),
      birthdate: z.number().nullable(),
      significantActions: z.any().nullable(),
      isMainCharacter: z.boolean(),
      laterVersionOfId: z.string().nullable(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  contextItems: z.array(
    z.strictObject({
      id: z.string(),
      storyId: z.string(),
      type: z.enum(['theme', 'location', 'plot']),
      name: z.string(),
      description: z.string(),
      isGlobal: z.boolean(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  calendars: z.array(
    z.strictObject({
      id: z.string(),
      storyId: z.string(),
      name: z.string(),
      config: z.any(),
      isDefault: z.boolean(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  maps: z.array(
    z.strictObject({
      id: z.string(),
      storyId: z.string(),
      name: z.string(),
      fileId: z.string().nullable(),
      borderColor: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
})

// Helper to format story for response
function formatStory(story: any) {
  return {
    ...story,
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
  }
}

const myStoriesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // POST /my/stories - Create new story
  fastify.post(
    '/',
    {
      schema: {
        description: 'Create a new story',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        body: createStoryBodySchema,
        response: {
          201: createStoryResponseSchema,
          400: errorSchema,
          401: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { name, summary, type, defaultPerspective, defaultTense, genre, paragraphsPerTurn, provider, model } =
          request.body

        const story = await prisma.story.create({
          data: {
            name,
            summary: summary || null,
            ownerId: userId,
            type: type || 'ORIGINAL',
            defaultPerspective: defaultPerspective || 'THIRD',
            defaultTense: defaultTense || 'PAST',
            genre: genre || null,
            paragraphsPerTurn: paragraphsPerTurn ?? 3,
            provider: provider || 'ollama',
            model: model || null,
          },
        })

        fastify.log.info({ storyId: story.id, userId }, 'Story created')

        return reply.status(201).send({
          success: true as const,
          story: formatStory(story),
        })
      } catch (error) {
        fastify.log.error({ error }, 'Failed to create story')
        return reply.status(500).send({ error: 'Failed to create story' })
      }
    },
  )

  // GET /my/stories - List user's stories
  fastify.get(
    '/',
    {
      schema: {
        description: 'List all stories owned by the authenticated user',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        querystring: listStoriesQuerySchema,
        response: {
          200: listStoriesResponseSchema,
          401: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { page, pageSize, search } = request.query

        const skip = (page - 1) * pageSize

        // Build where clause
        const where: any = {
          ownerId: userId,
        }

        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { summary: { contains: search, mode: 'insensitive' } },
          ]
        }

        // Get total count
        const total = await prisma.story.count({ where })

        // Get stories with counts using raw SQL for efficiency
        const stories = await prisma.$queryRaw<
          Array<{
            id: string
            name: string
            summary: string | null
            updatedAt: Date
            characterCount: bigint
            chapterCount: bigint
            messageCount: bigint
          }>
        >`
          SELECT
            s.id,
            s.name,
            s.summary,
            s."updatedAt",
            COUNT(DISTINCT ch.id) as "characterCount",
            COUNT(DISTINCT c.id) as "chapterCount",
            COUNT(DISTINCT m.id) as "messageCount"
          FROM "Story" s
          LEFT JOIN "Character" ch ON ch."storyId" = s.id
          LEFT JOIN "Book" b ON b."storyId" = s.id
          LEFT JOIN "Arc" a ON a."bookId" = b.id
          LEFT JOIN "Chapter" c ON c."arcId" = a.id
          LEFT JOIN "Scene" sc ON sc."chapterId" = c.id
          LEFT JOIN "Message" m ON m."sceneId" = sc.id
          WHERE s."ownerId" = ${userId}
          ${search ? Prisma.sql`AND (s.name ILIKE ${`%${search}%`} OR s.summary ILIKE ${`%${search}%`})` : Prisma.empty}
          GROUP BY s.id
          ORDER BY s."sortOrder" ASC, s."updatedAt" DESC
          LIMIT ${pageSize} OFFSET ${skip}
        `

        const totalPages = Math.ceil(total / pageSize)

        return {
          stories: stories.map((s) => ({
            id: s.id,
            name: s.name,
            summary: s.summary,
            updatedAt: s.updatedAt.toISOString(),
            characterCount: Number(s.characterCount),
            chapterCount: Number(s.chapterCount),
            messageCount: Number(s.messageCount),
          })),
          pagination: {
            page,
            pageSize,
            total,
            totalPages,
          },
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to list stories')
        return reply.status(500).send({ error: 'Failed to list stories' })
      }
    },
  )

  // GET /my/stories/:id - Get single story
  fastify.get(
    '/:id',
    {
      schema: {
        description: 'Get a single story by ID (must be owned by authenticated user)',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        response: {
          200: getStoryResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { id } = request.params

        const story = await prisma.story.findFirst({
          where: {
            id,
            ownerId: userId,
          },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        return {
          story: formatStory(story),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get story')
        return reply.status(500).send({ error: 'Failed to get story' })
      }
    },
  )

  // PATCH /my/stories/:id - Update story
  fastify.patch(
    '/:id',
    {
      schema: {
        description: 'Update a story (must be owned by authenticated user)',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        body: updateStoryBodySchema,
        response: {
          200: updateStoryResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { id } = request.params
        const updates = request.body

        // Check if story exists and is owned by user
        const existingStory = await prisma.story.findFirst({
          where: {
            id,
            ownerId: userId,
          },
        })

        if (!existingStory) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Update story
        const story = await prisma.story.update({
          where: { id },
          data: updates,
        })

        fastify.log.info({ storyId: story.id, userId }, 'Story updated')

        return {
          success: true as const,
          story: formatStory(story),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to update story')
        return reply.status(500).send({ error: 'Failed to update story' })
      }
    },
  )

  // DELETE /my/stories/:id - Delete story
  fastify.delete(
    '/:id',
    {
      schema: {
        description: 'Delete a story (must be owned by authenticated user)',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        response: {
          200: deleteStoryResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { id } = request.params

        // Check if story exists and is owned by user
        const existingStory = await prisma.story.findFirst({
          where: {
            id,
            ownerId: userId,
          },
        })

        if (!existingStory) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Delete story (cascade will handle related records)
        await prisma.story.delete({
          where: { id },
        })

        fastify.log.info({ storyId: id, userId }, 'Story deleted')

        return {
          success: true as const,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to delete story')
        return reply.status(500).send({ error: 'Failed to delete story' })
      }
    },
  )

  // GET /my/stories/:id/export - Export complete story with all nested data
  fastify.get(
    '/:id/export',
    {
      schema: {
        description:
          'Export complete story with all nested data (books, arcs, chapters, scenes, messages, characters, etc.)',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        response: {
          200: exportStoryResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { id } = request.params

        // Load story with complete hierarchy
        const story = await prisma.story.findFirst({
          where: {
            id,
            ownerId: userId,
          },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Load all books with nested hierarchy
        const books = await prisma.book.findMany({
          where: { storyId: id },
          orderBy: { sortOrder: 'asc' },
          include: {
            arcs: {
              orderBy: { sortOrder: 'asc' },
              include: {
                chapters: {
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    scenes: {
                      orderBy: { sortOrder: 'asc' },
                      include: {
                        messages: {
                          orderBy: { sortOrder: 'asc' },
                          include: {
                            currentMessageRevision: {
                              include: {
                                paragraphs: {
                                  orderBy: { sortOrder: 'asc' },
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
                },
              },
            },
          },
        })

        // Load characters
        const characters = await prisma.character.findMany({
          where: { storyId: id },
          orderBy: { createdAt: 'asc' },
        })

        // Load context items
        const contextItems = await prisma.contextItem.findMany({
          where: { storyId: id },
          orderBy: { createdAt: 'asc' },
        })

        // Load calendars
        const calendars = await prisma.calendar.findMany({
          where: { storyId: id },
          orderBy: { createdAt: 'asc' },
        })

        // Check if story has default calendar
        const isDefault = (calendarId: string) => story.defaultCalendarId === calendarId

        // Load maps (without nested data - can be loaded separately if needed)
        const maps = await prisma.map.findMany({
          where: { storyId: id },
          orderBy: { createdAt: 'asc' },
        })

        // Format dates in nested structure
        const formatDates = (obj: any): any => {
          if (!obj) return obj
          if (Array.isArray(obj)) return obj.map(formatDates)
          if (obj instanceof Date) return obj.toISOString()
          if (typeof obj === 'object') {
            const formatted: any = {}
            for (const key in obj) {
              if (obj[key] instanceof Date) {
                formatted[key] = obj[key].toISOString()
              } else if (typeof obj[key] === 'object') {
                formatted[key] = formatDates(obj[key])
              } else {
                formatted[key] = obj[key]
              }
            }
            return formatted
          }
          return obj
        }

        // Transform the nested data to match schema
        const formattedBooks = books.map((book) => ({
          ...formatDates(book),
          arcs: book.arcs.map((arc) => ({
            ...formatDates(arc),
            chapters: arc.chapters.map((chapter) => ({
              ...formatDates(chapter),
              scenes: chapter.scenes.map((scene) => ({
                ...formatDates(scene),
                activeCharacterIds: scene.activeCharacterIds || [],
                activeContextItemIds: scene.activeContextItemIds || [],
                messages: scene.messages.map((message) => ({
                  id: message.id,
                  sceneId: message.sceneId,
                  sortOrder: message.sortOrder,
                  instruction: message.instruction,
                  script: message.script,
                  currentMessageRevisionId: message.currentMessageRevisionId,
                  createdAt: message.createdAt.toISOString(),
                  updatedAt: message.updatedAt.toISOString(),
                  revision: message.currentMessageRevision
                    ? {
                        id: message.currentMessageRevision.id,
                        messageId: message.currentMessageRevision.messageId,
                        version: message.currentMessageRevision.version,
                        model: message.currentMessageRevision.model,
                        tokensPerSecond: message.currentMessageRevision.tokensPerSecond,
                        totalTokens: message.currentMessageRevision.totalTokens,
                        promptTokens: message.currentMessageRevision.promptTokens,
                        cacheCreationTokens: message.currentMessageRevision.cacheCreationTokens,
                        cacheReadTokens: message.currentMessageRevision.cacheReadTokens,
                        think: message.currentMessageRevision.think,
                        showThink: message.currentMessageRevision.showThink,
                        createdAt: message.currentMessageRevision.createdAt.toISOString(),
                        paragraphs: message.currentMessageRevision.paragraphs.map((para) => ({
                          id: para.id,
                          messageRevisionId: para.messageRevisionId,
                          sortOrder: para.sortOrder,
                          currentParagraphRevisionId: para.currentParagraphRevisionId,
                          createdAt: para.createdAt.toISOString(),
                          updatedAt: para.updatedAt.toISOString(),
                          revision: para.currentParagraphRevision
                            ? {
                                id: para.currentParagraphRevision.id,
                                paragraphId: para.currentParagraphRevision.paragraphId,
                                version: para.currentParagraphRevision.version,
                                body: para.currentParagraphRevision.body,
                                contentSchema: para.currentParagraphRevision.contentSchema,
                                state: para.currentParagraphRevision.state,
                                plotPointActions: para.currentParagraphRevision.plotPointActions ?? [],
                                inventoryActions: para.currentParagraphRevision.inventoryActions ?? [],
                                createdAt: para.currentParagraphRevision.createdAt.toISOString(),
                              }
                            : null,
                        })),
                      }
                    : null,
                })),
              })),
            })),
          })),
        }))

        fastify.log.info(
          { storyId: id, userId, bookCount: books.length, characterCount: characters.length },
          'Story exported',
        )

        return {
          story: formatStory(story),
          books: formattedBooks,
          characters: characters.map(formatDates),
          contextItems: contextItems.map(formatDates),
          calendars: calendars.map((cal) => ({
            ...formatDates(cal),
            isDefault: isDefault(cal.id),
          })),
          maps: maps.map(formatDates),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to export story')
        return reply.status(500).send({ error: 'Failed to export story' })
      }
    },
  )
}

export default myStoriesRoutes
