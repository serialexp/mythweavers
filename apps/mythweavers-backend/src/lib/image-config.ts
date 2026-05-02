/**
 * Server-side image-generation configuration.
 *
 * Provider and model definitions come from the database (Provider / ImageModel).
 * API keys are read from environment variables — the provider's `envKeyName` field
 * tells us which env var to read.
 *
 * Mirrors `lib/llm-config.ts` — the two systems share the `Provider` table but
 * use separate model tables.
 */

import type { LlmProtocol, PricingMode } from '@prisma/client'
import { prisma } from './prisma.js'

/** Wire protocols supported for image generation. */
export type ImageStreamProtocol = 'cloudflare-image' | 'openai-image'

export interface ImageUpstreamConfig {
  /** Provider slug (e.g. "cloudflare-image", "openai-image"). */
  provider: string
  /** Wire protocol used to call this provider. */
  protocol: ImageStreamProtocol
  /** Base URL for API calls. */
  endpoint: string
  /** API key. */
  apiKey: string
  /** Model name to send upstream. */
  model: string
  /** FK back to the catalog row (used for usage-log linkage). */
  imageModelId: string
  /** Capability hints for parameter clamping. */
  defaultSteps: number | null
  maxWidth: number | null
  maxHeight: number | null
  /** Pricing snapshot (what we charge users). */
  pricingMode: PricingMode
  pricing: {
    priceFlat: number | null
    priceFirstMP: number | null
    priceSubsequentMP: number | null
    pricePerTile: number | null
    pricePerTileStep: number | null
  }
  /** Cost snapshot (what we pay upstream — never exposed publicly). */
  cost: {
    costFlat: number | null
    costFirstMP: number | null
    costSubsequentMP: number | null
    costPerTile: number | null
    costPerTileStep: number | null
  }
}

export interface PublicImageModel {
  name: string
  displayName: string | null
  description: string | null
  provider: string
  defaultSteps: number | null
  maxWidth: number | null
  maxHeight: number | null
  supportedSizes: string[] | null
  pricingMode: PricingMode
  pricing: {
    priceFlat: number | null
    priceFirstMP: number | null
    priceSubsequentMP: number | null
    pricePerTile: number | null
    pricePerTileStep: number | null
  }
}

/**
 * Map a Prisma `LlmProtocol` enum value to our image-stream-protocol type.
 * Returns null when the row's protocol isn't an image-gen protocol — caller
 * should treat that as "model not configured for image gen".
 */
function mapImageProtocol(proto: LlmProtocol): ImageStreamProtocol | null {
  switch (proto) {
    case 'CLOUDFLARE_IMAGE':
      return 'cloudflare-image'
    case 'OPENAI_IMAGE':
      return 'openai-image'
    default:
      return null
  }
}

/**
 * Resolve an image model name to its full upstream configuration.
 * Returns null if the model isn't enabled, the provider is disabled,
 * the API key env var isn't set, or the provider's protocol isn't an image protocol.
 */
export async function resolveImageUpstream(
  modelName: string,
): Promise<ImageUpstreamConfig | null> {
  const model = await prisma.imageModel.findFirst({
    where: {
      modelId: modelName,
      enabled: true,
      provider: { enabled: true },
    },
    include: { provider: true },
  })

  if (!model) return null

  const protocol = mapImageProtocol(model.provider.protocol)
  if (!protocol) {
    console.warn(
      `[image-config] Model "${modelName}" maps to provider "${model.provider.name}" ` +
        `but its protocol "${model.provider.protocol}" is not an image-gen protocol`,
    )
    return null
  }

  const apiKey = process.env[model.provider.envKeyName]
  if (!apiKey) {
    console.warn(
      `[image-config] Model "${modelName}" maps to provider "${model.provider.name}" ` +
        `but env var "${model.provider.envKeyName}" is not set`,
    )
    return null
  }

  return {
    provider: model.provider.name,
    protocol,
    endpoint: model.provider.endpointUrl,
    apiKey,
    model: modelName,
    imageModelId: model.id,
    defaultSteps: model.defaultSteps,
    maxWidth: model.maxWidth,
    maxHeight: model.maxHeight,
    pricingMode: model.pricingMode,
    pricing: {
      priceFlat: model.priceFlat,
      priceFirstMP: model.priceFirstMP,
      priceSubsequentMP: model.priceSubsequentMP,
      pricePerTile: model.pricePerTile,
      pricePerTileStep: model.pricePerTileStep,
    },
    cost: {
      costFlat: model.costFlat,
      costFirstMP: model.costFirstMP,
      costSubsequentMP: model.costSubsequentMP,
      costPerTile: model.costPerTile,
      costPerTileStep: model.costPerTileStep,
    },
  }
}

