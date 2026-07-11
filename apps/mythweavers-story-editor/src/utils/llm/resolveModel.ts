import { effectiveSettings } from '../../stores/effectiveSettingsStore'
import type { LLMProvider } from '../../types/llm'

/**
 * Generation categories — groups of call types that share similar cognitive requirements.
 * Users can override the provider+model for each category independently.
 */
export type GenerationCategory = 'writing' | 'analysis' | 'deep-analysis' | 'rewriting' | 'meta'

export const GENERATION_CATEGORIES: Record<GenerationCategory, { label: string; description: string }> = {
  writing: {
    label: 'Writing',
    description: 'Story generation, adventure narration — creative output',
  },
  analysis: {
    label: 'Analysis',
    description: 'Nonsense checks, summaries, scene splitting — reasoning tasks',
  },
  'deep-analysis': {
    label: 'Deep Analysis',
    description:
      'Synthesis passes that benefit from a stronger model — global storyline reasoning, hidden-architecture inference',
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
  'adventure-continue': 'writing',
  'outline:expand': 'writing',

  // Analysis
  'adventure-nonsense': 'analysis',
  'adventure-analysis': 'analysis',
  'adventure-revision': 'rewriting',
  'adventure-compaction': 'writing',
  'adventure-synthesis': 'deep-analysis',
  'adventure-storyline-gate': 'analysis',
  'adventure-director': 'analysis',
  'adventure-conditions': 'analysis',
  'cliche:critique': 'analysis',
  'summary:node': 'analysis',
  'summary:sentence': 'analysis',
  'summary:multi': 'analysis',
  'summary:paragraph': 'analysis',
  'scene-split': 'analysis',
  'outline:summarize': 'analysis',

  // Rewriting
  'rewrite:single': 'rewriting',
  'rewrite:message': 'rewriting',
  'rewrite:mass': 'rewriting',
  'rewrite:selection': 'rewriting',
  'cliche:refine': 'rewriting',
  translation: 'rewriting',
  'outline:refine': 'rewriting',

  // Meta
  'story:title': 'meta',
  'node:title': 'meta',
  'adventure-setting': 'writing',
  'adventure-title': 'meta',
  utility: 'meta',
}

export interface CategoryOverride {
  /** Provider override; undefined/null means inherit from global. */
  provider?: LLMProvider | null
  /** Model override; undefined/null means inherit from global. */
  model?: string | null
  /** Thinking budget override (0 = explicit off); undefined/null means inherit from global. */
  thinkingBudget?: number | null
  /**
   * Max output tokens override for calls in this category.
   * undefined/null means inherit from the global maxTokens setting.
   * Lets the user, e.g., give analysis calls a tighter budget than
   * writing calls without affecting any individual call site.
   */
  maxTokens?: number | null
}

export type CategoryOverrides = Partial<Record<GenerationCategory, CategoryOverride>>

/**
 * True if this override actually changes anything vs. the global defaults
 * (i.e. has at least one field set). An empty object should be treated as
 * "no override" so the UI doesn't show a stale badge.
 */
export function isCategoryOverrideActive(override: CategoryOverride | undefined): boolean {
  if (!override) return false
  return !!override.provider || !!override.model || override.thinkingBudget != null || override.maxTokens != null
}

export interface ResolvedModel {
  provider: LLMProvider
  model: string
  /** 0 = off; positive = budget in tokens. */
  thinkingBudget: number
  /**
   * Resolved max output tokens for this call — the category override if
   * one is set, otherwise the global maxTokens. Always positive. Call
   * sites should pass this as `max_tokens` rather than reaching into
   * `effectiveSettings.maxTokens` directly, so per-category overrides
   * actually apply.
   */
  maxTokens: number
  category: GenerationCategory | null
  /** True if any field of the resolved model came from a category override. */
  isOverride: boolean
}

/**
 * Resolve which provider+model+thinking-budget to use for a given callType.
 *
 * Resolution is per-field, so a category may override only thinking budget,
 * only model, or any combination. The category override's provider and
 * model travel together — overriding the model alone would point at a
 * model that may not exist on the global provider, so a category that
 * sets `model` must also set `provider` (the UI enforces this).
 *
 * All reads go through effectiveSettings, which automatically merges
 * story overrides with global defaults.
 */
export function resolveModel(callType: string): ResolvedModel {
  const category = CALL_TYPE_CATEGORY[callType] ?? null
  const override = category ? effectiveSettings.categoryOverrides[category] : undefined

  const useOverrideModel = !!(override?.provider && override?.model)
  const provider = useOverrideModel ? (override!.provider as LLMProvider) : (effectiveSettings.provider as LLMProvider)
  const model = useOverrideModel ? (override!.model as string) : effectiveSettings.model

  const thinkingBudget =
    override?.thinkingBudget != null ? override.thinkingBudget : (effectiveSettings.thinkingBudget ?? 0)

  const maxTokens = override?.maxTokens != null ? override.maxTokens : effectiveSettings.maxTokens

  const isOverride = useOverrideModel || override?.thinkingBudget != null || override?.maxTokens != null

  return {
    provider,
    model,
    thinkingBudget,
    maxTokens,
    category,
    isOverride,
  }
}
