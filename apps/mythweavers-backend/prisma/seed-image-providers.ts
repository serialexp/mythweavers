/**
 * Seed script for AI image-generation providers and models.
 *
 * Run with: npx tsx prisma/seed-image-providers.ts
 *
 * Idempotent — uses upsert so it can be safely re-run. Pricing/cost columns
 * are kept in sync with the constants below on every run; if you edit prices
 * via the admin UI they'll be overwritten on the next seed. (Mirrors the
 * behavior of seed-llm-providers.ts which only refrains from clobbering
 * `priceInput`/`priceOutput`; for image gen we currently lack an admin UI
 * so re-seeding is the correct way to update prices.)
 *
 * Pricing references:
 *   - Cloudflare: https://developers.cloudflare.com/workers-ai/platform/pricing/
 *   - OpenAI: https://openai.com/api/pricing/
 */

import { PrismaClient, LlmProtocol, PricingMode } from '@prisma/client'

const prisma = new PrismaClient()

interface ProviderSeed {
  name: string
  displayName: string
  endpointUrl: string
  protocol: LlmProtocol
  envKeyName: string
  sortOrder: number
}

interface ImageModelSeed {
  modelId: string
  displayName: string
  description?: string
  defaultSteps?: number
  maxWidth?: number
  maxHeight?: number
  supportedSizes?: string[]
  pricingMode: PricingMode
  // Price = what the user pays. Cost = what we pay upstream.
  priceFlat?: number
  priceFirstMP?: number
  priceSubsequentMP?: number
  pricePerTile?: number
  pricePerTileStep?: number
  costFlat?: number
  costFirstMP?: number
  costSubsequentMP?: number
  costPerTile?: number
  costPerTileStep?: number
  sortOrder?: number
}

// Endpoint URL note: Cloudflare's image-gen endpoints are account-scoped, the
// account ID is templated at request time by the client (see cloudflare.ts).
// We seed the *base* (no account ID) here.
const PROVIDERS: Record<string, ProviderSeed> = {
  'cloudflare-image': {
    name: 'cloudflare-image',
    displayName: 'Cloudflare Workers AI (Images)',
    endpointUrl: 'https://api.cloudflare.com/client/v4/accounts',
    protocol: 'CLOUDFLARE_IMAGE',
    envKeyName: 'LLM_CLOUDFLARE_API_KEY',
    sortOrder: 0,
  },
  'openai-image': {
    name: 'openai-image',
    displayName: 'OpenAI (Images)',
    endpointUrl: 'https://api.openai.com',
    protocol: 'OPENAI_IMAGE',
    envKeyName: 'LLM_OPENAI_API_KEY',
    sortOrder: 1,
  },
}

// ~20% margin baked in (cost ≈ 80% of price). Adjust freely; the user-facing
// `priceFlat`/`priceFirstMP`/etc are what we charge, the `cost*` columns are
// what we pay upstream and never appear in public API responses.
const MODELS: Record<string, ImageModelSeed[]> = {
  'cloudflare-image': [
    {
      modelId: '@cf/black-forest-labs/flux-1-schnell',
      displayName: 'Flux 1 Schnell',
      description:
        'Fast, cheap (~3s per image). Best for first-pass exploration. ' +
        'Output capped at 2048×2048 by Cloudflare.',
      defaultSteps: 4,
      maxWidth: 2048,
      maxHeight: 2048,
      pricingMode: 'PER_TILE_STEP',
      // Cloudflare bills $0.000053 / (512×512 tile-step). 4 steps × 12 tiles
      // (1920×1080) ≈ $0.00254. Mark up to $0.00007 / tile-step → $0.00336.
      pricePerTileStep: 0.00007,
      costPerTileStep: 0.000053,
      sortOrder: 0,
    },
    {
      modelId: '@cf/black-forest-labs/flux-2-klein-9b',
      displayName: 'Flux 2 Klein 9B',
      description:
        'Higher quality, slower (~8s). Better fidelity for complex scenes.',
      defaultSteps: 20,
      maxWidth: 2048,
      maxHeight: 2048,
      pricingMode: 'PER_MP_TIERED',
      // Cloudflare: $0.0125/MP for first MP, $0.0017/MP after. Add ~20%.
      priceFirstMP: 0.015,
      priceSubsequentMP: 0.002,
      costFirstMP: 0.0125,
      costSubsequentMP: 0.0017,
      sortOrder: 1,
    },
  ],
  'openai-image': [
    {
      modelId: 'gpt-image-1',
      displayName: 'GPT Image 1',
      description:
        'Premium quality (~30–60s). Best fidelity & prompt adherence; pricier. ' +
        'OpenAI clamps to 1024×1024, 1024×1536, 1536×1024.',
      defaultSteps: 1, // OpenAI doesn't expose steps; placeholder.
      maxWidth: 1536,
      maxHeight: 1536,
      supportedSizes: ['1024x1024', '1024x1536', '1536x1024'],
      pricingMode: 'FLAT_PER_IMAGE',
      // OpenAI gpt-image-1: ~$0.04/image at HD quality. Mark up to $0.05.
      priceFlat: 0.05,
      costFlat: 0.04,
      sortOrder: 0,
    },
  ],
}

