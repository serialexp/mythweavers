/**
 * Seed script for LLM providers and models.
 *
 * Run with: npx tsx prisma/seed-llm-providers.ts
 *
 * This is idempotent — it uses upsert so it can be safely re-run.
 * It will NOT overwrite pricing that has been manually changed in the admin UI
 * unless the model is being created for the first time.
 */

import { PrismaClient, LlmProtocol } from '@prisma/client'

const prisma = new PrismaClient()

interface ProviderSeed {
  name: string
  displayName: string
  endpointUrl: string
  protocol: LlmProtocol
  envKeyName: string
  sortOrder: number
}

interface ModelSeed {
  modelId: string
  displayName?: string
  contextLength?: number
  costInput: number
  costOutput: number
  costCacheRead?: number
  costCacheWrite?: number
  sortOrder?: number
}

const PROVIDERS: Record<string, ProviderSeed> = {
  anthropic: {
    name: 'anthropic',
    displayName: 'Anthropic',
    endpointUrl: 'https://api.anthropic.com',
    protocol: 'ANTHROPIC',
    envKeyName: 'LLM_ANTHROPIC_API_KEY',
    sortOrder: 0,
  },
  openai: {
    name: 'openai',
    displayName: 'OpenAI',
    endpointUrl: 'https://api.openai.com',
    protocol: 'OPENAI_COMPATIBLE',
    envKeyName: 'LLM_OPENAI_API_KEY',
    sortOrder: 1,
  },
  openrouter: {
    name: 'openrouter',
    displayName: 'OpenRouter',
    endpointUrl: 'https://openrouter.ai/api',
    protocol: 'OPENAI_COMPATIBLE',
    envKeyName: 'LLM_OPENROUTER_API_KEY',
    sortOrder: 2,
  },
}

// Prices = cost for now (same margin). Adjust priceInput/priceOutput in admin later.
const MODELS: Record<string, ModelSeed[]> = {
  anthropic: [
    { modelId: 'claude-opus-4-6', displayName: 'Claude Opus 4.6', contextLength: 200000, costInput: 5, costOutput: 25, costCacheRead: 0.5, costCacheWrite: 6.25, sortOrder: 0 },
    { modelId: 'claude-opus-4-5', displayName: 'Claude Opus 4.5', contextLength: 200000, costInput: 5, costOutput: 25, costCacheRead: 0.5, costCacheWrite: 6.25, sortOrder: 1 },
    { modelId: 'claude-opus-4-20250514', displayName: 'Claude Opus 4', contextLength: 200000, costInput: 15, costOutput: 75, costCacheRead: 1.5, costCacheWrite: 18.75, sortOrder: 2 },
    { modelId: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4', contextLength: 200000, costInput: 3, costOutput: 15, costCacheRead: 0.3, costCacheWrite: 3.75, sortOrder: 3 },
    { modelId: 'claude-3-7-sonnet-20250219', displayName: 'Claude Sonnet 3.7', contextLength: 200000, costInput: 3, costOutput: 15, costCacheRead: 0.3, costCacheWrite: 3.75, sortOrder: 4 },
    { modelId: 'claude-haiku-4-5', displayName: 'Claude Haiku 4.5', contextLength: 200000, costInput: 1, costOutput: 5, costCacheRead: 0.1, costCacheWrite: 1.25, sortOrder: 5 },
    { modelId: 'claude-3-5-haiku-20241022', displayName: 'Claude Haiku 3.5', contextLength: 200000, costInput: 0.8, costOutput: 4, costCacheRead: 0.08, costCacheWrite: 1, sortOrder: 6 },
  ],
  openai: [
    { modelId: 'gpt-4o', displayName: 'GPT-4o', contextLength: 128000, costInput: 2.5, costOutput: 10, costCacheRead: 1.25, sortOrder: 0 },
    { modelId: 'gpt-4o-mini', displayName: 'GPT-4o Mini', contextLength: 128000, costInput: 0.15, costOutput: 0.6, costCacheRead: 0.075, sortOrder: 1 },
    { modelId: 'o1', displayName: 'o1', contextLength: 200000, costInput: 15, costOutput: 60, costCacheRead: 7.5, sortOrder: 2 },
    { modelId: 'gpt-4-turbo', displayName: 'GPT-4 Turbo', contextLength: 128000, costInput: 10, costOutput: 30, sortOrder: 3 },
    { modelId: 'gpt-3.5-turbo', displayName: 'GPT-3.5 Turbo', contextLength: 16385, costInput: 0.5, costOutput: 1.5, sortOrder: 4 },
  ],
}

async function main() {
  console.log('Seeding LLM providers and models...\n')

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
    console.log(`  Provider: ${provider.displayName} (${provider.name}) — key ${keyConfigured ? '✓' : '✗'}`)

    const models = MODELS[key] || []
    for (const modelData of models) {
      await prisma.llmModel.upsert({
        where: {
          providerId_modelId: {
            providerId: provider.id,
            modelId: modelData.modelId,
          },
        },
        create: {
          modelId: modelData.modelId,
          displayName: modelData.displayName,
          providerId: provider.id,
          contextLength: modelData.contextLength,
          costInput: modelData.costInput,
          costOutput: modelData.costOutput,
          costCacheRead: modelData.costCacheRead,
          costCacheWrite: modelData.costCacheWrite,
          // Start with price = cost (no margin). Adjust in admin.
          priceInput: modelData.costInput,
          priceOutput: modelData.costOutput,
          priceCacheRead: modelData.costCacheRead,
          priceCacheWrite: modelData.costCacheWrite,
          sortOrder: modelData.sortOrder ?? 0,
        },
        // Only update cost fields and metadata on re-run, not prices (admin may have changed them)
        update: {
          displayName: modelData.displayName,
          contextLength: modelData.contextLength,
          costInput: modelData.costInput,
          costOutput: modelData.costOutput,
          costCacheRead: modelData.costCacheRead,
          costCacheWrite: modelData.costCacheWrite,
          sortOrder: modelData.sortOrder ?? 0,
        },
      })
      console.log(`    Model: ${modelData.displayName || modelData.modelId}`)
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
