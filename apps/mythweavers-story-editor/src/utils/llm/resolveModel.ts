import { settingsStore } from '../../stores/settingsStore'
import type { LLMProvider } from '../../types/llm'

/**
 * Generation categories — groups of call types that share similar cognitive requirements.
 * Users can override the provider+model for each category independently.
 */
export type GenerationCategory = 'writing' | 'analysis' | 'rewriting' | 'meta'

export const GENERATION_CATEGORIES: Record<
  GenerationCategory,
  { label: string; description: string }
> = {
  writing: {
    label: 'Writing',
    description: 'Story generation, adventure narration — creative output',
  },
  analysis: {
    label: 'Analysis',
    description:
      'Director notes, world trajectory, summaries, scene splitting — reasoning tasks',
  },
  rewriting: {
    label: 'Rewriting',
    description: 'Rewrites, cliché refinement, translation — transforming existing text',
  },
  meta: {
    label: 'Meta',
    description: 'Titles, setting generation — short, cheap tasks',
  },
}

/** Maps every callType string to its generation category. */
const CALL_TYPE_CATEGORY: Record<string, GenerationCategory> = {
  // Writing
  'story:generate': 'writing',
  'story:generate+summary': 'writing',
  adventure: 'writing',

  // Analysis
  'adventure-director': 'analysis',
  'adventure-trajectory': 'analysis',
  'cliche:critique': 'analysis',
  'summary:node': 'analysis',
  'summary:sentence': 'analysis',
  'summary:multi': 'analysis',
  'summary:paragraph': 'analysis',
  'scene-split': 'analysis',

  // Rewriting
  'rewrite:single': 'rewriting',
  'rewrite:message': 'rewriting',
  'rewrite:mass': 'rewriting',
  'cliche:refine': 'rewriting',
  translation: 'rewriting',

  // Meta
  'story:title': 'meta',
  'node:title': 'meta',
  'adventure-setting': 'meta',
}

export interface CategoryOverride {
  provider: LLMProvider
  model: string
}

export type CategoryOverrides = Partial<Record<GenerationCategory, CategoryOverride>>

export interface ResolvedModel {
  provider: LLMProvider
  model: string
  category: GenerationCategory | null
  isOverride: boolean
}

/**
 * Resolve which provider+model to use for a given callType.
 *
 * Looks up the callType's category, checks for an override, and falls back
 * to the default provider+model from settingsStore.
 */
export function resolveModel(callType: string): ResolvedModel {
  const category = CALL_TYPE_CATEGORY[callType] ?? null
  if (category) {
    const override = settingsStore.categoryOverrides[category]
    if (override?.provider && override?.model) {
      return {
        provider: override.provider,
        model: override.model,
        category,
        isOverride: true,
      }
    }
  }

  return {
    provider: settingsStore.provider as LLMProvider,
    model: settingsStore.model,
    category,
    isOverride: false,
  }
}
