/**
 * Provider cost-fetching functions.
 * Used by both the admin sync-costs endpoint and the automated cost sync scheduler.
 */

import { prisma } from './prisma.js'

export type DailyCost = { date: string; amount: number }

/**
 * Fetch daily costs from Anthropic's Admin API cost_report endpoint.
 * Requires an admin key (sk-ant-admin...).
 */
export async function fetchAnthropicCosts(
  apiKey: string,
  startDate: string,
  endDate: string,
): Promise<DailyCost[]> {
  const url = new URL('https://api.anthropic.com/v1/organizations/cost_report')
  url.searchParams.set('start_date', startDate)
  url.searchParams.set('end_date', endDate)
  url.searchParams.set('interval', '1d')

  const res = await fetch(url.toString(), {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Anthropic cost API returned ${res.status}: ${text.slice(0, 500)}`)
  }

  const body = (await res.json()) as {
    data?: Array<{
      date?: string
      total_cost_usd?: string | number
    }>
  }

  if (!body.data || !Array.isArray(body.data)) {
    throw new Error('Unexpected response format from Anthropic cost API')
  }

  return body.data.map((entry) => ({
    date: entry.date ?? startDate,
    amount:
      typeof entry.total_cost_usd === 'string'
        ? Number.parseFloat(entry.total_cost_usd)
        : (entry.total_cost_usd ?? 0),
  }))
}

/**
 * Fetch daily costs from OpenAI's /v1/organization/costs endpoint.
 * Requires an admin API key.
 * Handles pagination via `has_more` / `next_page`.
 */
export async function fetchOpenAICosts(
  apiKey: string,
  startDate: string,
  endDate: string,
): Promise<DailyCost[]> {
  const startTime = Math.floor(new Date(startDate).getTime() / 1000)
  const endTime = Math.floor(new Date(endDate).getTime() / 1000)

  const allBuckets: DailyCost[] = []
  let nextPage: string | undefined

  do {
    const url = new URL('https://api.openai.com/v1/organization/costs')
    url.searchParams.set('start_time', String(startTime))
    url.searchParams.set('end_time', String(endTime))
    url.searchParams.set('bucket_width', '1d')
    if (nextPage) {
      url.searchParams.set('page', nextPage)
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`OpenAI cost API returned ${res.status}: ${text.slice(0, 500)}`)
    }

    const body = (await res.json()) as {
      data?: Array<{
        start_time?: number
        results?: Array<{
          amount?: { value?: number }
        }>
      }>
      has_more?: boolean
      next_page?: string
    }

    if (body.data && Array.isArray(body.data)) {
      for (const bucket of body.data) {
        const bucketDate = bucket.start_time
          ? new Date(bucket.start_time * 1000).toISOString().slice(0, 10)
          : startDate
        const amount = (bucket.results ?? []).reduce(
          (sum, item) => sum + (item.amount?.value ?? 0),
          0,
        )
        // OpenAI returns amounts in cents, convert to dollars
        allBuckets.push({ date: bucketDate, amount: amount / 100 })
      }
    }

    nextPage = body.has_more ? body.next_page : undefined
  } while (nextPage)

  return allBuckets
}

/**
 * Sync daily costs for a provider into the ledger.
 * Uses upsert so re-syncing the same day updates the amount instead of skipping.
 */
export async function syncProviderCosts(
  providerId: string,
  providerSlug: string,
  dailyCosts: DailyCost[],
): Promise<{ synced: number; updated: number; totalCost: number }> {
  let synced = 0
  let updated = 0

  for (const cost of dailyCosts) {
    if (cost.amount <= 0) continue

    const syncKey = `${providerSlug}:${cost.date}`

    const existing = await prisma.llmProviderTransaction.findUnique({
      where: { syncKey },
    })

    if (existing) {
      // Update if amount changed
      if (existing.amount.toNumber() !== cost.amount) {
        await prisma.llmProviderTransaction.update({
          where: { syncKey },
          data: {
            amount: cost.amount,
            notes: `Auto-synced cost for ${cost.date} (updated)`,
          },
        })
        updated++
      }
    } else {
      await prisma.llmProviderTransaction.create({
        data: {
          providerId,
          type: 'COST_SYNC',
          amount: cost.amount,
          date: new Date(cost.date),
          notes: `Auto-synced cost for ${cost.date}`,
          syncKey,
        },
      })
      synced++
    }
  }

  const totalCost = dailyCosts.reduce((sum, c) => sum + c.amount, 0)
  return { synced, updated, totalCost }
}
