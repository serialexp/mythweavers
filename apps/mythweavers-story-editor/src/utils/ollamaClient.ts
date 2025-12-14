import { Ollama } from 'ollama/browser'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GenerateOptions {
  model: string
  prompt?: string // Keep for backward compatibility
  messages?: ChatMessage[]
  stream: boolean
  options?: {
    num_ctx?: number
    temperature?: number
    repeat_penalty?: number
    repeat_last_n?: number
  }
}

interface GenerateResponse {
  response?: string
  done?: boolean
  eval_count?: number
  prompt_eval_count?: number
  context?: any[]
}

class OllamaClientWrapper {
  private ollama: Ollama

  constructor(ollama: Ollama) {
    this.ollama = ollama
  }

  async list() {
    return this.ollama.list()
  }

  async show(options: { model: string }) {
    return this.ollama.show(options)
  }

  async ps() {
    return this.ollama.ps()
  }

  async *generate(options: GenerateOptions): AsyncGenerator<GenerateResponse> {
    // If messages are provided, use chat endpoint; otherwise use generate
    if (options.messages) {
      // Convert to Ollama chat format
      const chatOptions = {
        model: options.model,
        messages: options.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: options.stream,
        options: {
          temperature: 0.9,
          repeat_penalty: 1.3,
          repeat_last_n: 256,
          ...options.options
        }
      }

      const response = await this.ollama.chat(chatOptions as any)
      
      for await (const part of response) {
        yield {
          response: part.message?.content || '',
          done: part.done,
          eval_count: part.eval_count,
          prompt_eval_count: part.prompt_eval_count
        }
      }
    } else {
      // Fall back to generate for backward compatibility
      const generateOptions = {
        model: options.model,
        prompt: options.prompt || '',
        stream: options.stream,
        options: {
          temperature: 0.9,
          repeat_penalty: 1.3,
          repeat_last_n: 256,
          ...options.options
        }
      }

      const response = await this.ollama.generate(generateOptions as any)
      
      for await (const part of response) {
        yield {
          response: part.response,
          done: part.done,
          eval_count: part.eval_count,
          prompt_eval_count: part.prompt_eval_count,
          context: part.context
        }
      }
    }
  }
}

export const createOllamaClient = (): OllamaClientWrapper => {
  // Always use the proxy path - Ollama client will append /api/[endpoint]
  // So this will result in /ollama/api/[endpoint] which the proxy handles
  const proxyHost = `${window.location.origin}/ollama`
  console.log('Using proxy host:', proxyHost)
  const ollama = new Ollama({ host: proxyHost })
  
  return new OllamaClientWrapper(ollama)
}