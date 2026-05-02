import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'

const errorSchema = z.object({ error: z.string() })

const usageEntrySchema = z.object({
  id: z.string(),
  type: z.enum(['CREDIT', 'TOPUP', 'LLM_USAGE', 'IMAGE_USAGE', 'ADJUSTMENT']),
  amount: z.string().meta({ description: 'Signed amount as Decimal string' }),
  balanceAfter: z.string().meta({ description: 'Running balance after this entry' }),
  description: z.string(),
  createdAt: z.string().meta({ description: 'ISO 8601 timestamp' }),
  // LLM usage details (only present for LLM_USAGE entries)
  llmUsage: z
    .object({
      modelId: z.string(),
      providerName: z.string(),
      promptTokens: z.number(),
      completionTokens: z.number(),
      cacheCreationTokens: z.number(),
      cacheReadTokens: z.number(),
      cost: z.string().meta({ description: 'Cost as Decimal string' }),
      durationMs: z.number().nullable(),
      aborted: z.boolean(),
    })
    .nullable(),
})

const usageResponseSchema = z.object({
  entries: z.array(usageEntrySchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
  /** Aggregate stats for the requested time range */
  summary: z.object({
    totalSpent: z.string().meta({ description: 'Total LLM spending as Decimal string' }),
    totalTopUps: z.string().meta({ description: 'Total top-ups as Decimal string' }),
    generationCount: z.number().meta({ description: 'Number of LLM generations' }),
  }),
})

const usageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
  type: z.enum(['CREDIT', 'TOPUP', 'LLM_USAGE', 'IMAGE_USAGE', 'ADJUSTMENT']).optional(),
  since: z.string().datetime().optional().meta({ description: 'ISO 8601 lower bound for createdAt' }),
})

const modelBreakdownQuerySchema = z.object({
  since: z.string().datetime().optional().meta({ description: 'ISO 8601 lower bound for createdAt' }),
})

// --- Model cost breakdown schemas ---

const modelCostBreakdownEntrySchema = z.object({
  modelId: z.string(),
  inputCost: z.number().meta({ description: 'Cost of regular (non-cache) input tokens' }),
  outputCost: z.number().meta({ description: 'Cost of output/completion tokens' }),
  cacheReadCost: z.number().meta({ description: 'Cost of cache-read tokens' }),
  cacheWriteCost: z.number().meta({ description: 'Cost of cache-write tokens' }),
  totalCost: z.number().meta({ description: 'Sum of all cost components' }),
  generationCount: z.number().meta({ description: 'Number of generations for this model' }),
})

const modelCostBreakdownResponseSchema = z.object({
  models: z.array(modelCostBreakdownEntrySchema),
  grandTotal: z.number().meta({ description: 'Sum of all model costs' }),
})

const usageRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /my/balance/usage — paginated usage history with LLM details
   */
  fastify.get(
    '/balance/usage',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Get paginated balance usage history with optional LLM usage details',
        tags: ['balance'],
        querystring: usageQuerySchema,
        response: {
          200: usageResponseSchema,
          401: errorSchema,
        },
      },
    },
    async (request) => {
      const userId = request.user!.id
      const { page, pageSize, type, since } = request.query

      const createdAtFilter = since ? { gte: new Date(since) } : undefined
      const where = {
        userId,
        ...(type ? { type } : {}),
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      }

      const [entries, total, spentAgg, topUpAgg, genCount] = await Promise.all([
        prisma.balanceLedger.findMany({
          where,
          include: {
            llmUsageLog: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.balanceLedger.count({ where }),
        // Total LLM spending (negative amounts for LLM_USAGE)
        prisma.balanceLedger.aggregate({
          where: { userId, type: 'LLM_USAGE', ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) },
          _sum: { amount: true },
        }),
        // Total top-ups
        prisma.balanceLedger.aggregate({
          where: { userId, type: { in: ['TOPUP', 'CREDIT'] }, ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) },
          _sum: { amount: true },
        }),
        // Generation count
        prisma.balanceLedger.count({
          where: { userId, type: 'LLM_USAGE', ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) },
        }),
      ])

      return {
        entries: entries.map((e) => ({
          id: e.id,
          type: e.type,
          amount: e.amount.toString(),
          balanceAfter: e.balanceAfter.toString(),
          description: e.description,
          createdAt: e.createdAt.toISOString(),
          llmUsage: e.llmUsageLog
            ? {
                modelId: e.llmUsageLog.modelId,
                providerName: e.llmUsageLog.providerName,
                promptTokens: e.llmUsageLog.promptTokens,
                completionTokens: e.llmUsageLog.completionTokens,
                cacheCreationTokens: e.llmUsageLog.cacheCreationTokens,
                cacheReadTokens: e.llmUsageLog.cacheReadTokens,
                cost: e.llmUsageLog.cost.toString(),
                durationMs: e.llmUsageLog.durationMs,
                aborted: e.llmUsageLog.aborted,
              }
            : null,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        summary: {
          // spent is negative in ledger, so negate for display
          totalSpent: (
            Number(spentAgg._sum.amount ?? 0) * -1
          ).toString(),
          totalTopUps: (topUpAgg._sum.amount ?? 0).toString(),
          generationCount: genCount,
        },
      }
    },
  )
  /**
   * GET /my/balance/usage/model-breakdown — cost breakdown by model and token type
   */
  fastify.get(
    '/balance/usage/model-breakdown',
    {
      preHandler: requireAuth,
      schema: {
        description:
          'Aggregate LLM costs grouped by model, split into input/output/cache-read/cache-write components',
        tags: ['balance'],
        querystring: modelBreakdownQuerySchema,
        response: {
          200: modelCostBreakdownResponseSchema,
          401: errorSchema,
        },
      },
    },
    async (request) => {
      const userId = request.user!.id
      const { since } = request.query

      const createdAtFilter = since ? { gte: new Date(since) } : undefined
      const rows = await prisma.llmUsageLog.findMany({
        where: { userId, ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) },
        select: {
          modelId: true,
          promptTokens: true,
          completionTokens: true,
          cacheCreationTokens: true,
          cacheReadTokens: true,
          priceInput: true,
          priceOutput: true,
          priceCacheRead: true,
          priceCacheWrite: true,
        },
      })

      // Aggregate per model
      const byModel = new Map<
        string,
        {
          inputCost: number
          outputCost: number
          cacheReadCost: number
          cacheWriteCost: number
          generationCount: number
        }
      >()

      const PER_MILLION = 1_000_000

      for (const row of rows) {
        let entry = byModel.get(row.modelId)
        if (!entry) {
          entry = {
            inputCost: 0,
            outputCost: 0,
            cacheReadCost: 0,
            cacheWriteCost: 0,
            generationCount: 0,
          }
          byModel.set(row.modelId, entry)
        }

        const regularInput = Math.max(
          0,
          row.promptTokens - row.cacheCreationTokens - row.cacheReadTokens,
        )

        entry.inputCost += (regularInput / PER_MILLION) * row.priceInput
        entry.outputCost += (row.completionTokens / PER_MILLION) * row.priceOutput
        entry.cacheReadCost +=
          (row.cacheReadTokens / PER_MILLION) * (row.priceCacheRead ?? 0)
        entry.cacheWriteCost +=
          (row.cacheCreationTokens / PER_MILLION) * (row.priceCacheWrite ?? 0)
        entry.generationCount += 1
      }

      let grandTotal = 0
      const models = Array.from(byModel.entries())
        .map(([modelId, entry]) => {
          const totalCost =
            entry.inputCost + entry.outputCost + entry.cacheReadCost + entry.cacheWriteCost
          grandTotal += totalCost
          return {
            modelId,
            inputCost: entry.inputCost,
            outputCost: entry.outputCost,
            cacheReadCost: entry.cacheReadCost,
            cacheWriteCost: entry.cacheWriteCost,
            totalCost,
            generationCount: entry.generationCount,
          }
        })
        .sort((a, b) => b.totalCost - a.totalCost) // Highest cost first

      return { models, grandTotal }
    },
  )
}

export default usageRoutes
