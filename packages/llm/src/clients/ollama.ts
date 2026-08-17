import type {
  LLMClient,
  LLMGenerateOptions,
  LLMModel,
  LLMStreamEvent,
} from "../types"
import { parseNDJSONStream } from "../utils/ndjson-parser"

const DEFAULT_CONTEXT_LENGTHS: Record<string, number> = {
  "llama3.2": 128000,
  "llama3.1": 128000,
  llama3: 8192,
  llama2: 4096,
  "mistral-nemo": 128000,
  "mistral-large": 128000,
  mixtral: 32768,
  mistral: 32768,
  "qwen2.5": 128000,
  qwen2: 32768,
  qwen: 8192,
  gemma2: 8192,
  gemma: 8192,
  phi3: 128000,
  deepseek: 128000,
  "command-r": 128000,
  yi: 200000,
}

function getDefaultContextLength(modelName: string): number {
  const lower = modelName.toLowerCase()
  // Check from most-specific to least-specific
  for (const [key, value] of Object.entries(DEFAULT_CONTEXT_LENGTHS)) {
    if (lower.includes(key)) return value
  }
  return 4096
}

export interface OllamaClientConfig {
  /** Ollama API host, e.g. "http://localhost:11434" or a proxy URL. */
  host: string
}

/**
 * Ollama LLM client using raw HTTP — no `ollama` SDK dependency.
 *
 * Ollama's streaming format is NDJSON (not SSE), and its HTTP API is simple
 * enough that the SDK is just fetch + NDJSON parsing with a bit of sugar.
 * Removing the SDK eliminates a browser-only dependency.
 */
export class OllamaClient implements LLMClient {
  private host: string

  constructor(config: OllamaClientConfig) {
    this.host = config.host.replace(/\/+$/, "")
  }

  async list(): Promise<{ models: LLMModel[] }> {
    const response = await fetch(`${this.host}/api/tags`)

    if (!response.ok) {
      throw new Error(
        `Cannot connect to Ollama at ${this.host}: ${response.status}`,
      )
    }

    const data: any = await response.json()
    const rawModels: any[] = data.models ?? []

    // For each model, try to get detailed info (context length)
    const models = await Promise.all(
      rawModels.map(async (model) => {
        let contextLength = getDefaultContextLength(model.name)

        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 3000)

          const showResp = await fetch(`${this.host}/api/show`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: model.name }),
            signal: controller.signal,
          })

          clearTimeout(timeout)

          if (showResp.ok) {
            const showData: any = await showResp.json()

            // Try model_info for context length
            if (showData.model_info) {
              const info =
                showData.model_info instanceof Map
                  ? Object.fromEntries(showData.model_info)
                  : showData.model_info

              if (info["general.context_length"]) {
                contextLength = Number.parseInt(
                  info["general.context_length"],
                  10,
                )
              } else {
                // Check model-specific keys
                for (const [key, value] of Object.entries(info)) {
                  if (
                    key.endsWith(".context_length") &&
                    (typeof value === "string" ||
                      typeof value === "number")
                  ) {
                    contextLength = Number.parseInt(String(value), 10)
                    break
                  }
                }
              }
            }

            // Fall back to parameters field
            if (
              contextLength === getDefaultContextLength(model.name) &&
              showData.parameters
            ) {
              const match = showData.parameters.match(/num_ctx\s+(\d+)/)
              if (match) {
                contextLength = Number.parseInt(match[1], 10)
              }
            }
          }
        } catch {
          // Timeout or network error — use default context length
        }

        return {
          name: model.name,
          size: model.size,
          digest: model.digest,
          modified_at:
            model.modified_at instanceof Date
              ? model.modified_at.toISOString()
              : typeof model.modified_at === "string"
                ? model.modified_at
                : new Date().toISOString(),
          context_length: contextLength,
          pricing: undefined, // Ollama models are self-hosted / free
        } satisfies LLMModel
      }),
    )

    return { models }
  }

  async *generate(
    options: LLMGenerateOptions,
  ): AsyncGenerator<LLMStreamEvent> {
    const messages = options.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const requestBody: Record<string, unknown> = {
      model: options.model,
      messages,
      stream: true,
      options: {
        temperature: options.temperature ?? 0.8,
        num_ctx: options.max_tokens || 4096,
        repeat_penalty: 1.1,
        repeat_last_n: 256,
        ...options.providerOptions,
      },
      ...(options.tools?.length
        ? {
            tools: options.tools.map((tool) => ({
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              },
            })),
          }
        : {}),
    }

    // Ollama's reasoning toggle is a top-level `think` field. There's no
    // token-budget equivalent — reasoning models think until they're done —
    // so any positive Anthropic-style budget just enables thinking. Models
    // that don't support reasoning ignore the field.
    if (options.thinking_budget && options.thinking_budget > 0) {
      requestBody.think = true
    }

    const response = await fetch(`${this.host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: options.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      yield {
        type: "error",
        error: `Ollama error: ${response.status} ${errorText}`,
      }
      yield { type: "done" }
      return
    }

    if (!response.body) {
      yield { type: "error", error: "No response body from Ollama" }
      yield { type: "done" }
      return
    }

    for await (const raw of parseNDJSONStream(response.body)) {
      const chunk = raw as {
        message?: {
          content?: string
          tool_calls?: Array<{
            function?: { name?: string; arguments?: unknown }
          }>
        }
        done?: boolean
        prompt_eval_count?: number
        eval_count?: number
      }

      // Yield text chunk
      const text = chunk.message?.content
      if (text) {
        yield { type: "chunk", text }
      }

      for (const [index, toolCall] of (chunk.message?.tool_calls ?? []).entries()) {
        if (toolCall.function?.name) {
          yield {
            type: 'tool_call',
            id: `${index}`,
            name: toolCall.function.name,
            arguments: toolCall.function.arguments ?? {},
          }
        }
      }

      // On done, emit usage then done
      if (chunk.done) {
        if (chunk.prompt_eval_count || chunk.eval_count) {
          yield {
            type: "usage",
            usage: {
              prompt_tokens: chunk.prompt_eval_count,
              completion_tokens: chunk.eval_count,
              total_tokens:
                (chunk.prompt_eval_count ?? 0) +
                (chunk.eval_count ?? 0),
            },
          }
        }
        yield { type: "done" }
        return
      }
    }
  }
}
