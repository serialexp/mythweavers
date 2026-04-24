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

  // --- Story settings ---

  const storyIdParamSchema = z.strictObject({
    storyId: z.string().meta({ description: 'Story ID', example: 'clx1234567890' }),
  })

  const storySettingsSchema = z.object({
    storyId: z.string(),
    royalRoadId: z.number().int().nullable(),
    publishingEnabled: z.boolean(),
  })

  const updateStorySettingsBodySchema = z.object({
    royalRoadId: z
      .number()
      .int()
      .nullable()
      .optional()
      .meta({
        description:
          'Numeric Royal Road story id. Set once after you create the story shell on ' +
          'royalroad.com; pass null to clear the link.',
        example: 123456,
      }),
    publishingEnabled: z.boolean().optional().meta({
      description:
        'When true, the publishing worker will push chapters with publishedAt <= now to ' +
        'Royal Road. Requires a connected Royal Road account and a royalRoadId on the story.',
      example: true,
    }),
  })

  async function requireOwnedStory(storyId: string, userId: number) {
    const story = await prisma.story.findFirst({
      where: { id: storyId, ownerId: userId },
      select: { id: true, royalRoadId: true, royalRoadPublishingEnabled: true },
    })
    return story
  }

  fastify.get(
    '/royal-road/stories/:storyId',
    {
      schema: {
        description:
          'Return the Royal Road settings for a story: linked RR id and publishing-enabled flag.',
        tags: ['my-royal-road'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        response: {
          200: storySettingsSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const story = await requireOwnedStory(request.params.storyId, userId)
        if (!story) return reply.status(404).send({ error: 'Story not found' })
        return {
          storyId: story.id,
          royalRoadId: story.royalRoadId,
          publishingEnabled: story.royalRoadPublishingEnabled,
        }
      } catch (err) {
        fastify.log.error({ err }, 'Failed to load Royal Road story settings')
        return reply.status(500).send({ error: 'Failed to load Royal Road story settings' })
      }
    },
  )

  fastify.patch(
    '/royal-road/stories/:storyId',
    {
      schema: {
        description:
          'Update the Royal Road settings for a story. Either field is optional; unspecified ' +
          'fields are left unchanged. Setting publishingEnabled without a royalRoadId is ' +
          'allowed (chapters will be created on Royal Road on first publish).',
        tags: ['my-royal-road'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        body: updateStorySettingsBodySchema,
        response: {
          200: storySettingsSchema,
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
        const story = await requireOwnedStory(request.params.storyId, userId)
        if (!story) return reply.status(404).send({ error: 'Story not found' })
        const { royalRoadId, publishingEnabled } = request.body
        const updated = await prisma.story.update({
          where: { id: story.id },
          data: {
            ...(royalRoadId !== undefined ? { royalRoadId } : {}),
            ...(publishingEnabled !== undefined
              ? { royalRoadPublishingEnabled: publishingEnabled }
              : {}),
          },
          select: { id: true, royalRoadId: true, royalRoadPublishingEnabled: true },
        })
        return {
          storyId: updated.id,
          royalRoadId: updated.royalRoadId,
          publishingEnabled: updated.royalRoadPublishingEnabled,
        }
      } catch (err) {
        fastify.log.error({ err }, 'Failed to update Royal Road story settings')
        return reply.status(500).send({ error: 'Failed to update Royal Road story settings' })
      }
    },
  )

  // --- Chapter link / unlink / status / retry ---

  const chapterLinkParamsSchema = z.strictObject({
    storyId: z.string(),
    chapterId: z.string(),
  })

  const chapterLinkBodySchema = z.strictObject({
    royalRoadId: z.number().int().positive().meta({
      description: 'Numeric Royal Road chapter id to link to this chapter.',
      example: 987654,
    }),
  })

  const chapterPublishingRowSchema = z.object({
    chapterId: z.string(),
    chapterName: z.string(),
    chapterRoyalRoadId: z.number().int().nullable(),
    status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED']).nullable(),
    platformId: z.string().nullable(),
    publishedAt: z.string().nullable(),
    lastAttempt: z.string().nullable(),
    errorMessage: z.string().nullable(),
    attempts: z.number().int(),
    nextAttemptAt: z.string().nullable(),
  })

  const publishingStatusResponseSchema = z.object({
    rows: z.array(chapterPublishingRowSchema),
  })

  async function requireOwnedChapter(storyId: string, chapterId: string, userId: number) {
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        deleted: false,
        arc: { book: { storyId, story: { ownerId: userId } } },
      },
      select: { id: true, royalRoadId: true },
    })
    return chapter
  }

  fastify.post(
    '/royal-road/stories/:storyId/chapters/:chapterId/link',
    {
      schema: {
        description:
          'Link this chapter to an existing Royal Road chapter so future publishes update ' +
          'that chapter instead of creating a new one.',
        tags: ['my-royal-road'],
        security: [{ sessionAuth: [] }],
        params: chapterLinkParamsSchema,
        body: chapterLinkBodySchema,
        response: {
          200: z.object({ success: z.literal(true) }),
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
        const chapter = await requireOwnedChapter(
          request.params.storyId,
          request.params.chapterId,
          userId,
        )
        if (!chapter) return reply.status(404).send({ error: 'Chapter not found' })
        await prisma.chapter.update({
          where: { id: chapter.id },
          data: { royalRoadId: request.body.royalRoadId },
        })
        return { success: true as const }
      } catch (err) {
        fastify.log.error({ err }, 'Failed to link Royal Road chapter id')
        return reply.status(500).send({ error: 'Failed to link Royal Road chapter id' })
      }
    },
  )

  fastify.post(
    '/royal-road/stories/:storyId/chapters/:chapterId/unlink',
    {
      schema: {
        description:
          'Remove the Royal Road chapter id from this chapter. Does not delete the chapter on ' +
          'Royal Road; the next publish will create a fresh chapter instead.',
        tags: ['my-royal-road'],
        security: [{ sessionAuth: [] }],
        params: chapterLinkParamsSchema,
        response: {
          200: z.object({ success: z.literal(true) }),
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const chapter = await requireOwnedChapter(
          request.params.storyId,
          request.params.chapterId,
          userId,
        )
        if (!chapter) return reply.status(404).send({ error: 'Chapter not found' })
        await prisma.chapter.update({
          where: { id: chapter.id },
          data: { royalRoadId: null },
        })
        return { success: true as const }
      } catch (err) {
        fastify.log.error({ err }, 'Failed to unlink Royal Road chapter id')
        return reply.status(500).send({ error: 'Failed to unlink Royal Road chapter id' })
      }
    },
  )

  fastify.get(
    '/royal-road/stories/:storyId/publishing-status',
    {
      schema: {
        description:
          'List publishing state for every chapter in the story. One row per chapter; rows ' +
          'without a ChapterPublishing record report status=null (never queued).',
        tags: ['my-royal-road'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        response: {
          200: publishingStatusResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const story = await requireOwnedStory(request.params.storyId, userId)
        if (!story) return reply.status(404).send({ error: 'Story not found' })
        const chapters = await prisma.chapter.findMany({
          where: {
            deleted: false,
            arc: { book: { storyId: story.id } },
          },
          orderBy: [{ arc: { book: { sortOrder: 'asc' } } }, { arc: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
          select: {
            id: true,
            name: true,
            royalRoadId: true,
            publishingStatus: {
              where: { platform: 'ROYAL_ROAD' },
              select: {
                status: true,
                platformId: true,
                publishedAt: true,
                lastAttempt: true,
                errorMessage: true,
                attempts: true,
                nextAttemptAt: true,
              },
            },
          },
        })
        return {
          rows: chapters.map((c) => {
            const pub = c.publishingStatus[0]
            return {
              chapterId: c.id,
              chapterName: c.name,
              chapterRoyalRoadId: c.royalRoadId,
              status: pub?.status ?? null,
              platformId: pub?.platformId ?? null,
              publishedAt: pub?.publishedAt ? pub.publishedAt.toISOString() : null,
              lastAttempt: pub?.lastAttempt ? pub.lastAttempt.toISOString() : null,
              errorMessage: pub?.errorMessage ?? null,
              attempts: pub?.attempts ?? 0,
              nextAttemptAt: pub?.nextAttemptAt ? pub.nextAttemptAt.toISOString() : null,
            }
          }),
        }
      } catch (err) {
        fastify.log.error({ err }, 'Failed to load Royal Road publishing status')
        return reply.status(500).send({ error: 'Failed to load Royal Road publishing status' })
      }
    },
  )

  fastify.post(
    '/royal-road/stories/:storyId/chapters/:chapterId/retry',
    {
      schema: {
        description:
          'Reset a FAILED ChapterPublishing row back to DRAFT with nextAttemptAt=null so the ' +
          'worker picks it up immediately on the next tick. No-op if the row is already PUBLISHED.',
        tags: ['my-royal-road'],
        security: [{ sessionAuth: [] }],
        params: chapterLinkParamsSchema,
        response: {
          200: z.object({ success: z.literal(true) }),
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const chapter = await requireOwnedChapter(
          request.params.storyId,
          request.params.chapterId,
          userId,
        )
        if (!chapter) return reply.status(404).send({ error: 'Chapter not found' })
        await prisma.chapterPublishing.updateMany({
          where: {
            chapterId: chapter.id,
            platform: 'ROYAL_ROAD',
            status: 'FAILED',
          },
          data: {
            status: 'DRAFT',
            nextAttemptAt: null,
            attempts: 0,
          },
        })
        return { success: true as const }
      } catch (err) {
        fastify.log.error({ err }, 'Failed to retry Royal Road publish')
        return reply.status(500).send({ error: 'Failed to retry Royal Road publish' })
      }
    },
  )

  // --- Sync (manual reconcile) ---

  const syncBodySchema = z.strictObject({
    chapters: z
      .array(
        z.strictObject({
          chapterId: z.string(),
          royalRoadId: z.number().int().positive(),
        }),
      )
      .meta({
        description:
          'Client-provided list of chapters already manually published on Royal Road. Each ' +
          'entry backfills a PUBLISHED ChapterPublishing row if missing, and sets the chapter\u2019s ' +
          'royalRoadId. Existing PUBLISHING/FAILED rows are left untouched so the worker can ' +
          'continue with them.',
      }),
  })

  fastify.post(
    '/royal-road/stories/:storyId/sync',
    {
      schema: {
        description:
          'Manually reconcile the DB with the user\u2019s view of what\u2019s already on Royal Road. ' +
          'Used after an initial import when the user has previously published chapters by hand ' +
          'and wants the writer to recognise them.',
        tags: ['my-royal-road'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        body: syncBodySchema,
        response: {
          200: z.object({ synced: z.number().int() }),
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const story = await requireOwnedStory(request.params.storyId, userId)
        if (!story) return reply.status(404).send({ error: 'Story not found' })
        let synced = 0
        for (const entry of request.body.chapters) {
          const chapter = await prisma.chapter.findFirst({
            where: {
              id: entry.chapterId,
              arc: { book: { storyId: story.id } },
            },
            select: { id: true },
          })
          if (!chapter) continue
          await prisma.chapter.update({
            where: { id: chapter.id },
            data: { royalRoadId: entry.royalRoadId },
          })
          await prisma.chapterPublishing.upsert({
            where: {
              chapterId_platform: { chapterId: chapter.id, platform: 'ROYAL_ROAD' },
            },
            create: {
              chapterId: chapter.id,
              platform: 'ROYAL_ROAD',
              status: 'PUBLISHED',
              platformId: String(entry.royalRoadId),
              publishedAt: new Date(),
              lastAttempt: new Date(),
            },
            update: {
              // Only upgrade rows that are not currently in the middle of
              // publishing or already FAILED — we don't want to clobber the
              // worker's view of the world.
              status: 'PUBLISHED',
              platformId: String(entry.royalRoadId),
              publishedAt: new Date(),
              errorMessage: null,
              attempts: 0,
              nextAttemptAt: null,
            },
          })
          synced += 1
        }
        return { synced }
      } catch (err) {
        fastify.log.error({ err }, 'Failed to sync Royal Road publishing state')
        return reply.status(500).send({ error: 'Failed to sync Royal Road publishing state' })
      }
    },
  )
}

export default myRoyalRoadRoutes
