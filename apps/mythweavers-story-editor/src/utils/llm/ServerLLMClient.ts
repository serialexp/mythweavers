import { getApiBaseUrl } from '../../client/config'
import type { LLMClient, LLMGenerateOptions, LLMModel, LLMStreamEvent } from '../../types/llm'
import { parseSSEStream } from '@mythweavers/llm'

/**
 * LLM client that proxies requests through the MythWeavers backend.
 *
 * Users without their own API keys can use this provider to access
 * models via the server's keys. The server handles provider selection,
 * key injection, and streams normalized SSE events back.
 */
export class ServerLLMClient implements LLMClient {
  async list(): Promise<{ models: LLMModel[] }> {
    const baseUrl = getApiBaseUrl()

    const response = await fetch(`${baseUrl}/my/llm/models`, {
      credentials: 'include',
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('You must be logged in to use server-provided models')
      }
      throw new Error(`Failed to fetch server models: ${response.status}`)
    }

    const data = await response.json()

    // Convert to LLMModel format
    return {
      models: (data.models || []).map(
        (m: {
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
        }) => ({
          name: m.name,
          description: m.displayName || `Server-provided (${m.provider})`,
          context_length: m.contextLength ?? undefined,
          pricing: {
            input: m.pricing.input,
            output: m.pricing.output,
            input_cache_read: m.pricing.input_cache_read ?? undefined,
            input_cache_write: m.pricing.input_cache_write ?? undefined,
          },
        }),
      ),
    }
  }

  async *generate(options: LLMGenerateOptions): AsyncGenerator<LLMStreamEvent> {
    const baseUrl = getApiBaseUrl()

    const body = {
      model: options.model,
      messages: options.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.cache_control ? { cache_control: m.cache_control } : {}),
      })),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.max_tokens ? { max_tokens: options.max_tokens } : {}),
      ...(options.thinking_budget ? { thinking_budget: options.thinking_budget } : {}),
      ...(options.tools && options.tools.length > 0
        ? { tools: options.tools, tool_choice: options.tool_choice ?? 'auto' }
        : {}),
      ...(options.metadata ? { metadata: options.metadata } : {}),
    }

    const response = await fetch(`${baseUrl}/my/llm/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(body),
      signal: options.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      try {
        const errorJson = JSON.parse(errorText)
        yield { type: 'error', error: errorJson.error || `Server error: ${response.status}` }
      } catch {
        yield { type: 'error', error: `Server error: ${response.status} ${errorText}` }
      }
      yield { type: 'done' }
      return
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body from server' }
      yield { type: 'done' }
      return
    }

    // Parse the normalized SSE stream from the backend.
    // The backend emits events like: { type: 'chunk', response: '...' }
    // We convert them to the shared LLMStreamEvent format.
    //
    // NOTE: Do NOT return early on 'done'. Some upstream providers (notably
    // Moonshot/Kimi) emit `finish_reason` and the trailing `usage` chunk as
    // SEPARATE SSE chunks, so the order coming out of the OpenAI-compat
    // parser is `done`, then `usage`, then a second `done`. If we returned
    // on the first done, the usage event would be silently discarded —
    // which is exactly why server-proxied Kimi calls never reported tokens.
    // Instead, just yield done and let the SSE stream end naturally when
    // the backend closes the response.
    let doneYielded = false
    for await (const raw of parseSSEStream(response.body)) {
      const event = raw as {
        type: string
        response?: string
        usage?: any
        error?: string
        id?: string
        name?: string
        arguments?: unknown
      }

      switch (event.type) {
        case 'chunk':
          if (event.response) {
            yield { type: 'chunk', text: event.response }
          }
          break
        case 'usage':
          if (event.usage) {
            yield { type: 'usage', usage: event.usage }
          }
          break
        case 'tool_call':
          // Forwarded verbatim from the backend, which got it from the
          // upstream OpenAI-compatible client (already JSON-parsed).
          if (event.name) {
            yield {
              type: 'tool_call',
              id: event.id ?? '',
              name: event.name,
              arguments: event.arguments,
            }
          }
          break
        case 'done':
          // Only yield 'done' once — providers may emit it multiple times
          // (e.g. once from finish_reason, once from the trailing usage chunk).
          if (!doneYielded) {
            doneYielded = true
            yield { type: 'done' }
          }
          break
        case 'error':
          yield { type: 'error', error: event.error || 'Server stream error' }
          break
      }
    }
  }
}
