import { Prisma } from '@prisma/client'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import {
  decryptSecret,
  encryptSecret,
  isSecretEncryptionAvailable,
} from '../../lib/crypto.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

/**
 * Royal Road integration endpoints.
 *
 * Scope of this file (Phase A):
 *   - GET    /my/royal-road/account           → reveal connection status
 *   - POST   /my/royal-road/account           → connect / rotate credentials
 *   - DELETE /my/royal-road/account           → disconnect
 *
 * Phases B+ will add:
 *   - Per-story enable toggle (/my/royal-road/stories/:id)
 *   - Per-chapter link/unlink/status/retry/sync
 * and a background worker that actually drives Playwright.
 *
 * Credentials policy:
 *   - Password is encrypted at rest with AES-GCM (lib/crypto.ts).
 *   - storageState (Playwright cookies) is cached alongside so the worker can
 *     skip the login form when cookies are still valid.
 *   - The plaintext password never leaves the server; GET /account only
 *     returns `{ connected, email, lastLoginAt, lastError }`.
 *   - POST /account does NOT verify credentials against royalroad.com in
 *     Phase A. That requires the Playwright client (Phase B). For now it
 *     just stores the encrypted credentials; the worker surfaces login
 *     errors via `lastError` on the first publish attempt.
 */

// ---------- Schemas ----------

const accountStatusSchema = z.object({
  connected: z.boolean().meta({
    description: 'Whether a Royal Road account is currently linked to this user.',
    example: true,
  }),
  email: z
    .string()
    .nullable()
    .meta({
      description: 'Email address used for the Royal Road login. Null when disconnected.',
      example: 'writer@example.com',
    }),
  lastLoginAt: z
    .string()
    .nullable()
    .meta({
      description:
        'ISO timestamp of the last successful Royal Road login performed by the worker.',
      example: '2026-04-24T12:00:00.000Z',
    }),
  lastError: z
    .string()
    .nullable()
    .meta({
      description:
        'Most recent authentication error (wrong password, captcha, etc.). ' +
        'Cleared after a successful login. Null when there is no outstanding error.',
      example: 'Login failed: invalid credentials',
    }),
})

const connectAccountBodySchema = z.strictObject({
  email: z.string().email().meta({
    description: 'Royal Road login email.',
    example: 'writer@example.com',
  }),
  password: z.string().min(1).meta({
    description:
      'Royal Road login password. Stored encrypted at rest (AES-GCM) and ' +
      'never returned by any endpoint.',
    example: 'hunter2',
  }),
})

const successSchema = z.object({
  success: z.literal(true),
})

// ---------- Helpers ----------

async function loadAccountStatus(userId: number) {
  const account = await prisma.royalRoadAccount.findUnique({
    where: { userId },
    select: {
      email: true,
      lastLoginAt: true,
      lastError: true,
    },
  })
  if (!account) {
    return { connected: false, email: null, lastLoginAt: null, lastError: null }
  }
  return {
    connected: true,
    email: account.email,
    lastLoginAt: account.lastLoginAt ? account.lastLoginAt.toISOString() : null,
    lastError: account.lastError ?? null,
  }
}

// ---------- Routes ----------

const myRoyalRoadRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', requireAuth)

  fastify.get(
    '/royal-road/account',
    {
      schema: {
        description:
          'Return the current user\u2019s Royal Road account connection status. ' +
          'Does not expose any credential material.',
        tags: ['my-royal-road'],
        security: [{ sessionAuth: [] }],
        response: {
          200: accountStatusSchema,
          401: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const status = await loadAccountStatus(userId)
        return status
      } catch (err) {
        fastify.log.error({ err }, 'Failed to load Royal Road account status')
        return reply.status(500).send({ error: 'Failed to load Royal Road account status' })
      }
    },
  )

  fastify.post(
    '/royal-road/account',
    {
      schema: {
        description:
          'Link or update Royal Road credentials for the current user. The password is ' +
          'encrypted at rest. Credentials are not verified against royalroad.com at this ' +
          'endpoint; the publishing worker surfaces auth errors via `lastError` when it ' +
          'attempts to log in.',
        tags: ['my-royal-road'],
        security: [{ sessionAuth: [] }],
        body: connectAccountBodySchema,
        response: {
          200: accountStatusSchema,
          400: errorSchema,
          401: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        if (!isSecretEncryptionAvailable()) {
          fastify.log.error('ROYAL_ROAD_ENC_KEY is not configured; refusing to store credentials')
          return reply.status(500).send({
            error:
              'Royal Road integration is not configured on this server (missing encryption key).',
          })
        }
        const userId = request.user!.id
        const { email, password } = request.body
        const encryptedPassword = encryptSecret(password)

        // On rotation we reset the session cache and any outstanding error so
        // the worker re-authenticates from scratch with the new password.
        await prisma.royalRoadAccount.upsert({
          where: { userId },
          create: {
            userId,
            email,
            encryptedPassword,
          },
          update: {
            email,
            encryptedPassword,
            storageStateJson: Prisma.JsonNull,
            lastError: null,
          },
        })

        // Sanity-check round-trip so we fail fast if the key ever mis-decrypts.
        // Throws if decryption fails — caught by the outer try/catch.
        const decrypted = decryptSecret(encryptedPassword)
        if (decrypted !== password) {
          throw new Error('Encryption round-trip failed (plaintext mismatch)')
        }

        const status = await loadAccountStatus(userId)
        return status
      } catch (err) {
        fastify.log.error({ err }, 'Failed to connect Royal Road account')
        return reply.status(500).send({ error: 'Failed to connect Royal Road account' })
      }
    },
  )

  fastify.delete(
    '/royal-road/account',
    {
      schema: {
        description:
          'Disconnect the current user\u2019s Royal Road account. Removes stored ' +
          'credentials and cached session state. Already-published chapters on Royal ' +
          'Road are untouched; future scheduled publishes will fail until the account ' +
          'is reconnected.',
        tags: ['my-royal-road'],
        security: [{ sessionAuth: [] }],
        response: {
          200: successSchema,
          401: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        await prisma.royalRoadAccount.deleteMany({ where: { userId } })
        return { success: true as const }
      } catch (err) {
        fastify.log.error({ err }, 'Failed to disconnect Royal Road account')
        return reply.status(500).send({ error: 'Failed to disconnect Royal Road account' })
      }
    },
  )
}

export default myRoyalRoadRoutes
