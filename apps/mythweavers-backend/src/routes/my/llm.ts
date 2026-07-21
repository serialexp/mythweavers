import {
  AnthropicClient,
  CloudflareClient,
  type LLMMessage,
  type LLMStreamEvent,
  OpenAICompatibleClient,
} from '@mythweavers/llm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { type TokenUsage, calculateCost } from '../../lib/billing.js'
import { type UpstreamConfig, getPublicModels, resolveUpstream } from '../../lib/llm-config.js'
import { prisma } from '../../lib/prisma.js'

// --- Zod schemas ---

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().max(200_000),
  cache_control: z
    .object({
      type: z.literal('ephemeral'),
      ttl: z.union([z.literal('5m'), z.literal('1h'), z.number()]).optional(),
    })
    .optional(),
})

const toolDefinitionSchema = z.object({
  name: z.string().meta({ description: 'Tool name (function name).' }),
  description: z.string().meta({
    description: 'Human-readable description of what the tool does.',
  }),
  parameters: z.record(z.string(), z.unknown()).meta({
    description: 'JSON Schema for the tool parameters, passed through verbatim.',
  }),
})

const toolChoiceSchema = z.union([
  z.literal('auto'),
  z.literal('required'),
  z.literal('none'),
  z.object({ name: z.string() }),
])

const generateBodySchema = z.object({
  model: z.string().meta({ description: 'Model name from the server allowed list' }),
  messages: z.array(messageSchema).min(1).max(100),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().max(32_768).default(4096),
  thinking_budget: z.number().int().positive().max(32_768).optional(),
  tools: z.array(toolDefinitionSchema).max(64).optional().meta({
    description:
      'Optional tool definitions the model may invoke. Currently only honored on OpenAI-compatible upstreams; other providers will reject the request.',
  }),
  tool_choice: toolChoiceSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const errorSchema = z.object({
  error: z.string(),
})

const pricingSchema = z.object({
  input: z.number(),
  output: z.number(),
  input_cache_read: z.number().nullable(),
  input_cache_write: z.number().nullable(),
})

const publicModelSchema = z.object({
  name: z.string(),
  displayName: z.string().nullable(),
  provider: z.string(),
  contextLength: z.number().nullable(),
  pricing: pricingSchema,
})

const modelsResponseSchema = z.object({
  models: z.array(publicModelSchema),
})

// --- SSE writing helper ---

function writeSSE(raw: import('node:http').ServerResponse, event: LLMStreamEvent) {
  // Convert the shared LLMStreamEvent to a backend-normalized SSE payload.
  // The `chunk` event includes `response` for the frontend ServerLLMClient.
  let payload: Record<string, unknown>
  switch (event.type) {
    case 'chunk':
      payload = { type: 'chunk', response: event.text, done: false }
      break
    case 'usage':
      payload = { type: 'usage', usage: event.usage }
      break
    case 'done':
      payload = { type: 'done' }
      break
    case 'error':
      payload = { type: 'error', error: event.error }
      break
    case 'tool_call':
      // Forward tool calls verbatim to the frontend's ServerLLMClient.
      payload = {
        type: 'tool_call',
        id: event.id,
        name: event.name,
        arguments: event.arguments,
      }
      break
    default: {
      const _exhaustive: never = event
      return
    }
  }
  raw.write(`data: ${JSON.stringify(payload)}\n\n`)
}

// --- Create shared client from upstream config ---

function createClient(config: UpstreamConfig) {
  switch (config.protocol) {
    case 'anthropic':
      return new AnthropicClient({
        apiKey: config.apiKey,
        endpoint: config.endpoint,
      })
    case 'openai-compatible':
      return new OpenAICompatibleClient({
        apiKey: config.apiKey,
        endpoint: config.endpoint,
      })
    case 'cloudflare':
      return new CloudflareClient({
        apiKey: config.apiKey,
        endpoint: config.endpoint,
      })
    default:
      throw new Error(`Unknown protocol: ${config.protocol}`)
  }
}

export async function reserveLlmCredit(userId: number, model: string, amount: number): Promise<{ id: string } | null> {
  return prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: {
        id: userId,
        balance: { gte: amount },
      },
      data: { balance: { decrement: amount } },
    })
    if (result.count !== 1) return null

    const reservedUser = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { balance: true },
    })
    return tx.balanceLedger.create({
      data: {
        userId,
        amount: -amount,
        balanceAfter: reservedUser.balance,
        type: 'LLM_USAGE',
        description: `LLM reservation: ${model}`,
      },
      select: { id: true },
    })
  })
}

