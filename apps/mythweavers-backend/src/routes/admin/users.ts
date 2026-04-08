import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAdmin } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'

const errorSchema = z.object({ error: z.string() })

const adminUserSchema = z.object({
  id: z.number(),
  email: z.string(),
  username: z.string(),
  role: z.string(),
  avatarUrl: z.string().nullable(),
  balance: z.string().meta({ description: 'User balance as string (Decimal)' }),
  createdAt: z.string(),
  updatedAt: z.string(),
  _count: z.object({
    ownedStories: z.number(),
    sessions: z.number(),
  }),
})

const idParam = z.object({ id: z.coerce.number().int() })

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1).meta({ description: 'Page number', example: 1 }),
  pageSize: z.coerce.number().int().positive().max(100).default(50).meta({ description: 'Items per page', example: 50 }),
  search: z.string().optional().meta({ description: 'Search by username or email' }),
})

/** Shared select for user queries — avoids returning passwordHash */
const userSelect = {
  id: true,
  email: true,
  username: true,
  role: true,
  avatarUrl: true,
  balance: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      ownedStories: true,
      sessions: true,
    },
  },
} as const

type UserFromSelect = Awaited<ReturnType<typeof prisma.user.findFirstOrThrow<{ select: typeof userSelect }>>>

function serializeUser(u: UserFromSelect) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    avatarUrl: u.avatarUrl,
    balance: u.balance.toString(),
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    _count: u._count,
  }
}

const adminUsersRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /** List all users with pagination */
  fastify.get(
    '/users',
    {
      preHandler: requireAdmin,
      schema: {
        description: 'List all users with pagination and optional search',
        tags: ['admin-users'],
        querystring: paginationQuery,
        response: {
          200: z.object({
            users: z.array(adminUserSchema),
            pagination: z.object({
              page: z.number(),
              pageSize: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
          401: errorSchema,
          403: errorSchema,
        },
      },
    },
    async (request) => {
      const { page, pageSize, search } = request.query

      const where = search
        ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: userSelect,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.user.count({ where }),
      ])

      return {
        users: users.map(serializeUser),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      }
    },
  )

  /** Get single user */
  fastify.get(
    '/users/:id',
    {
      preHandler: requireAdmin,
      schema: {
        description: 'Get a single user by ID',
        tags: ['admin-users'],
        params: idParam,
        response: {
          200: z.object({ user: adminUserSchema }),
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.params.id },
        select: userSelect,
      })
      if (!user) return reply.status(404).send({ error: 'User not found' })

      return { user: serializeUser(user) }
    },
  )

  /** Update user role */
  fastify.put(
    '/users/:id',
    {
      preHandler: requireAdmin,
      schema: {
        description: 'Update a user (role, etc.)',
        tags: ['admin-users'],
        params: idParam,
        body: z.object({
          role: z.enum(['user', 'admin']).optional().meta({ description: 'User role' }),
        }),
        response: {
          200: z.object({ user: adminUserSchema }),
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const user = await prisma.user.update({
          where: { id: request.params.id },
          data: request.body,
          select: userSelect,
        })
        return { user: serializeUser(user) }
      } catch (err: any) {
        if (err.code === 'P2025') {
          return reply.status(404).send({ error: 'User not found' })
        }
        throw err
      }
    },
  )

  /** Adjust user balance (creates a ledger entry) */
  fastify.post(
    '/users/:id/balance',
    {
      preHandler: requireAdmin,
      schema: {
        description: 'Adjust a user balance. Positive amount = add credit, negative = deduct.',
        tags: ['admin-users'],
        params: idParam,
        body: z.object({
          amount: z.number().meta({ description: 'Amount to adjust (positive = credit, negative = debit)', example: 10.0 }),
          description: z.string().min(1).meta({ description: 'Reason for the adjustment', example: 'Top-up' }),
        }),
        response: {
          200: z.object({
            user: adminUserSchema,
            ledgerEntry: z.object({
              id: z.string(),
              amount: z.string(),
              balanceAfter: z.string(),
              type: z.string(),
              description: z.string(),
              createdAt: z.string(),
            }),
          }),
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { amount, description } = request.body
      const userId = request.params.id

      const existing = await prisma.user.findUnique({ where: { id: userId } })
      if (!existing) return reply.status(404).send({ error: 'User not found' })

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: userId },
          data: { balance: { increment: amount } },
          select: userSelect,
        })

        const entry = await tx.balanceLedger.create({
          data: {
            userId,
            amount,
            balanceAfter: updated.balance,
            type: amount >= 0 ? 'CREDIT' : 'ADJUSTMENT',
            description,
          },
        })

        return { user: updated, entry }
      })

      return {
        user: serializeUser(result.user),
        ledgerEntry: {
          id: result.entry.id,
          amount: result.entry.amount.toString(),
          balanceAfter: result.entry.balanceAfter.toString(),
          type: result.entry.type,
          description: result.entry.description,
          createdAt: result.entry.createdAt.toISOString(),
        },
      }
    },
  )
}

export default adminUsersRoutes