async function main() {
  console.log('Seeding image providers and models...\n')

  for (const [key, providerData] of Object.entries(PROVIDERS)) {
    const provider = await prisma.provider.upsert({
      where: { name: providerData.name },
      create: providerData,
      update: {
        displayName: providerData.displayName,
        endpointUrl: providerData.endpointUrl,
        protocol: providerData.protocol,
        envKeyName: providerData.envKeyName,
        sortOrder: providerData.sortOrder,
      },
    })

    const keyConfigured = !!process.env[providerData.envKeyName]
    console.log(
      `  Provider: ${provider.displayName} (${provider.name}) — ` +
        `${providerData.envKeyName} ${keyConfigured ? '✓' : '✗'}`,
    )

    const models = MODELS[key] ?? []
    for (const model of models) {
      await prisma.imageModel.upsert({
        where: {
          providerId_modelId: {
            providerId: provider.id,
            modelId: model.modelId,
          },
        },
        create: {
          modelId: model.modelId,
          displayName: model.displayName,
          description: model.description,
          providerId: provider.id,
          enabled: true,
          sortOrder: model.sortOrder ?? 0,
          defaultSteps: model.defaultSteps,
          maxWidth: model.maxWidth,
          maxHeight: model.maxHeight,
          supportedSizes: model.supportedSizes,
          pricingMode: model.pricingMode,
          priceFlat: model.priceFlat,
          priceFirstMP: model.priceFirstMP,
          priceSubsequentMP: model.priceSubsequentMP,
          pricePerTile: model.pricePerTile,
          pricePerTileStep: model.pricePerTileStep,
          costFlat: model.costFlat,
          costFirstMP: model.costFirstMP,
          costSubsequentMP: model.costSubsequentMP,
          costPerTile: model.costPerTile,
          costPerTileStep: model.costPerTileStep,
        },
        update: {
          displayName: model.displayName,
          description: model.description,
          sortOrder: model.sortOrder ?? 0,
          defaultSteps: model.defaultSteps,
          maxWidth: model.maxWidth,
          maxHeight: model.maxHeight,
          supportedSizes: model.supportedSizes,
          pricingMode: model.pricingMode,
          priceFlat: model.priceFlat,
          priceFirstMP: model.priceFirstMP,
          priceSubsequentMP: model.priceSubsequentMP,
          pricePerTile: model.pricePerTile,
          pricePerTileStep: model.pricePerTileStep,
          costFlat: model.costFlat,
          costFirstMP: model.costFirstMP,
          costSubsequentMP: model.costSubsequentMP,
          costPerTile: model.costPerTile,
          costPerTileStep: model.costPerTileStep,
        },
      })
      console.log(`    Image model: ${model.displayName} (${model.modelId})`)
    }
  }

  console.log('\nDone!')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
