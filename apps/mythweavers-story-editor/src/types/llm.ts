// Common types for all LLM providers

import { TokenUsage } from './core'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  cache_control?: {
    type: 'ephemeral'
    ttl?: '5m' | '1h' | number  // number in seconds
  }
}

export interface LLMGenerateOptions {
  model: string
  messages: LLMMessage[]
  stream: boolean
  temperature?: number
  max_tokens?: number
  thinking_budget?: number
  // Provider-specific options can be added via extension
  providerOptions?: Record<string, any>
  metadata?: Record<string, unknown>
  // Abort signal for cancelling requests
  signal?: AbortSignal
}

export interface LLMGenerateResponse {
  response?: string
  done?: boolean
  eval_count?: number
  prompt_eval_count?: number
  // Token usage information
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
    cache_creation?: Record<string, number | undefined>
  }
}

// Model pricing information (cost per million tokens)
export interface ModelPricing {
  input: number              // Cost per million tokens for input
  output: number             // Cost per million tokens for output
  request?: number           // Cost per request (if applicable)
  image?: number             // Cost for image processing (if applicable)
  input_cache_read?: number  // Cost per million tokens for cached input reads
  input_cache_write?: number // Cost per million tokens for cache writes
}

export interface LLMModel {
  name: string
  // Common fields across providers
  context_length?: number
  description?: string
  // Provider-specific fields
  size?: number // Ollama
  digest?: string // Ollama
  modified_at?: string // Ollama
  pricing?: ModelPricing
}

export interface LLMClient {
  // List available models
  list(): Promise<{ models: LLMModel[] }>
  
  // Generate text (streaming)
  generate(options: LLMGenerateOptions): AsyncGenerator<LLMGenerateResponse>
  
  // Get provider name
  getProvider(): string
}

export type LLMProvider = 'ollama' | 'openrouter' | 'anthropic' | 'openai'

// Helper function to convert LLM usage to standardized TokenUsage
export function convertToTokenUsage(usage?: LLMGenerateResponse['usage']): TokenUsage | undefined {
  if (!usage) return undefined
  
  const totalPromptTokens = usage.prompt_tokens || 0
  const cacheReadTokens = usage.cache_read_input_tokens || 0
  const cacheWriteTokens = usage.cache_creation_input_tokens || 0
  const regularInputTokens = Math.max(0, totalPromptTokens - cacheReadTokens - cacheWriteTokens)
  
  return {
    input_normal: regularInputTokens,
    input_cache_read: cacheReadTokens,
    input_cache_write: cacheWriteTokens,
    output_normal: usage.completion_tokens || 0
  }
}
