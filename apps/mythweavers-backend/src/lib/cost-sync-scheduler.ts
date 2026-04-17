/**
 * Automated cost sync scheduler.
 *
 * Runs every hour and syncs today's and yesterday's costs for all
 * enabled providers that support cost APIs (Anthropic, OpenAI).
 *
 * Uses upsert logic so re-syncing the same day updates the amount
 * as costs accumulate throughout the day.
 */

import type { FastifyBaseLogger } from 'fastify'
import { prisma } from './prisma.js'
import {
  fetchAnthropicCosts,
  fetchOpenAICosts,
  syncProviderCosts,
} from './provider-costs.js'

const ONE_HOUR_MS = 60 * 60 * 1000
const STARTUP_DELAY_MS = 10 * 1000 // Wait 10s after server start before first sync

let intervalHandle: ReturnType<typeof setInterval> | null = null
let startupTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Get YYYY-MM-DD for today and yesterday in UTC.
 */
function getSyncDateRange(): { startDate: string; endDate: string } {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  const yesterday = new Date(now)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  return { startDate: yesterdayStr, endDate: today }
}

/**
 * Resolve the API key for cost sync. Tries dedicated admin key first,
 * then falls back to the provider's inference key.
 */
function resolveApiKey(protocol: string, envKeyName: string): string | null {
  const adminKeyEnvName =
    protocol === 'ANTHROPIC' ? 'ANTHROPIC_ADMIN_API_KEY' : 'OPENAI_ADMIN_API_KEY'
  return process.env[adminKeyEnvName] || process.env[envKeyName] || null
}

/**
 * Run a single cost sync cycle for all eligible providers.
 */
async function runCostSync(log: FastifyBaseLogger): Promise<void> {
  const { startDate, endDate } = getSyncDateRange()

  // Find all enabled providers that support cost sync
  const providers = await prisma.llmProvider.findMany({
    where: {
      enabled: true,
      protocol: { in: ['ANTHROPIC', 'OPENAI_COMPATIBLE'] },
    },
  })

  if (providers.length === 0) {
    log.debug('Cost sync: no eligible providers found')
    return
  }

  for (const provider of providers) {
    const apiKey = resolveApiKey(provider.protocol, provider.envKeyName)
    if (!apiKey) {
      log.debug(
        { provider: provider.name },
        'Cost sync: skipping provider (no API key configured)',
      )
      continue
    }

    try {
      const dailyCosts =
        provider.protocol === 'ANTHROPIC'
          ? await fetchAnthropicCosts(apiKey, startDate, endDate)
          : await fetchOpenAICosts(apiKey, startDate, endDate)

      const result = await syncProviderCosts(provider.id, provider.name, dailyCosts)

      if (result.synced > 0 || result.updated > 0) {
        log.info(
          {
            provider: provider.name,
            synced: result.synced,
            updated: result.updated,
            totalCost: result.totalCost.toFixed(6),
            range: `${startDate} → ${endDate}`,
          },
          'Cost sync: updated provider costs',
        )
      } else {
        log.debug(
          { provider: provider.name, range: `${startDate} → ${endDate}` },
          'Cost sync: no changes',
        )
      }
    } catch (err) {
      log.error(
        {
          provider: provider.name,
          error: err instanceof Error ? err.message : String(err),
        },
        'Cost sync: failed for provider',
      )
      // Continue with other providers — don't let one failure stop the rest
    }
  }
}

/**
 * Start the cost sync scheduler.
 * Runs an initial sync after a short delay, then every hour.
 */
export function startCostSyncScheduler(log: FastifyBaseLogger): void {
  log.info('Cost sync scheduler: starting (interval: 1 hour)')

  // Initial sync after startup delay
  startupTimeout = setTimeout(async () => {
    log.info('Cost sync scheduler: running initial sync')
    await runCostSync(log)

    // Then schedule hourly
    intervalHandle = setInterval(async () => {
      log.debug('Cost sync scheduler: running hourly sync')
      await runCostSync(log)
    }, ONE_HOUR_MS)
  }, STARTUP_DELAY_MS)
}

/**
 * Stop the cost sync scheduler. Called during graceful shutdown.
 */
export function stopCostSyncScheduler(): void {
  if (startupTimeout) {
    clearTimeout(startupTimeout)
    startupTimeout = null
  }
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}
