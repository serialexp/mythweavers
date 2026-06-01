// Thin wrapper around the app's LLM plumbing for the snowflake outliner.
//
// Modeled on `runSummarizationPromptMessages` in src/hooks/useOllama.ts, but
// shaped for snowflake's "system instruction + context + user ask" prompts.
// The system prompt and context blocks are marked cacheable so repeated
// expand/refine passes on the same story reuse the prompt prefix — keep the
// cache-control points intact (see project CLAUDE.md).

import type { LLMMessage } from '@mythweavers/llm'
import { LLMClientFactory } from '../../utils/llm'
import { resolveModel } from '../../utils/llm/resolveModel'

export interface SnowflakePromptParams {
  /** The snowflake_* system instruction (from prompts.ts). */
  system: string
  /**
   * Cacheable context blocks (story/book/arc context, neighbour summaries).
   * Each becomes its own user message with an ephemeral cache point.
   */
  contextBlocks?: string[]
  /** The final, non-cached user instruction describing the concrete task. */
  instruction: string
  /** Generation call type — drives provider/model resolution + per-category overrides. */
  callType: string
  signal?: AbortSignal
}

/** Strip reasoning-model `<think>…</think>` blocks and stray chat tags. */
function cleanResponse(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/s>/g, '')
    .replace(/<\|im_(start|end)\|>/g, '')
    .trim()
}

/**
 * Run a single snowflake prompt and return the cleaned, trimmed text.
 * Throws on failure so callers can surface an error notification and leave the
 * outline untouched.
 */
export async function runSnowflakePrompt(params: SnowflakePromptParams): Promise<string> {
  const resolved = resolveModel(params.callType)
  const client = LLMClientFactory.getClient(resolved.provider)

  const messages: LLMMessage[] = [
    { role: 'system', content: params.system, cache_control: { type: 'ephemeral', ttl: '1h' } },
  ]
  for (const block of params.contextBlocks ?? []) {
    if (block.trim().length === 0) continue
    messages.push({ role: 'user', content: block, cache_control: { type: 'ephemeral', ttl: '5m' } })
  }
  messages.push({ role: 'user', content: params.instruction })

  let result = ''
  const response = client.generate({
    model: resolved.model,
    messages,
    max_tokens: resolved.maxTokens,
    thinking_budget: resolved.thinkingBudget || undefined,
    metadata: { callType: params.callType },
    signal: params.signal,
  })

  for await (const event of response) {
    if (event.type === 'chunk') {
      result += event.text
    }
    if (event.type === 'error') {
      throw new Error(event.error)
    }
  }

  return cleanResponse(result)
}
