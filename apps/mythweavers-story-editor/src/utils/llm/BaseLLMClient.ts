import { LLMClient, LLMGenerateOptions, LLMGenerateResponse, LLMModel, LLMMessage } from '../../types/llm'

export abstract class BaseLLMClient implements LLMClient {
  protected abstract provider: string
  
  abstract list(): Promise<{ models: LLMModel[] }>
  abstract generate(options: LLMGenerateOptions): AsyncGenerator<LLMGenerateResponse>
  
  getProvider(): string {
    return this.provider
  }
  
  // Helper method to convert messages to provider-specific format
  protected abstract formatMessages(messages: LLMMessage[]): any[]
  
  // Helper method to parse provider-specific responses
  protected abstract parseResponse(response: any): LLMGenerateResponse
  
  // Common error handling
  protected handleError(error: any): never {
    console.error(`[${this.provider}] Error:`, error)
    
    if (error.message?.includes('ECONNREFUSED')) {
      throw new Error(`Cannot connect to ${this.provider}. Please ensure the service is running.`)
    }
    
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      throw new Error(`Invalid API key for ${this.provider}. Please check your settings.`)
    }
    
    if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      throw new Error(`Rate limit exceeded for ${this.provider}. Please try again later.`)
    }
    
    throw error
  }
  
  // Common logging
  protected log(...args: any[]) {
    console.log(`[${this.provider}]`, ...args)
  }
  
  protected logError(...args: any[]) {
    console.error(`[${this.provider}]`, ...args)
  }
}