import { Prisma } from '@prisma/client'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema, paginationSchema, propertySchemaSchema, successSchema } from '../../schemas/common.js'

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
  format: z.string().meta({
    description: 'Story format (narrative or cyoa)',
    example: 'narrative',
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
  selectedNodeId: z.string().nullable().optional().meta({
    description: 'Last selected node (scene) ID for restoring UI state',
    example: 'clx1234567890',
  }),
  globalScript: z.string().nullable().meta({
    description: 'JavaScript function for initializing story data and defining reusable functions',
  }),
  plotPointDefaults: z
    .array(
      z.object({
        key: z.string(),
        type: z.enum(['string', 'number', 'enum', 'boolean']),
        default: z.union([z.string(), z.number(), z.boolean()]),
        options: z.array(z.string()).optional(),
      }),
    )
    .nullable()
    .meta({
      description: 'Array of plot point definitions with default values',
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
  format: z.string().optional().meta({
    description: 'Story format (narrative or cyoa)',
    example: 'narrative',
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
  format: z.string().optional().meta({
    description: 'Story format (narrative or cyoa)',
    example: 'narrative',
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
  globalScript: z.string().nullable().optional().meta({
    description: 'JavaScript function for initializing story data and defining reusable functions',
  }),
  plotPointDefaults: z
    .array(
      z.object({
        key: z.string(),
        type: z.enum(['string', 'number', 'enum', 'boolean']),
        default: z.union([z.string(), z.number(), z.boolean()]),
        options: z.array(z.string()).optional(),
      }),
    )
    .nullable()
    .optional()
    .meta({
      description: 'Array of plot point definitions with default values',
    }),
  selectedNodeId: z.string().nullable().optional().meta({
    description: 'Last selected node (scene) ID for restoring UI state',
    example: 'clx1234567890',
  }),
  branchChoices: z.any().nullable().optional().meta({
    description: 'Branch choices JSON object',
  }),
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
      deleted: z.boolean(),
      deletedAt: z.string().nullable(),
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
          deleted: z.boolean(),
          deletedAt: z.string().nullable(),
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
              status: z.string().nullable(),
              deleted: z.boolean(),
              deletedAt: z.string().nullable(),
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
                  status: z.string().nullable(),
                  includeInFull: z.number(),
                  deleted: z.boolean(),
                  deletedAt: z.string().nullable(),
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
                      deleted: z.boolean(),
                      type: z.string().nullable(),
                      options: z.any().nullable(),
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
      pictureFileUrl: z.string().nullable().meta({ description: 'URL path to fetch the character picture' }),
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
      borderColor: z.string().nullable(),
      propertySchema: propertySchemaSchema.nullable(),
      landmarkCount: z.number(),
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
          data: updates as Prisma.StoryUpdateInput,
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

        // Load characters with their picture files
        const characters = await prisma.character.findMany({
          where: { storyId: id },
          orderBy: { createdAt: 'asc' },
          include: {
            pictureFile: true,
          },
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
          include: {
            _count: {
              select: { landmarks: true },
            },
          },
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
              status: chapter.status,
              scenes: chapter.scenes.map((scene) => ({
                ...formatDates(scene),
                status: scene.status,
                includeInFull: scene.includeInFull,
                activeCharacterIds: scene.activeCharacterIds || [],
                activeContextItemIds: scene.activeContextItemIds || [],
                messages: scene.messages.map((message) => ({
                  id: message.id,
                  sceneId: message.sceneId,
                  sortOrder: message.sortOrder,
                  instruction: message.instruction,
                  script: message.script,
                  deleted: message.deleted,
                  type: message.type,
                  options: message.options,
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
          characters: characters.map((char) => {
            const { pictureFile, ...charData } = char
            return {
              ...formatDates(charData),
              pictureFileUrl: pictureFile?.path ?? null,
            }
          }),
          contextItems: contextItems.map(formatDates),
          calendars: calendars.map((cal) => ({
            ...formatDates(cal),
            isDefault: isDefault(cal.id),
          })),
          maps: maps.map((m) => {
            const { _count, ...mapData } = m
            return {
              ...formatDates(mapData),
              landmarkCount: _count.landmarks,
            }
          }),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to export story')
        return reply.status(500).send({ error: 'Failed to export story' })
      }
    },
  )

  // GET /my/stories/:id/deleted-messages - List deleted messages for a story
  fastify.get(
    '/:id/deleted-messages',
    {
      schema: {
        description: 'List all deleted messages for a story (for potential restoration)',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        querystring: z.strictObject({
          limit: z.coerce.number().int().min(1).max(100).default(50).meta({
            description: 'Maximum number of messages to return',
            example: 50,
          }),
          offset: z.coerce.number().int().min(0).default(0).meta({
            description: 'Number of messages to skip',
            example: 0,
          }),
        }),
        response: {
          200: z.strictObject({
            messages: z.array(
              z.strictObject({
                id: z.string().meta({ example: 'clx1234567890' }),
                sceneId: z.string().meta({ example: 'clx1234567890' }),
                sceneName: z.string().meta({ example: 'Scene 1' }),
                chapterName: z.string().meta({ example: 'Chapter 1' }),
                sortOrder: z.number().int().meta({ example: 0 }),
                content: z.string().meta({ example: 'The story content...' }),
                instruction: z.string().nullable().meta({ example: 'Write a dramatic scene' }),
                createdAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
                updatedAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
              }),
            ),
            pagination: z.strictObject({
              total: z.number().int().meta({ example: 10 }),
              limit: z.number().int().meta({ example: 50 }),
              offset: z.number().int().meta({ example: 0 }),
            }),
          }),
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
        const { limit, offset } = request.query

        // Verify story exists and user owns it
        const story = await prisma.story.findFirst({
          where: {
            id,
            ownerId: userId,
          },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Count total deleted messages
        const total = await prisma.message.count({
          where: {
            deleted: true,
            scene: {
              chapter: {
                arc: {
                  book: {
                    storyId: id,
                  },
                },
              },
            },
          },
        })

        // Fetch deleted messages with their content
        const deletedMessages = await prisma.message.findMany({
          where: {
            deleted: true,
            scene: {
              chapter: {
                arc: {
                  book: {
                    storyId: id,
                  },
                },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          skip: offset,
          take: limit,
          include: {
            scene: {
              include: {
                chapter: true,
              },
            },
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
        })

        // Transform to response format
        const messages = deletedMessages.map((msg) => {
          // Combine paragraph bodies into content
          const content = msg.currentMessageRevision?.paragraphs
            .map((p) => p.currentParagraphRevision?.body ?? '')
            .filter((body) => body.length > 0)
            .join('\n\n') ?? ''

          return {
            id: msg.id,
            sceneId: msg.sceneId,
            sceneName: msg.scene.name,
            chapterName: msg.scene.chapter.name,
            sortOrder: msg.sortOrder,
            content,
            instruction: msg.instruction,
            createdAt: msg.createdAt.toISOString(),
            updatedAt: msg.updatedAt.toISOString(),
          }
        })

        return {
          messages,
          pagination: {
            total,
            limit,
            offset,
          },
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to list deleted messages')
        return reply.status(500).send({ error: 'Failed to list deleted messages' })
      }
    },
  )

  // POST /my/stories/:id/deleted-messages/:messageId/restore - Restore a deleted message
  fastify.post(
    '/:id/deleted-messages/:messageId/restore',
    {
      schema: {
        description: 'Restore a previously deleted message',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        params: z.strictObject({
          id: z.string().meta({
            description: 'Story ID',
            example: 'clx1234567890',
          }),
          messageId: z.string().meta({
            description: 'Message ID to restore',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: z.strictObject({
            success: z.literal(true),
            message: z.strictObject({
              id: z.string().meta({ example: 'clx1234567890' }),
              sceneId: z.string().meta({ example: 'clx1234567890' }),
              deleted: z.boolean().meta({ example: false }),
            }),
          }),
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { id, messageId } = request.params

        // Verify story exists and user owns it
        const story = await prisma.story.findFirst({
          where: {
            id,
            ownerId: userId,
          },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Find the deleted message and verify it belongs to this story
        const message = await prisma.message.findFirst({
          where: {
            id: messageId,
            deleted: true,
            scene: {
              chapter: {
                arc: {
                  book: {
                    storyId: id,
                  },
                },
              },
            },
          },
        })

        if (!message) {
          return reply.status(404).send({ error: 'Deleted message not found' })
        }

        // Restore the message
        const restoredMessage = await prisma.message.update({
          where: { id: messageId },
          data: { deleted: false },
        })

        fastify.log.info({ storyId: id, messageId, userId }, 'Message restored')

        return {
          success: true as const,
          message: {
            id: restoredMessage.id,
            sceneId: restoredMessage.sceneId,
            deleted: restoredMessage.deleted,
          },
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to restore message')
        return reply.status(500).send({ error: 'Failed to restore message' })
      }
    },
  )

  // ============================================================================
  // DELETED NODES (Books, Arcs, Chapters, Scenes)
  // ============================================================================

  const deletedNodeSchema = z.strictObject({
    id: z.string().meta({ example: 'clx1234567890' }),
    name: z.string().meta({ example: 'Chapter 1' }),
    type: z.enum(['book', 'arc', 'chapter', 'scene']).meta({ example: 'chapter' }),
    parentName: z.string().nullable().meta({ example: 'Arc 1' }),
    deletedAt: z.string().datetime().nullable().meta({ example: '2025-12-27T12:00:00.000Z' }),
  })

  // GET /my/stories/:id/deleted-nodes - List all deleted nodes for a story
  fastify.get(
    '/:id/deleted-nodes',
    {
      schema: {
        description: 'List all deleted nodes (books, arcs, chapters, scenes) for a story',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        response: {
          200: z.strictObject({
            nodes: z.array(deletedNodeSchema),
          }),
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

        // Verify story exists and user owns it
        const story = await prisma.story.findFirst({
          where: { id, ownerId: userId },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Fetch all deleted nodes
        const [deletedBooks, deletedArcs, deletedChapters, deletedScenes] = await Promise.all([
          prisma.book.findMany({
            where: { storyId: id, deleted: true },
            select: { id: true, name: true, deletedAt: true },
            orderBy: { deletedAt: 'desc' },
          }),
          prisma.arc.findMany({
            where: { book: { storyId: id }, deleted: true },
            select: { id: true, name: true, deletedAt: true, book: { select: { name: true } } },
            orderBy: { deletedAt: 'desc' },
          }),
          prisma.chapter.findMany({
            where: { arc: { book: { storyId: id } }, deleted: true },
            select: { id: true, name: true, deletedAt: true, arc: { select: { name: true } } },
            orderBy: { deletedAt: 'desc' },
          }),
          prisma.scene.findMany({
            where: { chapter: { arc: { book: { storyId: id } } }, deleted: true },
            select: {
              id: true,
              name: true,
              deletedAt: true,
              chapter: { select: { name: true } },
            },
            orderBy: { deletedAt: 'desc' },
          }),
        ])

        const nodes = [
          ...deletedBooks.map((b) => ({
            id: b.id,
            name: b.name,
            type: 'book' as const,
            parentName: null,
            deletedAt: b.deletedAt?.toISOString() ?? null,
          })),
          ...deletedArcs.map((a) => ({
            id: a.id,
            name: a.name,
            type: 'arc' as const,
            parentName: a.book.name,
            deletedAt: a.deletedAt?.toISOString() ?? null,
          })),
          ...deletedChapters.map((c) => ({
            id: c.id,
            name: c.name,
            type: 'chapter' as const,
            parentName: c.arc.name,
            deletedAt: c.deletedAt?.toISOString() ?? null,
          })),
          ...deletedScenes.map((s) => ({
            id: s.id,
            name: s.name,
            type: 'scene' as const,
            parentName: s.chapter.name,
            deletedAt: s.deletedAt?.toISOString() ?? null,
          })),
        ]

        // Sort by deletedAt descending
        nodes.sort((a, b) => {
          if (!a.deletedAt) return 1
          if (!b.deletedAt) return -1
          return new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
        })

        return { nodes }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to list deleted nodes')
        return reply.status(500).send({ error: 'Failed to list deleted nodes' })
      }
    },
  )

  // POST /my/stories/:id/deleted-scenes/:sceneId/restore - Restore a deleted scene
  fastify.post(
    '/:id/deleted-scenes/:sceneId/restore',
    {
      schema: {
        description: 'Restore a deleted scene and all its messages',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        params: z.strictObject({
          id: z.string().meta({ description: 'Story ID', example: 'clx1234567890' }),
          sceneId: z.string().meta({ description: 'Scene ID', example: 'clx1234567890' }),
        }),
        response: {
          200: successSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { id, sceneId } = request.params

        // Verify story exists and user owns it
        const story = await prisma.story.findFirst({
          where: { id, ownerId: userId },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Find the deleted scene
        const scene = await prisma.scene.findFirst({
          where: {
            id: sceneId,
            deleted: true,
            chapter: { arc: { book: { storyId: id } } },
          },
        })

        if (!scene) {
          return reply.status(404).send({ error: 'Deleted scene not found' })
        }

        // Restore scene and its messages
        await prisma.$transaction([
          prisma.scene.update({
            where: { id: sceneId },
            data: { deleted: false, deletedAt: null },
          }),
          prisma.message.updateMany({
            where: { sceneId },
            data: { deleted: false },
          }),
        ])

        fastify.log.info({ storyId: id, sceneId, userId }, 'Scene restored')

        return { success: true as const }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to restore scene')
        return reply.status(500).send({ error: 'Failed to restore scene' })
      }
    },
  )

  // POST /my/stories/:id/deleted-chapters/:chapterId/restore - Restore a deleted chapter
  fastify.post(
    '/:id/deleted-chapters/:chapterId/restore',
    {
      schema: {
        description: 'Restore a deleted chapter and all its scenes and messages',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        params: z.strictObject({
          id: z.string().meta({ description: 'Story ID', example: 'clx1234567890' }),
          chapterId: z.string().meta({ description: 'Chapter ID', example: 'clx1234567890' }),
        }),
        response: {
          200: successSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { id, chapterId } = request.params

        // Verify story exists and user owns it
        const story = await prisma.story.findFirst({
          where: { id, ownerId: userId },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Find the deleted chapter with its scenes
        const chapter = await prisma.chapter.findFirst({
          where: {
            id: chapterId,
            deleted: true,
            arc: { book: { storyId: id } },
          },
          include: { scenes: { select: { id: true } } },
        })

        if (!chapter) {
          return reply.status(404).send({ error: 'Deleted chapter not found' })
        }

        // Restore chapter, its scenes, and their messages
        const sceneIds = chapter.scenes.map((s) => s.id)
        await prisma.$transaction([
          prisma.chapter.update({
            where: { id: chapterId },
            data: { deleted: false, deletedAt: null },
          }),
          prisma.scene.updateMany({
            where: { chapterId },
            data: { deleted: false, deletedAt: null },
          }),
          prisma.message.updateMany({
            where: { sceneId: { in: sceneIds } },
            data: { deleted: false },
          }),
        ])

        fastify.log.info({ storyId: id, chapterId, userId }, 'Chapter restored')

        return { success: true as const }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to restore chapter')
        return reply.status(500).send({ error: 'Failed to restore chapter' })
      }
    },
  )

  // POST /my/stories/:id/deleted-arcs/:arcId/restore - Restore a deleted arc
  fastify.post(
    '/:id/deleted-arcs/:arcId/restore',
    {
      schema: {
        description: 'Restore a deleted arc and all its chapters, scenes, and messages',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        params: z.strictObject({
          id: z.string().meta({ description: 'Story ID', example: 'clx1234567890' }),
          arcId: z.string().meta({ description: 'Arc ID', example: 'clx1234567890' }),
        }),
        response: {
          200: successSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { id, arcId } = request.params

        // Verify story exists and user owns it
        const story = await prisma.story.findFirst({
          where: { id, ownerId: userId },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Find the deleted arc with its chapters and scenes
        const arc = await prisma.arc.findFirst({
          where: {
            id: arcId,
            deleted: true,
            book: { storyId: id },
          },
          include: {
            chapters: {
              select: { id: true, scenes: { select: { id: true } } },
            },
          },
        })

        if (!arc) {
          return reply.status(404).send({ error: 'Deleted arc not found' })
        }

        // Restore arc, its chapters, scenes, and messages
        const chapterIds = arc.chapters.map((c) => c.id)
        const sceneIds = arc.chapters.flatMap((c) => c.scenes.map((s) => s.id))
        await prisma.$transaction([
          prisma.arc.update({
            where: { id: arcId },
            data: { deleted: false, deletedAt: null },
          }),
          prisma.chapter.updateMany({
            where: { arcId },
            data: { deleted: false, deletedAt: null },
          }),
          prisma.scene.updateMany({
            where: { chapterId: { in: chapterIds } },
            data: { deleted: false, deletedAt: null },
          }),
          prisma.message.updateMany({
            where: { sceneId: { in: sceneIds } },
            data: { deleted: false },
          }),
        ])

        fastify.log.info({ storyId: id, arcId, userId }, 'Arc restored')

        return { success: true as const }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to restore arc')
        return reply.status(500).send({ error: 'Failed to restore arc' })
      }
    },
  )

  // POST /my/stories/:id/deleted-books/:bookId/restore - Restore a deleted book
  fastify.post(
    '/:id/deleted-books/:bookId/restore',
    {
      schema: {
        description: 'Restore a deleted book and all its arcs, chapters, scenes, and messages',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        params: z.strictObject({
          id: z.string().meta({ description: 'Story ID', example: 'clx1234567890' }),
          bookId: z.string().meta({ description: 'Book ID', example: 'clx1234567890' }),
        }),
        response: {
          200: successSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { id, bookId } = request.params

        // Verify story exists and user owns it
        const story = await prisma.story.findFirst({
          where: { id, ownerId: userId },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Find the deleted book with its arcs, chapters, and scenes
        const book = await prisma.book.findFirst({
          where: {
            id: bookId,
            deleted: true,
            storyId: id,
          },
          include: {
            arcs: {
              select: {
                id: true,
                chapters: {
                  select: { id: true, scenes: { select: { id: true } } },
                },
              },
            },
          },
        })

        if (!book) {
          return reply.status(404).send({ error: 'Deleted book not found' })
        }

        // Restore book, its arcs, chapters, scenes, and messages
        const arcIds = book.arcs.map((a) => a.id)
        const chapterIds = book.arcs.flatMap((a) => a.chapters.map((c) => c.id))
        const sceneIds = book.arcs.flatMap((a) =>
          a.chapters.flatMap((c) => c.scenes.map((s) => s.id)),
        )
        await prisma.$transaction([
          prisma.book.update({
            where: { id: bookId },
            data: { deleted: false, deletedAt: null },
          }),
          prisma.arc.updateMany({
            where: { bookId },
            data: { deleted: false, deletedAt: null },
          }),
          prisma.chapter.updateMany({
            where: { arcId: { in: arcIds } },
            data: { deleted: false, deletedAt: null },
          }),
          prisma.scene.updateMany({
            where: { chapterId: { in: chapterIds } },
            data: { deleted: false, deletedAt: null },
          }),
          prisma.message.updateMany({
            where: { sceneId: { in: sceneIds } },
            data: { deleted: false },
          }),
        ])

        fastify.log.info({ storyId: id, bookId, userId }, 'Book restored')

        return { success: true as const }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to restore book')
        return reply.status(500).send({ error: 'Failed to restore book' })
      }
    },
  )

  // Bulk reorder nodes (books, arcs, chapters, scenes)
  fastify.post(
    '/:storyId/nodes/reorder',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Bulk reorder nodes (books, arcs, chapters, scenes) within a story',
        tags: ['stories'],
        params: z.strictObject({
          storyId: z.string().meta({
            description: 'Story ID',
            example: 'clx1234567890',
          }),
        }),
        body: z.strictObject({
          items: z
            .array(
              z.strictObject({
                nodeId: z.string().meta({ description: 'Node ID to update' }),
                nodeType: z.enum(['book', 'arc', 'chapter', 'scene']).meta({ description: 'Type of node' }),
                parentId: z.string().nullable().meta({ description: 'Parent node ID (null for books)' }),
                order: z.number().int().min(0).meta({ description: 'New sort order' }),
              }),
            )
            .meta({
              description: 'Array of node updates',
            }),
        }),
        response: {
          200: z.strictObject({
            success: z.literal(true),
            updatedAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
          }),
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { storyId } = request.params
      const { items } = request.body
      const userId = request.user!.id

      // Verify story exists and user owns it
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        select: { ownerId: true },
      })

      if (!story) {
        return reply.code(404).send({ error: 'Story not found' })
      }

      if (story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Story not found' })
      }

      if (items.length === 0) {
        return {
          success: true as const,
          updatedAt: new Date().toISOString(),
        }
      }

      // Group items by type for batch updates
      const books = items.filter((i) => i.nodeType === 'book')
      const arcs = items.filter((i) => i.nodeType === 'arc')
      const chapters = items.filter((i) => i.nodeType === 'chapter')
      const scenes = items.filter((i) => i.nodeType === 'scene')

      const updatedAt = new Date()

      // Update all nodes in a transaction
      await prisma.$transaction([
        // Update books
        ...books.map((item) =>
          prisma.book.update({
            where: { id: item.nodeId },
            data: {
              sortOrder: item.order,
              updatedAt,
            },
          }),
        ),
        // Update arcs
        ...arcs.map((item) =>
          prisma.arc.update({
            where: { id: item.nodeId },
            data: {
              bookId: item.parentId!,
              sortOrder: item.order,
              updatedAt,
            },
          }),
        ),
        // Update chapters
        ...chapters.map((item) =>
          prisma.chapter.update({
            where: { id: item.nodeId },
            data: {
              arcId: item.parentId!,
              sortOrder: item.order,
              updatedAt,
            },
          }),
        ),
        // Update scenes
        ...scenes.map((item) =>
          prisma.scene.update({
            where: { id: item.nodeId },
            data: {
              chapterId: item.parentId!,
              sortOrder: item.order,
              updatedAt,
            },
          }),
        ),
      ])

      return {
        success: true as const,
        updatedAt: updatedAt.toISOString(),
      }
    },
  )
}

export default myStoriesRoutes
