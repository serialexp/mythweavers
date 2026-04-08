import Anthropic from '@anthropic-ai/sdk'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAdmin } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'

// --- Shared schemas ---

const errorSchema = z.object({ error: z.string() })

const protocolEnum = z.enum(['ANTHROPIC', 'OPENAI_COMPATIBLE', 'CLOUDFLARE'])

const providerSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  endpointUrl: z.string(),
  protocol: protocolEnum,
  envKeyName: z.string(),
  enabled: z.boolean(),
  sortOrder: z.number(),
  keyConfigured: z.boolean().meta({ description: 'Whether the env var for the API key is set' }),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const modelSchema = z.object({
  id: z.string(),
  modelId: z.string(),
  displayName: z.string().nullable(),
  providerId: z.string(),
  enabled: z.boolean(),
  contextLength: z.number().nullable(),
  costInput: z.number(),
  costOutput: z.number(),
  costCacheRead: z.number().nullable(),
  costCacheWrite: z.number().nullable(),
  priceInput: z.number(),
  priceOutput: z.number(),
  priceCacheRead: z.number().nullable(),
  priceCacheWrite: z.number().nullable(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

// --- Input schemas ---

const createProviderSchema = z.object({
  name: z.string().min(1).max(50).meta({ description: 'Unique slug, e.g. "moonshot"', example: 'moonshot' }),
  displayName: z.string().min(1).max(100).meta({ description: 'Human-readable name', example: 'Moonshot AI' }),
  endpointUrl: z.string().url().meta({ description: 'Base API URL', example: 'https://api.moonshot.cn' }),
  protocol: protocolEnum.meta({ description: 'Streaming protocol', example: 'OPENAI_COMPATIBLE' }),
  envKeyName: z.string().min(1).meta({ description: 'Env var name for API key', example: 'LLM_PROVIDER_MOONSHOT_API_KEY' }),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

const updateProviderSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  endpointUrl: z.string().url().optional(),
  protocol: protocolEnum.optional(),
  envKeyName: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

const createModelSchema = z.object({
  modelId: z.string().min(1).meta({ description: 'Model ID sent to the API', example: 'moonshot-v1-8k' }),
  displayName: z.string().optional(),
  enabled: z.boolean().optional(),
  contextLength: z.number().int().positive().optional(),
  costInput: z.number().min(0).optional(),
  costOutput: z.number().min(0).optional(),
  costCacheRead: z.number().min(0).nullable().optional(),
  costCacheWrite: z.number().min(0).nullable().optional(),
  priceInput: z.number().min(0).optional(),
  priceOutput: z.number().min(0).optional(),
  priceCacheRead: z.number().min(0).nullable().optional(),
  priceCacheWrite: z.number().min(0).nullable().optional(),
  sortOrder: z.number().int().optional(),
})

const updateModelSchema = createModelSchema.partial()

const idParam = z.object({ id: z.string() })
const providerIdParam = z.object({ providerId: z.string() })

// --- Helpers ---

function enrichProvider(p: any) {
  return {
    ...p,
    keyConfigured: !!process.env[p.envKeyName],
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

function enrichModel(m: any) {
  return {
    ...m,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }
}

// --- Route plugin ---

const adminLlmRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // =====================
  // PROVIDERS
  // =====================

  /** List all providers */
  fastify.get(
    '/llm/providers',
    {
      preHandler: requireAdmin,
      schema: {
        description: 'List all LLM providers (including disabled)',
        tags: ['admin-llm'],
        response: {
          200: z.object({ providers: z.array(providerSchema) }),
          401: errorSchema,
          403: errorSchema,
        },
      },
    },
    async () => {
      const providers = await prisma.llmProvider.findMany({
        orderBy: { sortOrder: 'asc' },
      })
      return { providers: providers.map(enrichProvider) }
    },
  )

  /** Get single provider with its models */
  fastify.get(
    '/llm/providers/:id',
    {
      preHandler: requireAdmin,
      schema: {
        description: 'Get a provider with its models',
        tags: ['admin-llm'],
        params: idParam,
        response: {
          200: z.object({ provider: providerSchema, models: z.array(modelSchema) }),
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const provider = await prisma.llmProvider.findUnique({
        where: { id: request.params.id },
        include: { models: { orderBy: { sortOrder: 'asc' } } },
      })
      if (!provider) return reply.status(404).send({ error: 'Provider not found' })

      return {
        provider: enrichProvider(provider),
        models: provider.models.map(enrichModel),
      }
    },
  )

  /** Create provider */
  fastify.post(
    '/llm/providers',
    {
      preHandler: requireAdmin,
      schema: {
        description: 'Create a new LLM provider',
        tags: ['admin-llm'],
        body: createProviderSchema,
        response: {
          201: z.object({ provider: providerSchema }),
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const provider = await prisma.llmProvider.create({
          data: {
            name: request.body.name,
            displayName: request.body.displayName,
            endpointUrl: request.body.endpointUrl.replace(/\/+$/, ''),
            protocol: request.body.protocol,
            envKeyName: request.body.envKeyName,
            enabled: request.body.enabled ?? true,
            sortOrder: request.body.sortOrder ?? 0,
          },
        })
        return reply.status(201).send({ provider: enrichProvider(provider) })
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.status(409).send({ error: `Provider with name "${request.body.name}" already exists` })
        }
        throw err
      }
    },
  )

  /** Update provider */
  fastify.put(
    '/llm/providers/:id',
    {
      preHandler: requireAdmin,
      schema: {
        description: 'Update an LLM provider',
        tags: ['admin-llm'],
        params: idParam,
        body: updateProviderSchema,
        response: {
          200: z.object({ provider: providerSchema }),
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const data: any = { ...request.body }
      if (data.endpointUrl) data.endpointUrl = data.endpointUrl.replace(/\/+$/, '')

      try {
        const provider = await prisma.llmProvider.update({
          where: { id: request.params.id },
          data,
        })
        return { provider: enrichProvider(provider) }
      } catch (err: any) {
        if (err.code === 'P2025') {
          return reply.status(404).send({ error: 'Provider not found' })
        }
        throw err
      }
    },
  )

  /** Delete provider (cascades to models) */
  fastify.delete(
    '/llm/providers/:id',
    {
      preHandler: requireAdmin,
      schema: {
        description: 'Delete an LLM provider and all its models',
        tags: ['admin-llm'],
        params: idParam,
        response: {
          200: z.object({ success: z.literal(true) }),
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        await prisma.llmProvider.delete({ where: { id: request.params.id } })
        return { success: true as const }
      } catch (err: any) {
        if (err.code === 'P2025') {
          return reply.status(404).send({ error: 'Provider not found' })
        }
        throw err
      }
    },
  )

  // =====================
  // MODELS
  // =====================

  /** List models for a provider */
  fastify.get(
    '/llm/providers/:providerId/models',
    {
      preHandler: requireAdmin,
      schema: {
        description: 'List all models for a provider',
        tags: ['admin-llm'],
        params: providerIdParam,
        response: {
          200: z.object({ models: z.array(modelSchema) }),
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const provider = await prisma.llmProvider.findUnique({
        where: { id: request.params.providerId },
      })
      if (!provider) return reply.status(404).send({ error: 'Provider not found' })

      const models = await prisma.llmModel.findMany({
        where: { providerId: request.params.providerId },
        orderBy: { sortOrder: 'asc' },
      })
      return { models: models.map(enrichModel) }
    },
  )

  /** Create model under a provider */
  fastify.post(
    '/llm/providers/:providerId/models',
    {
      preHandler: requireAdmin,
      schema: {
        description: 'Create a model under a provider',
        tags: ['admin-llm'],
        params: providerIdParam,
        body: createModelSchema,
        response: {
          201: z.object({ model: modelSchema }),
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const provider = await prisma.llmProvider.findUnique({
        where: { id: request.params.providerId },
      })
      if (!provider) return reply.status(404).send({ error: 'Provider not found' })

      try {
        const model = await prisma.llmModel.create({
          data: {
            modelId: request.body.modelId,
            displayName: request.body.displayName,
            providerId: request.params.providerId,
            enabled: request.body.enabled ?? true,
            contextLength: request.body.contextLength,
            costInput: request.body.costInput ?? 0,
            costOutput: request.body.costOutput ?? 0,
            costCacheRead: request.body.costCacheRead,
            costCacheWrite: request.body.costCacheWrite,
            priceInput: request.body.priceInput ?? 0,
            priceOutput: request.body.priceOutput ?? 0,
            priceCacheRead: request.body.priceCacheRead,
            priceCacheWrite: request.body.priceCacheWrite,
            sortOrder: request.body.sortOrder ?? 0,
          },
        })
        return reply.status(201).send({ model: enrichModel(model) })
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply
            .status(409)
            .send({ error: `Model "${request.body.modelId}" already exists for this provider` })
        }
        throw err
      }
    },
  )

  /** Get single model */
  fastify.get(
    '/llm/models/:id',
    {
      preHandler: requireAdmin,
      schema: {
        description: 'Get a single model by ID',
        tags: ['admin-llm'],
        params: idParam,
        response: {
          200: z.object({ model: modelSchema }),
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const model = await prisma.llmModel.findUnique({
        where: { id: request.params.id },
      })
      if (!model) return reply.status(404).send({ error: 'Model not found' })
      return { model: enrichModel(model) }
    },
  )

  /** Update model */
  fastify.put(
    '/llm/models/:id',
    {
      preHandler: requireAdmin,
      schema: {
        description: 'Update a model',
        tags: ['admin-llm'],
        params: idParam,
        body: updateModelSchema,
        response: {
          200: z.object({ model: modelSchema }),
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const model = await prisma.llmModel.update({
          where: { id: request.params.id },
          data: request.body,
        })
        return { model: enrichModel(model) }
      } catch (err: any) {
        if (err.code === 'P2025') {
          return reply.status(404).send({ error: 'Model not found' })
        }
        throw err
      }
    },
  )

  /** Delete model */
  fastify.delete(
    '/llm/models/:id',
    {
      preHandler: requireAdmin,
      schema: {
        description: 'Delete a model',
        tags: ['admin-llm'],
        params: idParam,
        response: {
          200: z.object({ success: z.literal(true) }),
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        await prisma.llmModel.delete({ where: { id: request.params.id } })
        return { success: true as const }
      } catch (err: any) {
        if (err.code === 'P2025') {
          return reply.status(404).send({ error: 'Model not found' })
        }
        throw err
      }
    },
  )
  // =====================
  // DISCOVER MODELS
  // =====================

  /** Fetch available models from the provider's upstream API */
  fastify.get(
    '/llm/providers/:providerId/discover',
    {
      preHandler: requireAdmin,
      schema: {
        description:
          'Fetch available models from the upstream provider API. Returns discovered models and indicates which are already imported.',
        tags: ['admin-llm'],
        params: providerIdParam,
        response: {
          200: z.object({
            models: z.array(
              z.object({
                id: z.string().meta({ description: 'Model ID from the provider' }),
                name: z.string().nullable().meta({ description: 'Display name if available' }),
                owned_by: z.string().nullable().meta({ description: 'Creator/owner of the model' }),
                created: z.number().nullable().meta({ description: 'Unix timestamp of creation' }),
                imported: z.boolean().meta({ description: 'Whether this model is already in our database' }),
              }),
            ),
          }),
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          502: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const provider = await prisma.llmProvider.findUnique({
        where: { id: request.params.providerId },
        include: { models: { select: { modelId: true } } },
      })
      if (!provider) return reply.status(404).send({ error: 'Provider not found' })

      const apiKey = process.env[provider.envKeyName]
      if (!apiKey) {
        return reply.status(502).send({
          error: `API key not configured (env var ${provider.envKeyName} is not set)`,
        })
      }

      // Build request based on protocol
      const headers: Record<string, string> =
        provider.protocol === 'ANTHROPIC'
          ? {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            }
          : {
              Authorization: `Bearer ${apiKey}`,
            }

      let url = `${provider.endpointUrl}/v1/models`
      // Anthropic requires a limit param
      if (provider.protocol === 'ANTHROPIC') {
        url += '?limit=100'
      }

      let res: Response
      try {
        res = await fetch(url, { headers })
      } catch (err) {
        return reply.status(502).send({
          error: `Failed to connect to ${provider.endpointUrl}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        })
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return reply.status(502).send({
          error: `Provider API returned ${res.status}: ${text.slice(0, 500)}`,
        })
      }

      const body = (await res.json()) as {
        data?: Array<{ id: string; name?: string; owned_by?: string; created?: number; created_at?: string; display_name?: string }>
      }
      const rawModels = body.data ?? []
      const existingIds = new Set(provider.models.map((m) => m.modelId))

      const models = rawModels.map((m) => ({
        id: m.id,
        name: m.display_name ?? m.name ?? null,
        owned_by: m.owned_by ?? null,
        created: m.created ?? (m.created_at ? Math.floor(new Date(m.created_at).getTime() / 1000) : null),
        imported: existingIds.has(m.id),
      }))

      // Sort: non-imported first, then alphabetically
      models.sort((a, b) => {
        if (a.imported !== b.imported) return a.imported ? 1 : -1
        return a.id.localeCompare(b.id)
      })

      return { models }
    },
  )

  // =====================
  // PRICING LOOKUP
  // =====================

  const pricingResultSchema = z.object({
    modelId: z.string(),
    costInput: z.number().nullable().meta({ description: 'Cost per million input tokens (what we pay)' }),
    costOutput: z.number().nullable().meta({ description: 'Cost per million output tokens (what we pay)' }),
    costCacheRead: z.number().nullable().meta({ description: 'Cost per million cached read tokens' }),
    costCacheWrite: z.number().nullable().meta({ description: 'Cost per million cached write tokens' }),
    contextLength: z.number().nullable().meta({ description: 'Context window size in tokens' }),
    source: z.string().nullable().meta({ description: 'URL or description of where pricing was found' }),
  })

  /** Use Claude with web search to look up model pricing */
  fastify.post(
    '/llm/models/lookup-pricing',
    {
      preHandler: requireAdmin,
      schema: {
        description:
          'Use Claude with web search to look up current pricing for the given model IDs. Requires LLM_PROVIDER_ANTHROPIC_API_KEY to be set.',
        tags: ['admin-llm'],
        body: z.object({
          modelIds: z.array(z.string().min(1)).min(1).max(20).meta({
            description: 'Model IDs to look up pricing for',
            example: ['claude-sonnet-4-5-20250929', 'gpt-4o'],
          }),
          providerName: z.string().optional().meta({
            description: 'Provider name to help narrow the search',
            example: 'Anthropic',
          }),
        }),
        response: {
          200: z.object({ results: z.array(pricingResultSchema) }),
          401: errorSchema,
          403: errorSchema,
          502: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const apiKey = process.env.LLM_PROVIDER_ANTHROPIC_API_KEY
      if (!apiKey) {
        return reply.status(502).send({
          error: 'LLM_PROVIDER_ANTHROPIC_API_KEY is not set — cannot call Claude for pricing lookup',
        })
      }

      const { modelIds, providerName } = request.body

      const client = new Anthropic({ apiKey })

      const modelList = modelIds.map((id) => `- ${id}`).join('\n')
      const providerHint = providerName ? ` from the provider "${providerName}"` : ''

      const userPrompt = `Look up the current API pricing for these LLM models${providerHint}. I need the cost per million tokens for input and output, cache read and cache write costs if available, and the context window size.

Models to look up:
${modelList}

After you've finished searching, return your findings as a JSON array with this exact schema for each model:
{
  "modelId": "the-model-id",
  "costInput": <number or null — cost per million INPUT tokens in USD>,
  "costOutput": <number or null — cost per million OUTPUT tokens in USD>,
  "costCacheRead": <number or null — cost per million CACHE READ tokens in USD>,
  "costCacheWrite": <number or null — cost per million CACHE WRITE tokens in USD>,
  "contextLength": <number or null — context window in tokens>,
  "source": "<URL where you found this information>"
}

Return ONLY the JSON array, no markdown fences, no explanation text before or after.`

      // Run the agentic loop — server-side tools (web_search) may need
      // multiple rounds. Continue on "pause_turn" (tool loop hit iteration
      // limit) up to a reasonable cap.
      const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]
      let response: Anthropic.Message
      let continuations = 0
      const MAX_CONTINUATIONS = 5

      do {
        response = await client.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 4096,
          tools: [
            { type: 'web_search_20250305' as const, name: 'web_search' as const },
          ],
          messages,
        })

        // Append the assistant response for potential continuation
        messages.push({ role: 'assistant', content: response.content })
        continuations++
      } while (response.stop_reason === 'pause_turn' && continuations < MAX_CONTINUATIONS)

      // Collect ALL text blocks from the final response — the JSON answer
      // is typically in the last one, after intermediate reasoning.
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      )

      // Try parsing from last text block first, then fall back to earlier ones
      let parsed: unknown = null
      let parseError = ''

      for (let i = textBlocks.length - 1; i >= 0; i--) {
        const rawText = textBlocks[i].text
        const jsonText = rawText
          .replace(/^```(?:json)?\s*\n?/m, '')
          .replace(/\n?```\s*$/m, '')
          .trim()

        // Try to extract a JSON array from the text (it might have prose around it)
        const arrayMatch = jsonText.match(/\[[\s\S]*\]/)
        const candidate = arrayMatch ? arrayMatch[0] : jsonText

        try {
          const result = JSON.parse(candidate)
          if (Array.isArray(result)) {
            parsed = result
            break
          }
        } catch {
          parseError = rawText.slice(0, 300)
        }
      }

      if (!Array.isArray(parsed)) {
        const allText = textBlocks.map((b) => b.text).join('\n---\n')
        return reply.status(502).send({
          error: `Failed to extract JSON array from Claude response (${textBlocks.length} text blocks, stop_reason: ${response.stop_reason}): ${parseError || allText.slice(0, 500)}`,
        })
      }

      const results = parsed.map((item: Record<string, unknown>) => ({
        modelId: String(item.modelId ?? ''),
        costInput: typeof item.costInput === 'number' ? item.costInput : null,
        costOutput: typeof item.costOutput === 'number' ? item.costOutput : null,
        costCacheRead: typeof item.costCacheRead === 'number' ? item.costCacheRead : null,
        costCacheWrite: typeof item.costCacheWrite === 'number' ? item.costCacheWrite : null,
        contextLength: typeof item.contextLength === 'number' ? item.contextLength : null,
        source: typeof item.source === 'string' ? item.source : null,
      }))

      return { results }
    },
  )
}

export default adminLlmRoutes
