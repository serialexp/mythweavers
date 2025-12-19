import { Ollama } from 'ollama/browser'
import { LLMGenerateOptions, LLMGenerateResponse, LLMMessage, LLMModel } from '../../types/llm'
import { BaseLLMClient } from './BaseLLMClient'

export class OllamaLLMClient extends BaseLLMClient {
  protected provider = 'ollama'
  private ollama: Ollama
  private host: string

  constructor() {
    super()
    // Always use the proxy endpoint
    this.host = `${window.location.origin}/ollama`
    this.ollama = new Ollama({ host: this.host })
  }

  async list(): Promise<{ models: LLMModel[] }> {
    try {
      this.log('Fetching models from Ollama...')
      const response = await this.ollama.list()

      // For each model, try to get detailed info including context length
      const modelsWithDetails = await Promise.all(
        response.models.map(async (model) => {
          let contextLength = this.getDefaultContextLength(model.name)

          try {
            // Try to get detailed model info which includes actual context length
            // Add a timeout to prevent hanging
            const showPromise = this.ollama.show({ model: model.name })
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Show request timeout')), 3000),
            )

            const showResponse = (await Promise.race([showPromise, timeoutPromise])) as any

            // model_info is a Map, so we need to access it properly
            if (showResponse?.model_info) {
              // Convert Map to object for easier access
              const modelInfo =
                showResponse.model_info instanceof Map
                  ? Object.fromEntries(showResponse.model_info)
                  : showResponse.model_info

              // Try to find context length in various possible keys
              let foundContextLength = false

              // First try general.context_length
              if (modelInfo['general.context_length']) {
                contextLength = Number.parseInt(modelInfo['general.context_length'], 10)
                foundContextLength = true
              }

              // If not found, look for model-specific context_length keys
              if (!foundContextLength) {
                for (const [key, value] of Object.entries(modelInfo)) {
                  if (key.endsWith('.context_length') && (typeof value === 'string' || typeof value === 'number')) {
                    contextLength = Number.parseInt(String(value), 10)
                    foundContextLength = true
                    break
                  }
                }
              }
            }

            // If not found in model_info, try parameters
            if (contextLength === this.getDefaultContextLength(model.name) && showResponse?.parameters) {
              // Some models might have it in parameters
              const match = showResponse.parameters.match(/num_ctx\s+(\d+)/)
              if (match) {
                contextLength = Number.parseInt(match[1], 10)
              }
            }

            // Log if we're still using default
            if (contextLength === this.getDefaultContextLength(model.name)) {
              console.log(`[OllamaLLMClient] Still using default context length for ${model.name}`)
            }
          } catch (_err) {
            this.log(`Could not fetch detailed info for ${model.name}, using default context length`)
          }

          return {
            name: model.name,
            size: model.size,
            digest: model.digest,
            modified_at:
              model.modified_at instanceof Date
                ? model.modified_at.toISOString()
                : typeof model.modified_at === 'string'
                  ? model.modified_at
                  : new Date().toISOString(),
            context_length: contextLength,
            pricing: undefined, // Ollama models are free/self-hosted
          }
        }),
      )

      this.log(`Found ${modelsWithDetails.length} Ollama models with context info`)
      return { models: modelsWithDetails }
    } catch (error) {
      // More specific error handling
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new Error(`Cannot connect to Ollama. Please ensure Ollama is running on ${this.host}`)
      }
      this.handleError(error)
    }
  }

  async *generate(options: LLMGenerateOptions): AsyncGenerator<LLMGenerateResponse> {
    const { model, messages, temperature } = options

    try {
      this.log('Generating with options:', { model, messageCount: messages.length })

      // Use chat endpoint for better message handling
      const chatRequest: any = {
        model,
        messages: this.formatMessages(messages),
        stream: true,
        options: {
          temperature: temperature ?? 0.8,
          num_ctx: options.max_tokens || 4096,
          repeat_penalty: 1.1,
          repeat_last_n: 256,
          ...options.providerOptions,
        },
      }

      const response = await this.ollama.chat(chatRequest)

      // If an abort signal is provided, listen for abort and call response.abort()
      if (options.signal && 'abort' in response) {
        const abortHandler = () => {
          this.log('Aborting Ollama stream')
          if (typeof response.abort === 'function') {
            response.abort()
          }
        }

        // Add abort listener
        options.signal.addEventListener('abort', abortHandler)

        try {
          for await (const chunk of response) {
            // Check if we should abort
            if (options.signal?.aborted) {
              throw new DOMException('Generation aborted', 'AbortError')
            }
            yield this.parseResponse(chunk)
          }
        } finally {
          // Clean up the event listener
          options.signal?.removeEventListener('abort', abortHandler)
        }
      } else {
        // Fallback for when no signal is provided
        for await (const chunk of response) {
          yield this.parseResponse(chunk)
        }
      }
    } catch (error) {
      this.handleError(error)
    }
  }

  protected formatMessages(messages: LLMMessage[]): Array<{ role: string; content: string }> {
    // Ollama expects messages in a similar format, just without cache_control
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))
  }

  protected parseResponse(chunk: {
    message?: { content: string }
    done?: boolean
    prompt_eval_count?: number
    eval_count?: number
    metrics?: { predicted_per_second?: number }
  }): LLMGenerateResponse {
    return {
      response: chunk.message?.content || '',
      done: chunk.done || false,
      eval_count: chunk.eval_count,
      prompt_eval_count: chunk.prompt_eval_count,
      usage: chunk.done
        ? {
            prompt_tokens: chunk.prompt_eval_count,
            completion_tokens: chunk.eval_count,
            total_tokens: (chunk.prompt_eval_count || 0) + (chunk.eval_count || 0),
          }
        : undefined,
    }
  }

  private getDefaultContextLength(modelName: string): number {
    // Set default context lengths for known models
    const lowerName = modelName.toLowerCase()

    // Llama models
    if (lowerName.includes('llama3.2')) return 128000 // Llama 3.2 has 128k context
    if (lowerName.includes('llama3.1')) return 128000 // Llama 3.1 has 128k context
    if (lowerName.includes('llama3')) return 8192
    if (lowerName.includes('llama2')) return 4096

    // Mistral models
    if (lowerName.includes('mistral-nemo')) return 128000
    if (lowerName.includes('mistral-large')) return 128000
    if (lowerName.includes('mixtral')) return 32768
    if (lowerName.includes('mistral')) return 32768

    // Qwen models
    if (lowerName.includes('qwen2.5')) return 128000 // Most Qwen 2.5 models support 128k
    if (lowerName.includes('qwen2')) return 32768
    if (lowerName.includes('qwen')) return 8192

    // Other models
    if (lowerName.includes('gemma2')) return 8192
    if (lowerName.includes('gemma')) return 8192
    if (lowerName.includes('phi3')) return 128000
    if (lowerName.includes('deepseek')) return 128000
    if (lowerName.includes('command-r')) return 128000
    if (lowerName.includes('yi')) return 200000 // Yi models often have very large context

    return 4096 // Default fallback
  }
}
