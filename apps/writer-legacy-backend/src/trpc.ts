import { TRPCError, initTRPC } from '@trpc/server'
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify'
import { prisma } from './prisma.js'

export const createContext = (
  opts: CreateFastifyContextOptions,
): {
  token: string | undefined
} => {
  return {
    token: opts.req.headers.authorization?.replace('Bearer ', ''),
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<typeof createContext>().create()

// Logging middleware
const _isProduction = process.env.NODE_ENV === 'production'
const logger = t.middleware(async (opts) => {
  try {
    const result = await opts.next()

    console.log({
      path: opts.path,
      type: opts.type,
      results: result.ok && Array.isArray(result.data) ? result.data.length : undefined,
      ok: result.ok,
      error: result.ok === false ? result.error : undefined,
    })

    return result
  } catch (error) {
    console.log(error)
    throw error
  }
})

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router
export const publicProcedure = t.procedure.use(logger)
export const protectedProcedure = publicProcedure.use(logger).use(async (opts) => {
  const accessToken = await prisma.accessKey.findFirst({
    where: {
      key: opts.ctx.token,
    },
    include: {
      owner: true,
    },
  })

  const session = await prisma.session.findFirst({
    where: {
      id: opts.ctx.token,
      validUntil: {
        gt: new Date(),
      },
    },
    include: {
      owner: true,
    },
  })

  if (!session && !accessToken) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You are not authorized to access this resource.',
    })
  }

  if (accessToken) {
    const _accessKey = await prisma.accessKey.update({
      where: {
        key: opts.ctx.token,
      },
      data: {
        lastUsedAt: new Date(),
      },
    })
  }

  if (session) {
    const _session = await prisma.session.update({
      where: {
        id: opts.ctx.token,
      },
      data: {
        // valid for 1 day
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    })
  }

  const authenticatedUser = session?.owner ?? accessToken?.owner

  if (!authenticatedUser) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You are not authorized to access this resource.',
    })
  }

  const result = await opts.next({
    ctx: {
      accessKey: accessToken,
      session: session,
      authenticatedUser: authenticatedUser,
    },
  })
  return result
})

export const adminProcedure = protectedProcedure.use(async (opts) => {
  const authenticatedUser = opts.ctx.authenticatedUser

  if (authenticatedUser.role !== 'admin') {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You are not authorized to access this resource.',
    })
  }

  return opts.next()
})
