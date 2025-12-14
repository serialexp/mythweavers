import { Message, TokenUsage } from '../types/core'

/**
 * Gets standardized token usage from a message, converting from legacy fields if needed
 */
export function getTokenUsage(message: Message): TokenUsage | undefined {
  // Prefer the new tokenUsage field
  if (message.tokenUsage) {
    return message.tokenUsage
  }
  
  // Fall back to legacy fields
  if (message.promptTokens || message.totalTokens) {
    const totalPromptTokens = message.promptTokens || 0
    const cacheReadTokens = message.cacheReadTokens || 0
    const cacheWriteTokens = message.cacheCreationTokens || 0
    const regularInputTokens = Math.max(0, totalPromptTokens - cacheReadTokens - cacheWriteTokens)
    
    return {
      input_normal: regularInputTokens,
      input_cache_read: cacheReadTokens,
      input_cache_write: cacheWriteTokens,
      output_normal: message.totalTokens || 0
    }
  }
  
  return undefined
}

/**
 * Calculate the total cost for token usage given pricing information
 */
export function calculateTokenCost(
  tokenUsage: TokenUsage,
  pricing: {
    input: number // Price per million tokens
    output: number // Price per million tokens
    input_cache_read?: number // Cache read price per million tokens
    input_cache_write?: number // Cache write price per million tokens
  }
): number {
  const inputPrice = pricing.input / 1_000_000
  const outputPrice = pricing.output / 1_000_000
  const cacheReadPrice = pricing.input_cache_read ? pricing.input_cache_read / 1_000_000 : inputPrice * 0.1
  const cacheWritePrice = pricing.input_cache_write ? pricing.input_cache_write / 1_000_000 : inputPrice * 1.25
  
  return (
    tokenUsage.input_normal * inputPrice +
    tokenUsage.input_cache_read * cacheReadPrice +
    tokenUsage.input_cache_write * cacheWritePrice +
    tokenUsage.output_normal * outputPrice
  )
}

/**
 * Get total input tokens (including cached)
 */
export function getTotalInputTokens(tokenUsage: TokenUsage): number {
  return tokenUsage.input_normal + tokenUsage.input_cache_read + tokenUsage.input_cache_write
}

/**
 * Get total tokens (input + output)
 */
export function getTotalTokens(tokenUsage: TokenUsage): number {
  return getTotalInputTokens(tokenUsage) + tokenUsage.output_normal
}