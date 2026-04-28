import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'
import { formatPublicStory, publicStorySchema, storyVisibleWhere } from '../../schemas/story.js'

/**
 * Public author/profile endpoints — readers want to browse by author and see
 * a single author's published catalog. We expose only the fields the reader
 * actually needs (id, username, avatarUrl, story counts) and only count
 * publicly-visible stories so unpublished work stays private.
 */

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const authorSummarySchema = z.strictObject({
  id: z.number().meta({
    description: 'Author user ID',
    example: 1,
  }),
  username: z.string().meta({
    description: 'Author username',
    example: 'johndoe',
  }),
  avatarUrl: z.string().nullable().meta({
    description: "Resolved URL of the author's avatar image, or null if none.",
    example: '/files/1/2025/12/avatar.png',
  }),
  storyCount: z.number().int().nonnegative().meta({
    description: 'Number of publicly-visible stories the author has published.',
    example: 7,
  }),
})

const listAuthorsQuerySchema = z.strictObject({
  page: z.coerce.number().int().positive().default(1).meta({
    description: 'Page number',
    example: 1,
  }),
  pageSize: z.coerce.number().int().positive().max(100).default(50).meta({
    description: 'Items per page (max 100)',
    example: 50,
  }),
  search: z.string().optional().meta({
    description: 'Filter by username (case-insensitive substring match)',
    example: 'jane',
  }),
})

const listAuthorsResponseSchema = z.strictObject({
  authors: z.array(authorSummarySchema),
})

const authorIdParamSchema = z.strictObject({
  id: z.coerce.number().int().positive().meta({
    description: 'Author user ID',
    example: 1,
  }),
})

const getAuthorResponseSchema = z.strictObject({
  author: authorSummarySchema,
  stories: z.array(publicStorySchema),
})

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const authorsPublicRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * List authors who have at least one publicly-visible story. The
   * `storyCount` is computed from `Story.publishedAt`, not the legacy
   * `published` boolean — same visibility rule as the public stories list.
   */
  fastify.get(
    '/',
    {
      schema: {
        description: 'List authors with at least one publicly-visible story.',
        tags: ['authors'],
        querystring: listAuthorsQuerySchema,
        response: {
          200: listAuthorsResponseSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { page, pageSize, search } = request.query
        const now = new Date()

        // Group visible stories by owner. Pulling counts via groupBy keeps
        // this O(authors-with-stories) rather than O(users) and avoids a
        // per-user count query.
        const grouped = await prisma.story.groupBy({
          by: ['ownerId'],
          where: storyVisibleWhere(now),
          _count: { _all: true },
        })

        const ownerIds = grouped.map((g) => g.ownerId)
        if (ownerIds.length === 0) {
          return { authors: [] }
        }

        const users = await prisma.user.findMany({
          where: {
            id: { in: ownerIds },
            ...(search ? { username: { contains: search, mode: 'insensitive' } } : {}),
          },
          select: { id: true, username: true, avatarUrl: true },
          orderBy: { username: 'asc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        })

        const countByOwner = new Map(grouped.map((g) => [g.ownerId, g._count._all]))
        const authors = users.map((u) => ({
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl,
          storyCount: countByOwner.get(u.id) ?? 0,
        }))

        return { authors }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to list authors')
        return reply.status(500).send({ error: 'Failed to list authors' })
      }
    },
  )

  /**
   * Single-author view: the author's user info plus their full
   * publicly-visible catalog. Stories are ordered most-recently-updated first
   * so a returning reader sees newly-released chapters at the top.
   */
  fastify.get(
    '/:id',
    {
      schema: {
        description: "Get an author's profile and their publicly-visible stories.",
        tags: ['authors'],
        params: authorIdParamSchema,
        response: {
          200: getAuthorResponseSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params
        const now = new Date()

        const user = await prisma.user.findUnique({
          where: { id },
          select: { id: true, username: true, avatarUrl: true },
        })

        if (!user) {
          return reply.status(404).send({ error: 'Author not found' })
        }

        const stories = await prisma.story.findMany({
          where: {
            ownerId: id,
            ...storyVisibleWhere(now),
          },
          include: {
            owner: { select: { id: true, username: true } },
            coverArtFile: true,
          },
          orderBy: { updatedAt: 'desc' },
        })

        return {
          author: {
            id: user.id,
            username: user.username,
            avatarUrl: user.avatarUrl,
            storyCount: stories.length,
          },
          stories: stories.map(formatPublicStory),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get author')
        return reply.status(500).send({ error: 'Failed to get author' })
      }
    },
  )
}

export default authorsPublicRoutes
