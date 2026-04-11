import { effectiveSettings } from '../../stores/effectiveSettingsStore'
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
  'adventure-setting': 'writing',
  'adventure-title': 'meta',
  utility: 'meta',
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
 * Resolution order:
 * 1. Category override (story-level if set, else global)
 * 2. Default provider+model (story-level if set, else global)
 *
 * All reads go through effectiveSettings, which automatically
 * merges story overrides with global defaults.
 */
export function resolveModel(callType: string): ResolvedModel {
  const category = CALL_TYPE_CATEGORY[callType] ?? null
  if (category) {
    const override = effectiveSettings.categoryOverrides[category]
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
    provider: effectiveSettings.provider as LLMProvider,
    model: effectiveSettings.model,
    category,
    isOverride: false,
  }
}
