import type { Prisma } from '@prisma/client'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'

const errorSchema = z.object({ error: z.string() })

const customProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  endpoint: z.string(),
  // API keys are NOT stored here in plaintext — they live in the client-side
  // encrypted `encryptedSecrets` blob (keyed by provider id). Optional so the
  // client can sync provider metadata without the key. Kept in the schema for
  // forward-compat with legacy rows that still carry a plaintext key.
  apiKey: z.string().optional(),
})

const categoryOverrideSchema = z.object({
  provider: z.string(),
  model: z.string(),
})

/**
 * The shape of user preferences stored as JSON on the User entity.
 * Uses passthrough so we don't reject unknown keys (forward-compat).
 */
export const preferencesSchema = z
  .object({
    provider: z.string().optional(),
    model: z.string().optional(),
    maxTokens: z.number().optional(),
    thinkingBudget: z.number().optional(),
    contextSize: z.number().optional(),

    // Provider API keys
    openrouterApiKey: z.string().optional(),
    anthropicApiKey: z.string().optional(),
    openaiApiKey: z.string().optional(),
    cloudflareApiKey: z.string().optional(),
    cloudflareEndpoint: z.string().optional(),

    // Custom providers
    customProviders: z.array(customProviderSchema).optional(),

    // Per-category model overrides (e.g. { summary: { provider: "openai", model: "gpt-4o" } })
    categoryOverrides: z.record(z.string(), categoryOverrideSchema).optional(),

    // Client-side encrypted API keys blob
    encryptedSecrets: z
      .object({
        salt: z.string(),
        iv: z.string(),
        ciphertext: z.string(),
      })
      .optional(),
  })
  .passthrough()

export type UserPreferences = z.infer<typeof preferencesSchema>

const preferencesResponseSchema = z.object({
  preferences: preferencesSchema,
})

const preferencesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /my/preferences — return the authenticated user's preferences
   */
  fastify.get(
    '/preferences',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Get the current user preferences (AI settings, provider keys, etc.)',
        tags: ['preferences'],
        response: {
          200: preferencesResponseSchema,
          401: errorSchema,
        },
      },
    },
    async (request) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: request.user!.id },
        select: { preferences: true },
      })
      return { preferences: (user.preferences as UserPreferences) ?? {} }
    },
  )

  /**
   * PUT /my/preferences — partial-merge update of user preferences
   */
  fastify.put(
    '/preferences',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Update user preferences (partial merge — only provided keys are updated)',
        tags: ['preferences'],
        body: preferencesSchema,
        response: {
          200: preferencesResponseSchema,
          401: errorSchema,
        },
      },
    },
    async (request) => {
      const userId = request.user!.id
      const updates = request.body

      // Read current preferences and merge
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { preferences: true },
      })
      const current = (user.preferences as UserPreferences) ?? {}

      // Shallow merge — top-level keys from the request overwrite existing ones
      const merged = { ...current, ...updates }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { preferences: merged as Prisma.InputJsonValue },
        select: { preferences: true },
      })

      return { preferences: (updated.preferences as UserPreferences) ?? {} }
    },
  )
}

export default preferencesRoutes
