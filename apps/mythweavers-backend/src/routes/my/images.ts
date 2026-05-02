/**
 * AI image generation routes.
 *
 * `POST /my/images/generate` — generate an image from a prompt and store it
 * as a regular `File` row owned by the calling user. The user can then point
 * the existing background routes (`/my/stories/:id/background`, etc.) at the
 * resulting `fileId` to use it as a default background.
 *
 * Generation is synchronous — Cloudflare's Schnell takes ~3s and Klein 9B
 * takes ~8s, both well within HTTP timeout. OpenAI's `gpt-image-1` may take
 * 20–60s; we set the per-route timeout accordingly. When we add slower model
 * classes (Flux Dev, video) we'll switch to a queue + WebSocket push.
 */
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { saveBuffer } from '../../lib/file-storage.js'
import {
  estimateCost,
  estimateOurCost,
  getPublicImageModels,
  megapixelsFor,
  resolveImageUpstream,
  tilesFor,
} from '../../lib/image-config.js'
import { createImageClient } from '../../lib/image-clients.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

// ---------- Schemas ----------

const pricingSchema = z.strictObject({
  priceFlat: z.number().nullable(),
  priceFirstMP: z.number().nullable(),
  priceSubsequentMP: z.number().nullable(),
  pricePerTile: z.number().nullable(),
  pricePerTileStep: z.number().nullable(),
})

const publicImageModelSchema = z.strictObject({
  name: z.string().meta({ description: 'Model ID sent to the provider' }),
  displayName: z.string().nullable(),
  description: z.string().nullable(),
  provider: z.string(),
  defaultSteps: z.number().int().nullable(),
  maxWidth: z.number().int().nullable(),
  maxHeight: z.number().int().nullable(),
  supportedSizes: z.array(z.string()).nullable(),
  pricingMode: z.enum(['FLAT_PER_IMAGE', 'PER_MP_TIERED', 'PER_TILE_STEP']),
  pricing: pricingSchema,
})

const modelsResponseSchema = z.strictObject({
  models: z.array(publicImageModelSchema),
})

const generateBodySchema = z.strictObject({
  storyId: z.string().meta({
    description:
      'Story ID this image is being generated for. Used for ownership ' +
      'verification and to optionally pin the resulting File to the story.',
    example: 'clx1234567890',
  }),
  model: z.string().meta({
    description: 'Image model ID from the public catalog (GET /my/images/models)',
    example: '@cf/black-forest-labs/flux-1-schnell',
  }),
  prompt: z
    .string()
    .min(1, 'Prompt is required')
    .max(2000, 'Prompt is too long')
    .meta({
      description: 'Text prompt for the image model',
      example: 'A misty fantasy forest at dusk, painterly style',
    }),
  width: z
    .number()
    .int()
    .min(256)
    .max(4096)
    .optional()
    .meta({ description: 'Output width in pixels (clamped to model max)', example: 1024 }),
  height: z
    .number()
    .int()
    .min(256)
    .max(4096)
    .optional()
    .meta({ description: 'Output height in pixels (clamped to model max)', example: 1024 }),
  steps: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .meta({ description: 'Denoising steps. Defaults to model.defaultSteps when omitted.', example: 4 }),
  negativePrompt: z.string().max(2000).optional(),
  seed: z.number().int().optional(),
})

const generateResponseSchema = z.strictObject({
  success: z.literal(true),
  fileId: z.string(),
  path: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  mimeType: z.string(),
  costDebited: z.string().meta({
    description:
      'Cost charged to the user as a Decimal-string (matches BalanceLedger.amount serialization).',
  }),
})

// ---------- Per-user concurrency ----------
//
// Single-process concurrency cap: at most one image gen in flight per user.
// Backed by an in-memory Map<userId, AbortController>. Doesn't survive process
// restart (acceptable — the in-flight gen would have died with the process)
// and doesn't span multiple instances (we're single-process today; if/when we
// scale horizontally swap this for a Postgres advisory lock keyed on userId).
const inFlight = new Map<number, AbortController>()

// ---------- Helpers ----------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    default:
      return 'bin'
  }
}

// ---------- Routes ----------

const myImagesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', requireAuth)

  /**
   * GET /my/images/models — public image-model catalog for the picker UI.
   */
  fastify.get(
    '/images/models',
    {
      schema: {
        description: 'List available image-generation models with pricing',
        tags: ['my-images'],
        security: [{ sessionAuth: [] }],
        response: {
          200: modelsResponseSchema,
          401: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (_request, reply) => {
      try {
        const models = await getPublicImageModels()
        return { models }
      } catch (err) {
        fastify.log.error({ err }, 'Failed to list image models')
        return reply.status(500).send({ error: 'Failed to list image models' })
      }
    },
  )

  /**
   * POST /my/images/generate — generate an image and store it as a File.
   *
   * Flow:
   *   1. Validate body, verify story ownership.
   *   2. Resolve model → upstream config (or 400 if not available).
   *   3. Clamp width/height/steps to model limits, compute estimated cost.
   *   4. Pre-flight balance check (402 if insufficient).
   *   5. Per-user concurrency lock (429 if already generating).
   *   6. Call upstream client.generateImage(); errors surface verbatim (400).
   *   7. saveBuffer + dedup → File row + ImageUsageLog + balance debit (one tx).
   */
  fastify.post(
    '/images/generate',
    {
      // gpt-image-1 HD can run ~60s; give ourselves 90s headroom.
      config: {
        connectionTimeout: 90_000,
      },
      schema: {
        description:
          'Generate an image from a text prompt and store it as a File owned by the user. ' +
          'Synchronous — the response includes the resulting fileId once generation completes.',
        tags: ['my-images'],
        security: [{ sessionAuth: [] }],
        body: generateBodySchema,
        response: {
          200: generateResponseSchema,
          400: errorSchema,
          401: errorSchema,
          402: errorSchema,
          404: errorSchema,
          429: errorSchema,
          500: errorSchema,
          502: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const body = request.body

      // 1. Verify story ownership.
      const story = await prisma.story.findFirst({
        where: { id: body.storyId, ownerId: userId },
        select: { id: true },
      })
      if (!story) {
        return reply.status(404).send({ error: 'Story not found' })
      }

      // 2. Resolve upstream config.
      const upstream = await resolveImageUpstream(body.model)
      if (!upstream) {
        return reply
          .status(400)
          .send({ error: `Image model "${body.model}" is not available` })
      }

      // 3. Clamp parameters to model capability.
      const requestedWidth = body.width ?? 1024
      const requestedHeight = body.height ?? 1024
      const width = clamp(requestedWidth, 256, upstream.maxWidth ?? 4096)
      const height = clamp(requestedHeight, 256, upstream.maxHeight ?? 4096)
      const steps = body.steps ?? upstream.defaultSteps ?? 4

      // 4. Estimate cost and pre-flight balance check.
      let estimatedPrice: number
      try {
        estimatedPrice = estimateCost(upstream, width, height, steps)
      } catch (err) {
        // Misconfigured model — treat as 500.
        fastify.log.error(
          { err, model: body.model },
          'Image model pricing misconfigured',
        )
        return reply
          .status(500)
          .send({ error: 'Image model is misconfigured (pricing)' })
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      })
      if (!user) {
        // Shouldn't happen — auth would have failed.
        return reply.status(401).send({ error: 'User not found' })
      }
      if (user.balance.toNumber() < estimatedPrice) {
        return reply.status(402).send({
          error: `Insufficient balance: this generation costs ~$${estimatedPrice.toFixed(4)}, you have $${user.balance.toString()}`,
        })
      }

      // 5. Per-user concurrency lock.
      if (inFlight.has(userId)) {
        return reply.status(429).send({
          error: 'You already have an image generation in progress',
        })
      }

      // Plumb client disconnect → upstream cancellation.
      const controller = new AbortController()
      inFlight.set(userId, controller)
      const onClose = () => controller.abort()
      request.raw.once('close', onClose)

      const startedAt = Date.now()
      let aborted = false

      try {
        // 6. Call upstream.
        const client = createImageClient(upstream)
        let result
        try {
          result = await client.generateImage({
            model: upstream.model,
            prompt: body.prompt,
            width,
            height,
            steps,
            negativePrompt: body.negativePrompt,
            seed: body.seed,
            signal: controller.signal,
          })
        } catch (err) {
          if (controller.signal.aborted) {
            aborted = true
            // Log the aborted gen (no balance debit, no file).
            await prisma.imageUsageLog.create({
              data: {
                userId,
                modelId: upstream.model,
                providerName: upstream.provider,
                imageModelId: upstream.imageModelId,
                prompt: body.prompt,
                width,
                height,
                steps,
                tilesUsed: tilesFor(width, height),
                megapixels: megapixelsFor(width, height),
                pricingMode: upstream.pricingMode,
                priceFlat: upstream.pricing.priceFlat,
                priceFirstMP: upstream.pricing.priceFirstMP,
                priceSubsequentMP: upstream.pricing.priceSubsequentMP,
                pricePerTile: upstream.pricing.pricePerTile,
                pricePerTileStep: upstream.pricing.pricePerTileStep,
                cost: 0,
                durationMs: Date.now() - startedAt,
                aborted: true,
                errored: false,
              },
            })
            // Client already disconnected, so this response is largely
            // best-effort; status is mostly for our logs.
            return reply.status(400).send({ error: 'Cancelled' })
          }
          // Real upstream error — log + return verbatim message (Cloudflare and
          // OpenAI both produce useful errors; we want the user to see them).
          fastify.log.warn(
            {
              err,
              model: body.model,
              provider: upstream.provider,
            },
            'Image gen upstream error',
          )
          await prisma.imageUsageLog.create({
            data: {
              userId,
              modelId: upstream.model,
              providerName: upstream.provider,
              imageModelId: upstream.imageModelId,
              prompt: body.prompt,
              width,
              height,
              steps,
              pricingMode: upstream.pricingMode,
              priceFlat: upstream.pricing.priceFlat,
              priceFirstMP: upstream.pricing.priceFirstMP,
              priceSubsequentMP: upstream.pricing.priceSubsequentMP,
              pricePerTile: upstream.pricing.pricePerTile,
              pricePerTileStep: upstream.pricing.pricePerTileStep,
              cost: 0,
              durationMs: Date.now() - startedAt,
              errored: true,
            },
          })
          const message =
            err instanceof Error ? err.message : 'Image generation failed'
          return reply.status(502).send({ error: message })
        }

        // 7. Persist file + usage log + balance debit in a single transaction.
        const buffer = Buffer.from(result.buffer)
        const filename = `generated-${Date.now()}.${extFromMime(result.mimeType)}`

        // Save bytes outside the DB tx (filesystem/R2 I/O shouldn't hold a tx open).
        const fileMetadata = await saveBuffer(
          buffer,
          filename,
          result.mimeType,
          userId,
          'private',
        )

        // Compute final cost based on actual width/height the model produced
        // (it may have clamped). Falls back to the estimate if the client
        // didn't echo dimensions back.
        const finalWidth = result.width ?? width
        const finalHeight = result.height ?? height
        const finalCost = estimateCost(upstream, finalWidth, finalHeight, steps)
        const ourCost = estimateOurCost(upstream, finalWidth, finalHeight, steps)

        const { fileId, filePath } = await prisma.$transaction(async (tx) => {
          // Dedup: if the user already has a File with this sha256, reuse it.
          const existing = await tx.file.findFirst({
            where: { ownerId: userId, sha256: fileMetadata.sha256 },
          })
          let fileRow = existing
          if (!fileRow) {
            fileRow = await tx.file.create({
              data: {
                ownerId: userId,
                storyId: body.storyId,
                localPath: fileMetadata.localPath,
                r2Key: fileMetadata.r2Key,
                visibility: fileMetadata.visibility,
                path: fileMetadata.path,
                sha256: fileMetadata.sha256,
                mimeType: fileMetadata.mimeType,
                width: fileMetadata.width,
                height: fileMetadata.height,
                bytes: fileMetadata.bytes,
              },
            })
          }

          const usageLog = await tx.imageUsageLog.create({
            data: {
              userId,
              modelId: upstream.model,
              providerName: upstream.provider,
              imageModelId: upstream.imageModelId,
              fileId: fileRow.id,
              prompt: body.prompt,
              width: finalWidth,
              height: finalHeight,
              steps,
              tilesUsed: tilesFor(finalWidth, finalHeight),
              megapixels: megapixelsFor(finalWidth, finalHeight),
              pricingMode: upstream.pricingMode,
              priceFlat: upstream.pricing.priceFlat,
              priceFirstMP: upstream.pricing.priceFirstMP,
              priceSubsequentMP: upstream.pricing.priceSubsequentMP,
              pricePerTile: upstream.pricing.pricePerTile,
              pricePerTileStep: upstream.pricing.pricePerTileStep,
              cost: finalCost,
              durationMs: Date.now() - startedAt,
            },
          })

          const updated = await tx.user.update({
            where: { id: userId },
            data: { balance: { decrement: finalCost } },
          })

          await tx.balanceLedger.create({
            data: {
              userId,
              amount: -finalCost,
              balanceAfter: updated.balance,
              type: 'IMAGE_USAGE',
              description: `Image gen: ${upstream.model}`,
              imageUsageLogId: usageLog.id,
            },
          })

          return { fileId: fileRow.id, filePath: fileRow.path }
        })

        fastify.log.info(
          {
            userId,
            model: upstream.model,
            provider: upstream.provider,
            cost: finalCost,
            ourCost,
            durationMs: Date.now() - startedAt,
            fileId,
          },
          'Image generated',
        )

        return {
          success: true as const,
          fileId,
          path: filePath,
          width: fileMetadata.width,
          height: fileMetadata.height,
          mimeType: fileMetadata.mimeType,
          costDebited: finalCost.toFixed(6),
        }
      } finally {
        request.raw.removeListener('close', onClose)
        inFlight.delete(userId)
        if (aborted) {
          // No-op — we already sent the 499 above. Comment for clarity.
        }
      }
    },
  )
}

export default myImagesRoutes
