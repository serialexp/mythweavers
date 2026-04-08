/**
 * Billing calculation for server-side LLM usage.
 *
 * Cost formula (per call):
 *   regular_input = prompt_tokens - cache_creation_tokens - cache_read_tokens
 *   cost = (regular_input / 1M) * priceInput
 *        + (completion_tokens / 1M) * priceOutput
 *        + (cache_read_tokens / 1M) * (priceCacheRead ?? 0)
 *        + (cache_creation_tokens / 1M) * (priceCacheWrite ?? 0)
 */

const PER_MILLION = 1_000_000

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
}

export interface ModelPricing {
  input: number // per million tokens
  output: number
  cacheRead: number | null
  cacheWrite: number | null
}

/**
 * Calculate the cost of a single LLM call in dollars.
 * Returns a plain number (callers convert to Decimal for DB storage).
 */
export function calculateCost(usage: TokenUsage, pricing: ModelPricing): number {
  // Anthropic's prompt_tokens includes cache tokens — subtract them to
  // avoid double-billing, since they have their own rates.
  const regularInputTokens = Math.max(
    0,
    usage.promptTokens - usage.cacheCreationTokens - usage.cacheReadTokens,
  )

  const inputCost = (regularInputTokens / PER_MILLION) * pricing.input
  const outputCost = (usage.completionTokens / PER_MILLION) * pricing.output
  const cacheReadCost = (usage.cacheReadTokens / PER_MILLION) * (pricing.cacheRead ?? 0)
  const cacheWriteCost = (usage.cacheCreationTokens / PER_MILLION) * (pricing.cacheWrite ?? 0)

  return inputCost + outputCost + cacheReadCost + cacheWriteCost
}
