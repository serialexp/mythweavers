import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

// Node type schema
const nodeTypeSchema = z.enum(['story', 'non-story', 'context']).meta({
  description: 'Node type (story content, non-story, or context)',
  example: 'story',
})

// Book response schema
const bookSchema = z.strictObject({
  id: z.string().meta({
    description: 'Book ID',
    example: 'clx1234567890',
  }),
  name: z.string().meta({
    description: 'Book name/title',
    example: 'Book One: The Beginning',
  }),
  summary: z.string().nullable().meta({
    description: 'Book summary/description',
    example: 'The journey begins...',
  }),
  storyId: z.string().meta({
    description: 'Parent story ID',
    example: 'clx9876543210',
  }),
  sortOrder: z.number().meta({
    description: 'Sort order within story',
    example: 0,
  }),
  nodeType: nodeTypeSchema,
  pages: z.number().nullable().meta({
    description: 'Estimated page count',
    example: 250,
  }),
  coverArtFileId: z.string().nullable().meta({
    description: 'Cover art file ID',
    example: 'clx1234567890',
  }),
  spineArtFileId: z.string().nullable().meta({
    description: 'Spine art file ID',
    example: 'clx1234567890',
  }),
  deleted: z.boolean().meta({
    description: 'Whether the book is soft-deleted',
    example: false,
  }),
  deletedAt: z.string().nullable().meta({
    description: 'When the book was deleted',
    example: null,
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

// Create book request body
const createBookBodySchema = z.strictObject({
  id: z.string().optional().meta({
    description: 'Optional client-provided ID (must be unique)',
    example: 'clx1234567890',
  }),
  name: z.string().min(1).max(200).meta({
    description: 'Book name/title',
    example: 'Book One: The Beginning',
  }),
  summary: z.string().optional().meta({
    description: 'Book summary/description',
    example: 'The journey begins...',
  }),
  nodeType: nodeTypeSchema.optional(),
  sortOrder: z.number().int().optional().meta({
    description: 'Sort order within story (defaults to end)',
    example: 0,
  }),
})

// Update book request body (all fields optional)
const updateBookBodySchema = z.strictObject({
  name: z.string().min(1).max(200).optional().meta({
    description: 'Book name/title',
    example: 'Book One: The Beginning',
  }),
  summary: z.string().nullable().optional().meta({
    description: 'Book summary/description',
    example: 'The journey begins...',
  }),
  nodeType: nodeTypeSchema.optional(),
  sortOrder: z.number().int().optional().meta({
    description: 'Sort order within story',
    example: 0,
  }),
  pages: z.number().int().nullable().optional().meta({
    description: 'Estimated page count',
    example: 250,
  }),
})

// Path parameters
const storyIdParamSchema = z.strictObject({
  storyId: z.string().meta({
    description: 'Story ID',
    example: 'clx1234567890',
  }),
})

const bookIdParamSchema = z.strictObject({
  id: z.string().meta({
    description: 'Book ID',
    example: 'clx1234567890',
  }),
})

// Response schemas
const createBookResponseSchema = z.strictObject({
  success: z.literal(true),
  book: bookSchema,
})

const listBooksResponseSchema = z.strictObject({
  books: z.array(bookSchema),
})

const getBookResponseSchema = z.strictObject({
  book: bookSchema,
})

const updateBookResponseSchema = z.strictObject({
  success: z.literal(true),
  book: bookSchema,
})

const deleteBookResponseSchema = z.strictObject({
  success: z.literal(true),
})

// Helper to format book for response
function formatBook(book: any) {
  return {
    ...book,
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  }
}

const myBooksRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // POST /my/stories/:storyId/books - Create new book
  fastify.post(
    '/stories/:storyId/books',
    {
      schema: {
        description: 'Create a new book in a story',
        tags: ['my-books'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        body: createBookBodySchema,
        response: {
          201: createBookResponseSchema,
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
        const { storyId } = request.params
        const { id, name, summary, nodeType, sortOrder } = request.body

        // Verify story exists and is owned by user
        const story = await prisma.story.findFirst({
          where: {
            id: storyId,
            ownerId: userId,
          },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Determine sort order if not provided
        let finalSortOrder = sortOrder
        if (finalSortOrder === undefined) {
          const maxBook = await prisma.book.findFirst({
            where: { storyId },
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true },
          })
          finalSortOrder = maxBook ? maxBook.sortOrder + 1 : 0
        }

        const book = await prisma.book.create({
          data: {
            ...(id && { id }), // Use client-provided ID if present
            name,
            summary: summary || null,
            storyId,
            sortOrder: finalSortOrder,
            nodeType: nodeType || 'story',
          },
        })

        fastify.log.info({ bookId: book.id, storyId, userId }, 'Book created')

        return reply.status(201).send({
          success: true as const,
          book: formatBook(book),
        })
      } catch (error) {
        fastify.log.error({ error }, 'Failed to create book')
        return reply.status(500).send({ error: 'Failed to create book' })
      }
    },
  )

  // GET /my/stories/:storyId/books - List books in a story
  fastify.get(
    '/stories/:storyId/books',
    {
      schema: {
        description: 'List all books in a story',
        tags: ['my-books'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        response: {
          200: listBooksResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { storyId } = request.params

        // Verify story exists and is owned by user
        const story = await prisma.story.findFirst({
          where: {
            id: storyId,
            ownerId: userId,
          },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Get books (filter out deleted)
        const books = await prisma.book.findMany({
          where: { storyId, deleted: false },
          orderBy: { sortOrder: 'asc' },
        })

        return {
          books: books.map(formatBook),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to list books')
        return reply.status(500).send({ error: 'Failed to list books' })
      }
    },
  )

  // GET /my/books/:id - Get single book
  fastify.get(
    '/books/:id',
    {
      schema: {
        description: 'Get a single book by ID (must own the parent story)',
        tags: ['my-books'],
        security: [{ sessionAuth: [] }],
        params: bookIdParamSchema,
        response: {
          200: getBookResponseSchema,
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

        const book = await prisma.book.findFirst({
          where: {
            id,
            deleted: false,
            story: {
              ownerId: userId,
            },
          },
        })

        if (!book) {
          return reply.status(404).send({ error: 'Book not found' })
        }

        return {
          book: formatBook(book),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get book')
        return reply.status(500).send({ error: 'Failed to get book' })
      }
    },
  )

  // PATCH /my/books/:id - Update book
  fastify.patch(
    '/books/:id',
    {
      schema: {
        description: 'Update a book (must own the parent story)',
        tags: ['my-books'],
        security: [{ sessionAuth: [] }],
        params: bookIdParamSchema,
        body: updateBookBodySchema,
        response: {
          200: updateBookResponseSchema,
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

        // Check if book exists and user owns the parent story
        const existingBook = await prisma.book.findFirst({
          where: {
            id,
            story: {
              ownerId: userId,
            },
          },
        })

        if (!existingBook) {
          return reply.status(404).send({ error: 'Book not found' })
        }

        // Update book
        const book = await prisma.book.update({
          where: { id },
          data: updates,
        })

        fastify.log.info({ bookId: book.id, userId }, 'Book updated')

        return {
          success: true as const,
          book: formatBook(book),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to update book')
        return reply.status(500).send({ error: 'Failed to update book' })
      }
    },
  )

  // DELETE /my/books/:id - Delete book
  fastify.delete(
    '/books/:id',
    {
      schema: {
        description:
          'Delete a book. By default performs soft delete; use ?permanent=true for hard delete.',
        tags: ['my-books'],
        security: [{ sessionAuth: [] }],
        params: bookIdParamSchema,
        querystring: z.strictObject({
          permanent: z
            .enum(['true', 'false'])
            .optional()
            .meta({
              description: 'If true, permanently delete (no recovery possible)',
              example: 'false',
            }),
        }),
        response: {
          200: deleteBookResponseSchema,
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
        const permanent = request.query.permanent === 'true'

        // Check if book exists and user owns the parent story
        const existingBook = await prisma.book.findFirst({
          where: {
            id,
            story: {
              ownerId: userId,
            },
          },
          include: {
            arcs: {
              select: {
                id: true,
                chapters: {
                  select: {
                    id: true,
                    scenes: { select: { id: true } },
                  },
                },
              },
            },
          },
        })

        if (!existingBook) {
          return reply.status(404).send({ error: 'Book not found' })
        }

        if (permanent) {
          // Hard delete - cascade will handle arcs/chapters/scenes/messages
          await prisma.book.delete({
            where: { id },
          })
          fastify.log.info({ bookId: id, userId }, 'Book permanently deleted')
        } else {
          // Soft delete - mark book, its arcs, chapters, scenes, and messages as deleted
          const now = new Date()
          const arcIds = existingBook.arcs.map((a) => a.id)
          const chapterIds = existingBook.arcs.flatMap((a) => a.chapters.map((c) => c.id))
          const sceneIds = existingBook.arcs.flatMap((a) =>
            a.chapters.flatMap((c) => c.scenes.map((s) => s.id)),
          )
          await prisma.$transaction([
            prisma.book.update({
              where: { id },
              data: { deleted: true, deletedAt: now },
            }),
            prisma.arc.updateMany({
              where: { bookId: id },
              data: { deleted: true, deletedAt: now },
            }),
            prisma.chapter.updateMany({
              where: { arcId: { in: arcIds } },
              data: { deleted: true, deletedAt: now },
            }),
            prisma.scene.updateMany({
              where: { chapterId: { in: chapterIds } },
              data: { deleted: true, deletedAt: now },
            }),
            prisma.message.updateMany({
              where: { sceneId: { in: sceneIds } },
              data: { deleted: true },
            }),
          ])
          fastify.log.info({ bookId: id, userId }, 'Book soft deleted')
        }

        return {
          success: true as const,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to delete book')
        return reply.status(500).send({ error: 'Failed to delete book' })
      }
    },
  )
}

export default myBooksRoutes
