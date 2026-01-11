import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { authConfig, getCookieOptions } from '../../lib/config.js'
import { prisma } from '../../lib/prisma.js'

const scryptAsync = promisify(scrypt)

// Zod schemas with OpenAPI metadata
const registerBodySchema = z.strictObject({
  email: z.string().email().meta({
    description: 'User email address',
    example: 'user@example.com',
  }),
  username: z.string().min(3).max(50).meta({
    description: 'Username (3-50 characters)',
    example: 'johndoe',
  }),
  password: z.string().min(8).meta({
    description: 'Password (minimum 8 characters)',
    example: 'secure-password-123',
  }),
})

const loginBodySchema = z.strictObject({
  username: z.string().min(1).meta({
    description: 'Username or email',
    example: 'johndoe',
  }),
  password: z.string().min(1).meta({
    description: 'Password',
    example: 'secure-password-123',
  }),
})

const userResponseSchema = z.strictObject({
  id: z.number().meta({ example: 1 }),
  email: z.string().email().meta({ example: 'user@example.com' }),
  username: z.string().meta({ example: 'johndoe' }),
})

const authSuccessSchema = z.strictObject({
  success: z.literal(true),
  user: userResponseSchema,
})

const errorSchema = z.strictObject({
  error: z.string().meta({ example: 'Invalid credentials' }),
})

const sessionResponseSchema = z.strictObject({
  authenticated: z.boolean().meta({ example: true }),
  user: userResponseSchema.optional(),
})

const logoutResponseSchema = z.strictObject({
  success: z.literal(true),
})

const authRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // POST /auth/register
  fastify.post(
    '/register',
    {
      schema: {
        description: 'Register a new user account',
        tags: ['auth'],
        body: registerBodySchema,
        response: {
          200: authSuccessSchema,
          400: errorSchema,
          409: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { email, username, password } = request.body

        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
          },
        })

        if (existingUser) {
          return reply.status(409).send({
            error: existingUser.email === email.toLowerCase() ? 'Email already registered' : 'Username already taken',
          })
        }

        // Hash password with scrypt
        const salt = randomBytes(16).toString('hex')
        const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
        const passwordHash = `${salt}:${derivedKey.toString('hex')}`

        // Create user
        const user = await prisma.user.create({
          data: {
            email: email.toLowerCase(),
            username: username.toLowerCase(),
            passwordHash,
          },
        })

        fastify.log.info({ userId: user.id, username: user.username }, 'User registered')

        // Create session
        const sessionToken = randomBytes(32).toString('hex')
        const expiresAt = new Date(Date.now() + authConfig.sessionDuration)

        await prisma.session.create({
          data: {
            userId: user.id,
            token: sessionToken,
            expiresAt,
          },
        })

        // Set cookie
        reply.setCookie('sessionToken', sessionToken, getCookieOptions())

        return {
          success: true as const,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
          },
        }
      } catch (error) {
        fastify.log.error({ error }, 'Registration failed')
        return reply.status(500).send({ error: 'Registration failed' })
      }
    },
  )

  // POST /auth/login
  fastify.post(
    '/login',
    {
      schema: {
        description: 'Login to an existing account',
        tags: ['auth'],
        body: loginBodySchema,
        response: {
          200: authSuccessSchema,
          400: errorSchema,
          401: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { username, password } = request.body

        // Find user by username or email
        const user = await prisma.user.findFirst({
          where: {
            OR: [{ email: username.toLowerCase() }, { username: username.toLowerCase() }],
          },
        })

        if (!user) {
          return reply.status(401).send({ error: 'Invalid credentials' })
        }

        // Verify password
        const [salt, storedHash] = user.passwordHash.split(':')
        const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
        const derivedHash = derivedKey.toString('hex')

        if (storedHash !== derivedHash) {
          return reply.status(401).send({ error: 'Invalid credentials' })
        }

        // Clean up old sessions for this user
        await prisma.session.deleteMany({
          where: {
            userId: user.id,
            expiresAt: { lt: new Date() },
          },
        })

        // Create new session
        const sessionToken = randomBytes(32).toString('hex')
        const expiresAt = new Date(Date.now() + authConfig.sessionDuration)

        await prisma.session.create({
          data: {
            userId: user.id,
            token: sessionToken,
            expiresAt,
          },
        })

        // Set cookie
        reply.setCookie('sessionToken', sessionToken, getCookieOptions())

        fastify.log.info({ userId: user.id, username: user.username }, 'User logged in')

        return {
          success: true as const,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
          },
        }
      } catch (error) {
        fastify.log.error({ error }, 'Login failed')
        return reply.status(500).send({ error: 'Login failed' })
      }
    },
  )

  // POST /auth/logout
  fastify.post(
    '/logout',
    {
      schema: {
        description: 'Logout and invalidate current session',
        tags: ['auth'],
        response: {
          200: logoutResponseSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const token = request.cookies.sessionToken

        if (token) {
          await prisma.session.deleteMany({
            where: { token },
          })
        }

        reply.clearCookie('sessionToken', getCookieOptions())

        return { success: true as const }
      } catch (error) {
        fastify.log.error({ error }, 'Logout failed')
        return reply.status(500).send({ error: 'Logout failed' })
      }
    },
  )

  // GET /auth/session
  fastify.get(
    '/session',
    {
      schema: {
        description: 'Check current session status and get user info',
        tags: ['auth'],
        response: {
          200: sessionResponseSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const token = request.cookies.sessionToken

        if (!token) {
          return { authenticated: false }
        }

        // Find session and check if it's valid
        const session = await prisma.session.findUnique({
          where: { token },
          include: { user: true },
        })

        if (!session || session.expiresAt < new Date()) {
          if (session) {
            await prisma.session.delete({
              where: { id: session.id },
            })
          }
          return { authenticated: false }
        }

        // Refresh session expiry
        const newExpiresAt = new Date(Date.now() + authConfig.sessionDuration)
        await prisma.session.update({
          where: { id: session.id },
          data: { expiresAt: newExpiresAt },
        })

        // Check if cookie should be refreshed
        const sessionAge = Date.now() - session.createdAt.getTime()
        const timeRemaining = authConfig.sessionDuration - sessionAge

        if (timeRemaining < authConfig.cookieRefreshThreshold) {
          reply.setCookie('sessionToken', token, getCookieOptions())
        }

        return {
          authenticated: true,
          user: {
            id: session.user.id,
            email: session.user.email,
            username: session.user.username,
          },
        }
      } catch (error) {
        fastify.log.error({ error }, 'Session check failed')
        return reply.status(500).send({ error: 'Session check failed' })
      }
    },
  )
}

export default authRoutes