// --- Route plugin ---

const llmRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /my/llm/models - List available server-side models
   */
  fastify.get(
    '/llm/models',
    {
      preHandler: requireAuth,
      schema: {
        description: 'List models available through the server-side LLM proxy',
        tags: ['llm'],
        response: {
          200: modelsResponseSchema,
          401: errorSchema,
        },
      },
    },
    async (_request, _reply) => {
      const models = await getPublicModels()
      return { models }
    },
  )

  /**
   * POST /my/llm/generate - Proxy an LLM generation request
   *
   * Streams the response as normalized SSE events.
   */
  fastify.post(
    '/llm/generate',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Proxy an LLM generation request through the server. Streams normalized SSE events.',
        tags: ['llm'],
        body: generateBodySchema,
        response: {
          // 200 is SSE — cannot describe in JSON schema, only document errors
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { model } = request.body

      // Resolve which upstream provider to use
      const upstream = await resolveUpstream(model)
      if (!upstream) {
        return reply.status(400).send({
          error: `Model "${model}" is not available. Use GET /my/llm/models to see available models.`,
        })
      }

      // Reserve the worst-case cost atomically before contacting the upstream.
      // UTF-8 bytes are a deliberately conservative token upper bound for
      // admission; unused credit is refunded during final settlement.
      const user = request.user!
      const inputTokenUpperBound = request.body.messages.reduce(
        (total, message) => total + Buffer.byteLength(message.content, 'utf8'),
        0,
      )
      const outputTokenUpperBound = request.body.max_tokens + (request.body.thinking_budget ?? 0)
      const reservationCost = calculateCost(
        {
          promptTokens: inputTokenUpperBound,
          completionTokens: outputTokenUpperBound,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        },
        upstream.pricing,
      )

      const reservation = await reserveLlmCredit(user.id, upstream.model, reservationCost)

      if (!reservation) {
        return reply.status(403).send({ error: 'Insufficient balance' })
      }

      // Set up SSE response.
      // We must hijack the reply so Fastify doesn't try to send its own
      // response after we've already written to the raw socket. We also
      // merge in Fastify's headers (including CORS from @fastify/cors)
      // because writeHead() on the raw response bypasses Fastify's
      // header pipeline.
      reply.hijack()
      const raw = reply.raw
      // Apply Fastify's headers (CORS etc.) to the raw response first
      for (const [key, value] of Object.entries(reply.getHeaders())) {
        if (value !== undefined) raw.setHeader(key, value)
      }
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      })

      // Abort upstream if client disconnects
      const abortController = new AbortController()
      raw.on('close', () => {
        abortController.abort()
      })

      // Token accumulator — updated from usage events during streaming
      const tokenUsage: TokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      }
      const streamStart = Date.now()
      let streamAborted = false

      const onUsage = (usage: LLMStreamEvent & { type: 'usage' }) => {
        // Use assignment (not +=) — providers send totals, not deltas
        if (usage.usage.prompt_tokens != null) tokenUsage.promptTokens = usage.usage.prompt_tokens
        if (usage.usage.completion_tokens != null) tokenUsage.completionTokens = usage.usage.completion_tokens
        if (usage.usage.cache_creation_input_tokens != null)
          tokenUsage.cacheCreationTokens = usage.usage.cache_creation_input_tokens
        if (usage.usage.cache_read_input_tokens != null)
          tokenUsage.cacheReadTokens = usage.usage.cache_read_input_tokens
      }

      try {
        const client = createClient(upstream)

        // Convert request messages to the shared LLMMessage format
        const messages: LLMMessage[] = request.body.messages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.cache_control ? { cache_control: m.cache_control } : {}),
        }))

        const t0 = Date.now()
        let firstChunkAt: number | undefined
        let chunkCount = 0

        for await (const event of client.generate({
          model: upstream.model,
          messages,
          temperature: request.body.temperature,
          max_tokens: request.body.max_tokens,
          thinking_budget: request.body.thinking_budget,
          ...(request.body.tools ? { tools: request.body.tools } : {}),
          ...(request.body.tool_choice ? { tool_choice: request.body.tool_choice } : {}),
          signal: abortController.signal,
        })) {
          if (event.type === 'chunk' && !firstChunkAt) {
            firstChunkAt = Date.now()
            fastify.log.info({ model: upstream.model, ttfb: firstChunkAt - t0 }, '[llm-proxy] first chunk (TTFB)')
          }
          if (event.type === 'chunk') chunkCount++
          writeSSE(raw, event)
          if (event.type === 'usage') {
            onUsage(event as LLMStreamEvent & { type: 'usage' })
          }
        }

        fastify.log.info(
          {
            model: upstream.model,
            totalMs: Date.now() - t0,
            ttfbMs: firstChunkAt ? firstChunkAt - t0 : null,
            chunks: chunkCount,
          },
          '[llm-proxy] stream complete',
        )
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          streamAborted = true
        } else {
          console.error('[llm-proxy] Upstream error:', err)
          try {
            writeSSE(raw, {
              type: 'error',
              error: err instanceof Error ? err.message : 'Unknown upstream error',
            })
            writeSSE(raw, { type: 'done' })
          } catch {
            // Response may already be closed
          }
        }
      } finally {
        try {
          raw.end()
        } catch {
          /* already ended */
        }

        // Billing settlement: replace the conservative reservation with the
        // actual charge and refund everything unused. A crash before this
        // point leaves the maximum charge reserved rather than giving away an
        // unrecorded upstream request; it can be reconciled from the ledger.
        const hasUsage = tokenUsage.promptTokens > 0 || tokenUsage.completionTokens > 0
        const calculatedCost = hasUsage ? calculateCost(tokenUsage, upstream.pricing) : 0
        const actualCost = Math.min(calculatedCost, reservationCost)
        if (calculatedCost > reservationCost) {
          fastify.log.error(
            { userId: user.id, calculatedCost, reservationCost, model: upstream.model },
            '[billing] Actual LLM cost exceeded its reservation',
          )
        }

        try {
          await prisma.$transaction(async (tx) => {
            const refund = reservationCost - actualCost
            const settledUser =
              refund > 0
                ? await tx.user.update({
                    where: { id: user.id },
                    data: { balance: { increment: refund } },
                    select: { balance: true },
                  })
                : await tx.user.findUniqueOrThrow({
                    where: { id: user.id },
                    select: { balance: true },
                  })

            if (!hasUsage || actualCost <= 0) {
              await tx.balanceLedger.delete({ where: { id: reservation.id } })
              return
            }

            const usageLog = await tx.llmUsageLog.create({
              data: {
                userId: user.id,
                modelId: upstream.model,
                providerName: upstream.provider,
                promptTokens: tokenUsage.promptTokens,
                completionTokens: tokenUsage.completionTokens,
                cacheCreationTokens: tokenUsage.cacheCreationTokens,
                cacheReadTokens: tokenUsage.cacheReadTokens,
                priceInput: upstream.pricing.input,
                priceOutput: upstream.pricing.output,
                priceCacheRead: upstream.pricing.cacheRead,
                priceCacheWrite: upstream.pricing.cacheWrite,
                cost: actualCost,
                durationMs: Date.now() - streamStart,
                aborted: streamAborted,
              },
            })

            await tx.balanceLedger.update({
              where: { id: reservation.id },
              data: {
                amount: -actualCost,
                balanceAfter: settledUser.balance,
                description: `LLM usage: ${upstream.model}`,
                llmUsageLogId: usageLog.id,
              },
            })
          })
        } catch (err) {
          fastify.log.error({ err, reservationId: reservation.id }, '[billing] Failed to settle LLM usage')
        }
      }
    },
  )
}

export default llmRoutes
