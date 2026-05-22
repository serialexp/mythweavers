import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { authConfig, getCookieOptions } from '../../lib/config.js'
import { prisma } from '../../lib/prisma.js'
import { preferencesSchema, type UserPreferences } from '../my/preferences.js'

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
  rememberMe: z.boolean().optional().meta({
    description:
      'When true, issue a long-lived (30 day) session instead of the default short-lived one. The chosen lifetime is preserved on every session refresh.',
    example: true,
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
  preferences: preferencesSchema.optional(),
})

const logoutResponseSchema = z.strictObject({
  success: z.literal(true),
})

const changePasswordBodySchema = z.strictObject({
  currentPassword: z.string().min(1).meta({
    description: 'The user\'s current password (required to authorise the change).',
    example: 'old-secure-password',
  }),
  newPassword: z.string().min(8).meta({
    description: 'New password (minimum 8 characters).',
    example: 'new-secure-password-456',
  }),
})

const changePasswordResponseSchema = z.strictObject({
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
          201: authSuccessSchema,
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

        return reply.status(201).send({
          success: true as const,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
          },
        })
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
        const { username, password, rememberMe } = request.body

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

        // Create new session. The chosen lifetime is the only place it's
        // recorded — sessions are NOT rolled forward on /auth/session, so
        // there's no need to remember which length the user picked. After
        // expiresAt elapses, the user logs in again.
        const sessionToken = randomBytes(32).toString('hex')
        const durationMs = rememberMe
          ? authConfig.extendedSessionDuration
          : authConfig.sessionDuration
        const expiresAt = new Date(Date.now() + durationMs)

        await prisma.session.create({
          data: {
            userId: user.id,
            token: sessionToken,
            expiresAt,
          },
        })

        // Set cookie with the matching maxAge so the browser-side cookie
        // and DB-side session expire together.
        reply.setCookie('sessionToken', sessionToken, getCookieOptions(durationMs))

        fastify.log.info(
          { userId: user.id, username: user.username, rememberMe: !!rememberMe },
          'User logged in',
        )

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

        // No rolling refresh: the expiresAt set at login is the final
        // word. Users who want a long-lived session check "remember me"
        // and get 30 days; otherwise they get 3 days from login and then
        // log in again. Keeps the auth logic simple and stateless.

        return {
          authenticated: true,
          user: {
            id: session.user.id,
            email: session.user.email,
            username: session.user.username,
          },
          preferences: (session.user.preferences as UserPreferences) ?? {},
        }
      } catch (error) {
        fastify.log.error({ error }, 'Session check failed')
        return reply.status(500).send({ error: 'Session check failed' })
      }
    },
  )

  // POST /auth/change-password
  // Requires the user's current password to authorise the change. Existing
  // sessions remain valid — we don't force a re-login. Bart's call: keep it
  // friction-free for users editing settings on the reader.
  fastify.post(
    '/change-password',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Change the password for the current user.',
        tags: ['auth'],
        body: changePasswordBodySchema,
        response: {
          200: changePasswordResponseSchema,
          400: errorSchema,
          401: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { currentPassword, newPassword } = request.body
        const user = request.user!

        // Verify current password before accepting the new one. Same scrypt
        // verification as login.
        const [salt, storedHash] = user.passwordHash.split(':')
        const derivedKey = (await scryptAsync(currentPassword, salt, 64)) as Buffer
        if (derivedKey.toString('hex') !== storedHash) {
          return reply.status(401).send({ error: 'Current password is incorrect' })
        }

        // Hash the new password with a fresh salt.
        const newSalt = randomBytes(16).toString('hex')
        const newDerivedKey = (await scryptAsync(newPassword, newSalt, 64)) as Buffer
        const newHash = `${newSalt}:${newDerivedKey.toString('hex')}`

        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash },
        })

        fastify.log.info({ userId: user.id }, 'User changed password')
        return { success: true as const }
      } catch (error) {
        fastify.log.error({ error }, 'Password change failed')
        return reply.status(500).send({ error: 'Password change failed' })
      }
    },
  )
}

export default authRoutes