/**
 * Public image-model catalog. Never includes our cost — only the price the user pays.
 */
export async function getPublicImageModels(): Promise<PublicImageModel[]> {
  const models = await prisma.imageModel.findMany({
    where: {
      enabled: true,
      provider: { enabled: true },
    },
    include: { provider: { select: { name: true } } },
    orderBy: [{ provider: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
  })

  return models.map((m) => ({
    name: m.modelId,
    displayName: m.displayName,
    description: m.description,
    provider: m.provider.name,
    defaultSteps: m.defaultSteps,
    maxWidth: m.maxWidth,
    maxHeight: m.maxHeight,
    supportedSizes: Array.isArray(m.supportedSizes)
      ? (m.supportedSizes as string[])
      : null,
    pricingMode: m.pricingMode,
    pricing: {
      priceFlat: m.priceFlat,
      priceFirstMP: m.priceFirstMP,
      priceSubsequentMP: m.priceSubsequentMP,
      pricePerTile: m.pricePerTile,
      pricePerTileStep: m.pricePerTileStep,
    },
  }))
}

// ---- Cost calculation ----

/**
 * Number of 512x512 tiles needed to cover a (width, height) image. Used by
 * Cloudflare's PER_TILE_STEP pricing — the API bills per output tile per step.
 */
export function tilesFor(width: number, height: number): number {
  return Math.ceil(width / 512) * Math.ceil(height / 512)
}

/** Total megapixels in an image, fractional. Used by PER_MP_TIERED pricing. */
export function megapixelsFor(width: number, height: number): number {
  return (width * height) / 1_000_000
}

interface PricingFields {
  priceFlat: number | null
  priceFirstMP: number | null
  priceSubsequentMP: number | null
  pricePerTile: number | null
  pricePerTileStep: number | null
}

/**
 * Compute the user-facing cost for a generation. Pure function so we can use
 * it for both pre-flight balance checks and post-success ledger entries.
 *
 * Throws if the upstream config has nulls where pricingMode requires values —
 * that's a seeding error and should be loud.
 */
export function computeCost(
  pricingMode: PricingMode,
  pricing: PricingFields,
  width: number,
  height: number,
  steps: number,
): number {
  switch (pricingMode) {
    case 'FLAT_PER_IMAGE': {
      if (pricing.priceFlat == null) {
        throw new Error('FLAT_PER_IMAGE pricing requires priceFlat')
      }
      return pricing.priceFlat
    }
    case 'PER_MP_TIERED': {
      if (
        pricing.priceFirstMP == null ||
        pricing.priceSubsequentMP == null
      ) {
        throw new Error(
          'PER_MP_TIERED pricing requires priceFirstMP and priceSubsequentMP',
        )
      }
      const mp = megapixelsFor(width, height)
      const first = Math.min(mp, 1)
      const rest = Math.max(0, mp - 1)
      return first * pricing.priceFirstMP + rest * pricing.priceSubsequentMP
    }
    case 'PER_TILE_STEP': {
      if (pricing.pricePerTileStep == null) {
        throw new Error('PER_TILE_STEP pricing requires pricePerTileStep')
      }
      const tiles = tilesFor(width, height)
      return tiles * steps * pricing.pricePerTileStep
    }
  }
}

/** Convenience: compute the user-facing cost from an upstream config. */
export function estimateCost(
  upstream: ImageUpstreamConfig,
  width: number,
  height: number,
  steps: number,
): number {
  return computeCost(upstream.pricingMode, upstream.pricing, width, height, steps)
}

/** Convenience: compute our cost (same shape, different fields). */
export function estimateOurCost(
  upstream: ImageUpstreamConfig,
  width: number,
  height: number,
  steps: number,
): number {
  return computeCost(
    upstream.pricingMode,
    {
      priceFlat: upstream.cost.costFlat,
      priceFirstMP: upstream.cost.costFirstMP,
      priceSubsequentMP: upstream.cost.costSubsequentMP,
      pricePerTile: upstream.cost.costPerTile,
      pricePerTileStep: upstream.cost.costPerTileStep,
    },
    width,
    height,
    steps,
  )
}
