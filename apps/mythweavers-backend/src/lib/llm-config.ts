/**
 * Server-side LLM configuration.
 *
 * Provider and model definitions come from the database (LlmProvider / LlmModel).
 * API keys are read from environment variables — the provider's `envKeyName` field
 * tells us which env var to read.
 */

import type { LlmProtocol } from '@prisma/client'
import { prisma } from './prisma.js'

/** The streaming protocol to use for an upstream provider. */
export type StreamProtocol = 'anthropic' | 'openai-compatible' | 'cloudflare'

export interface UpstreamConfig {
  /** Provider slug (e.g. "anthropic", "moonshot") */
  provider: string
  /** Which streaming protocol to use */
  protocol: StreamProtocol
  /** The base URL for API calls (e.g. "https://api.anthropic.com") */
  endpoint: string
  /** API key */
  apiKey: string
  /** Model name to send upstream */
  model: string
  /** Pricing for billing (what we charge users, per million tokens) */
  pricing: {
    input: number
    output: number
    cacheRead: number | null
    cacheWrite: number | null
  }
}

export interface PublicModel {
  name: string
  displayName: string | null
  provider: string
  contextLength: number | null
  pricing: {
    input: number
    output: number
    input_cache_read: number | null
    input_cache_write: number | null
  }
}

function mapProtocol(proto: LlmProtocol): StreamProtocol {
  switch (proto) {
    case 'ANTHROPIC':
      return 'anthropic'
    case 'OPENAI_COMPATIBLE':
      return 'openai-compatible'
    case 'CLOUDFLARE':
      return 'cloudflare'
    default:
      return 'openai-compatible'
  }
}

/**
 * Resolve a model name to its full upstream configuration.
 * Returns null if the model is not enabled, the provider is disabled,
 * or the API key env var is not set.
 */
export async function resolveUpstream(modelName: string): Promise<UpstreamConfig | null> {
  const model = await prisma.llmModel.findFirst({
    where: {
      modelId: modelName,
      enabled: true,
      provider: { enabled: true },
    },
    include: { provider: true },
  })

  if (!model) return null

  const apiKey = process.env[model.provider.envKeyName]
  if (!apiKey) {
    console.warn(
      `[llm-config] Model "${modelName}" maps to provider "${model.provider.name}" ` +
        `but env var "${model.provider.envKeyName}" is not set`,
    )
    return null
  }

  return {
    provider: model.provider.name,
    protocol: mapProtocol(model.provider.protocol),
    endpoint: model.provider.endpointUrl,
    apiKey,
    model: modelName,
    pricing: {
      input: model.priceInput,
      output: model.priceOutput,
      cacheRead: model.priceCacheRead,
      cacheWrite: model.priceCacheWrite,
    },
  }
}

/**
 * Get all enabled models with their pricing info for the public API.
 * Never exposes cost (our cost) — only price (what users pay).
 */
export async function getPublicModels(): Promise<PublicModel[]> {
  const models = await prisma.llmModel.findMany({
    where: {
      enabled: true,
      provider: { enabled: true },
    },
    include: {
      provider: { select: { name: true } },
    },
    orderBy: [
      { provider: { sortOrder: 'asc' } },
      { sortOrder: 'asc' },
    ],
  })

  return models.map((m) => ({
    name: m.modelId,
    displayName: m.displayName,
    provider: m.provider.name,
    contextLength: m.contextLength,
    pricing: {
      input: m.priceInput,
      output: m.priceOutput,
      input_cache_read: m.priceCacheRead,
      input_cache_write: m.priceCacheWrite,
    },
  }))
}
