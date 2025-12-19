import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { transformDates } from '../../lib/transform-dates.js'
import { errorSchema } from '../../schemas/common.js'

// ============================================================================
// SCHEMAS
// ============================================================================

const tagSchema = z.strictObject({
  id: z.string().meta({ example: 'clx1234567890' }),
  name: z.string().meta({ example: 'fantasy' }),
  createdAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
  updatedAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
})

const createTagBodySchema = z.strictObject({
  name: z.string().min(1).max(50).toLowerCase().meta({
    description: 'Tag name (lowercase, alphanumeric + hyphens)',
    example: 'fantasy',
  }),
})

const listTagsResponseSchema = z.strictObject({
  tags: z.array(tagSchema),
})

const createTagResponseSchema = z.strictObject({
  success: z.literal(true),
  tag: tagSchema,
  created: z.boolean().meta({
    description: 'Whether tag was newly created (true) or already existed (false)',
    example: true,
  }),
})

// ============================================================================
// ROUTES
// ============================================================================

const publicTagRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // List all tags
  fastify.get(
    '/tags',
    {
      schema: {
        description: 'List all available tags (global, shared across all users)',
        tags: ['tags'],
        querystring: z.strictObject({
          search: z.string().optional().meta({
            description: 'Search tags by name (case-insensitive)',
            example: 'fant',
          }),
          limit: z.coerce.number().int().positive().max(100).default(50).meta({
            description: 'Maximum number of tags to return',
            example: 50,
          }),
        }),
        response: {
          200: listTagsResponseSchema,
        },
      },
    },
    async (request, _reply) => {
      const { search, limit } = request.query

      // Build where clause
      const where = search
        ? {
            name: {
              contains: search.toLowerCase(),
            },
          }
        : {}

      const tags = await prisma.tag.findMany({
        where,
        orderBy: { name: 'asc' },
        take: limit,
      })

      return { tags: tags.map(transformDates) }
    },
  )

  // Create or get existing tag
  fastify.post(
    '/tags',
    {
      schema: {
        description: 'Create a new tag or get existing one (idempotent, returns existing if tag name already exists)',
        tags: ['tags'],
        body: createTagBodySchema,
        response: {
          201: createTagResponseSchema,
          400: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { name } = request.body

      // Normalize tag name (lowercase, trim)
      const normalizedName = name.trim().toLowerCase()

      // Validate format (alphanumeric + hyphens only)
      if (!/^[a-z0-9-]+$/.test(normalizedName)) {
        return reply.code(400).send({
          error: 'Tag name can only contain lowercase letters, numbers, and hyphens',
        })
      }

      // Try to find existing tag
      let tag = await prisma.tag.findUnique({
        where: { name: normalizedName },
      })

      let created = false

      // Create if doesn't exist
      if (!tag) {
        tag = await prisma.tag.create({
          data: { name: normalizedName },
        })
        created = true
      }

      return reply.code(201).send({
        success: true as const,
        tag: transformDates(tag),
        created,
      })
    },
  )
}

export default publicTagRoutes
