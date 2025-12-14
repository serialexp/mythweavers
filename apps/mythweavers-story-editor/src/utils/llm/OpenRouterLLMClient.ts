import { BaseLLMClient } from './BaseLLMClient'
import { LLMGenerateOptions, LLMGenerateResponse, LLMModel, LLMMessage } from '../../types/llm'
import { settingsStore } from '../../stores/settingsStore'

interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{
    type: 'text'
    text: string
    cache_control?: {
      type: 'ephemeral'
      ttl?: '5m' | '1h'
    }
  }>
}

interface OpenRouterModelInfo {
  id: string
  name?: string
  context_length?: number
  pricing?: {
    prompt: string
    completion: string
    request?: string
    image?: string
  }
}

interface OpenRouterModelsResponse {
  data: OpenRouterModelInfo[]
}

interface OpenRouterResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message?: {
      role: string
      content: string
    }
    delta?: {
      content?: string
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

export class OpenRouterLLMClient extends BaseLLMClient {
  protected provider = 'openrouter'
  
  async list(): Promise<{ models: LLMModel[] }> {
    try {
      const apiKey = settingsStore.openrouterApiKey
      if (!apiKey) {
        throw new Error('OpenRouter API key not configured')
      }
      
      this.log('Fetching models from OpenRouter...')
      
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Story Writing App'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`)
      }
      
      const data: OpenRouterModelsResponse = await response.json()
      
      // Filter and map models
      const models: LLMModel[] = data.data
        .filter((model) => {
          // Only include text generation models
          return model.id && !model.id.includes('vision') && !model.id.includes('free')
        })
        .map((model) => ({
          name: model.id,
          context_length: model.context_length || 4096,
          description: model.name || model.id,
          pricing: model.pricing ? {
            input: parseFloat(model.pricing.prompt) * 1_000_000,
            output: parseFloat(model.pricing.completion) * 1_000_000,
            request: model.pricing.request ? parseFloat(model.pricing.request) : undefined,
            image: model.pricing.image ? parseFloat(model.pricing.image) : undefined,
            // OpenRouter doesn't provide cache pricing info
            input_cache_read: undefined,
            input_cache_write: undefined
          } : undefined
        }))
        .sort((a: LLMModel, b: LLMModel) => {
          // Sort by provider, then by name
          const providerA = a.name.split('/')[0]
          const providerB = b.name.split('/')[0]
          if (providerA !== providerB) {
            return providerA.localeCompare(providerB)
          }
          return a.name.localeCompare(b.name)
        })
      
      this.log(`Found ${models.length} models`)
      return { models }
    } catch (error) {
      this.handleError(error)
    }
  }
  
  async *generate(options: LLMGenerateOptions): AsyncGenerator<LLMGenerateResponse> {
    const { model, messages, temperature, max_tokens } = options
    const apiKey = settingsStore.openrouterApiKey
    
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured')
    }
    
    try {
      const requestBody = {
        model,
        messages: this.formatMessages(messages),
        temperature: temperature ?? 0.8,
        max_tokens: max_tokens,
        stream: options.stream
      }
      
      this.log('Request:', { model, messageCount: messages.length })
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Story Writing App',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: options.signal
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        this.logError('API error:', response.status, errorText)
        
        if (response.status === 402) {
          throw new Error('OpenRouter: Insufficient credits. Please add credits to your account.')
        }
        
        throw new Error(`OpenRouter API error: ${response.status} ${errorText}`)
      }
      
      if (options.stream) {
        yield* this.handleStream(response)
      } else {
        const data: OpenRouterResponse = await response.json()
        yield this.parseResponse(data)
      }
    } catch (error) {
      this.handleError(error)
    }
  }
  
  protected formatMessages(messages: LLMMessage[]): OpenRouterMessage[] {
    return messages.map(msg => {
      if (msg.cache_control) {
        // Convert numeric ttl to string format
        let ttl: '5m' | '1h' | undefined
        if (typeof msg.cache_control.ttl === 'number') {
          ttl = msg.cache_control.ttl >= 3600 ? '1h' : '5m'
        } else {
          ttl = msg.cache_control.ttl as '5m' | '1h' | undefined
        }
        
        return {
          role: msg.role,
          content: [{
            type: 'text' as const,
            text: msg.content,
            cache_control: {
              type: 'ephemeral' as const,
              ttl
            }
          }]
        }
      }
      return {
        role: msg.role,
        content: msg.content
      }
    })
  }
  
  protected parseResponse(data: OpenRouterResponse): LLMGenerateResponse {
    if (data.choices) {
      // Full response or streaming chunk
      const openRouterResponse = data as OpenRouterResponse
      const choice = openRouterResponse.choices[0]
      
      if (choice.message) {
        // Full response
        return {
          response: choice.message.content || '',
          done: true,
          usage: openRouterResponse.usage ? {
            prompt_tokens: openRouterResponse.usage.prompt_tokens,
            completion_tokens: openRouterResponse.usage.completion_tokens,
            total_tokens: openRouterResponse.usage.total_tokens,
            cache_creation_input_tokens: openRouterResponse.usage.cache_creation_input_tokens,
            cache_read_input_tokens: openRouterResponse.usage.cache_read_input_tokens
          } : undefined
        }
      } else if (choice.delta) {
        // Streaming chunk
        return {
          response: choice.delta.content || '',
          done: choice.finish_reason !== null,
          usage: openRouterResponse.usage ? {
            prompt_tokens: openRouterResponse.usage.prompt_tokens,
            completion_tokens: openRouterResponse.usage.completion_tokens,
            total_tokens: openRouterResponse.usage.total_tokens,
            cache_creation_input_tokens: openRouterResponse.usage.cache_creation_input_tokens,
            cache_read_input_tokens: openRouterResponse.usage.cache_read_input_tokens
          } : undefined
        }
      }
    }
    
    return { response: '', done: false }
  }
  
  private async *handleStream(response: Response): AsyncGenerator<LLMGenerateResponse> {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')
    
    const decoder = new TextDecoder()
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          
          try {
            const parsed = JSON.parse(data)
            yield this.parseResponse(parsed)
          } catch (e) {
            this.logError('Failed to parse streaming response:', e)
          }
        }
      }
    }
  }
}