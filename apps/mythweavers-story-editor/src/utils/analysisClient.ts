import { settingsStore } from '../stores/settingsStore'
import { createOllamaClient } from './ollamaClient'
import { createOpenRouterClient } from './openrouterClient'

/**
 * Simple text generation for analysis tasks
 * Uses the same client infrastructure as story generation but optimized for analysis
 */
export const generateAnalysis = async (prompt: string): Promise<string> => {
  const { provider, model } = settingsStore

  if (!model) {
    throw new Error('No model selected')
  }

  if (provider === 'ollama') {
    const client = createOllamaClient()
    return generateWithClient(client, prompt, model)
  } else if (provider === 'openrouter') {
    const client = createOpenRouterClient()
    return generateWithClient(client, prompt, model)
  } else {
    throw new Error('Unknown provider')
  }
}

/**
 * Generate text using the unified client infrastructure
 * Optimized settings for analysis tasks
 */
interface AnalysisClient {
  generate(options: {
    model: string
    prompt: string
    stream: boolean
    options: {
      num_ctx: number
      temperature: number
      top_p: number
      stop: string[]
    }
  }): AsyncIterable<{response?: string}>
}

async function generateWithClient(client: AnalysisClient, prompt: string, model: string): Promise<string> {
  let result = ''

  const response = await client.generate({
    model,
    prompt,
    stream: true, // Use streaming for consistency
    options: {
      num_ctx: 4096, // Smaller context for analysis tasks
      temperature: 0.3, // Lower temperature for more consistent analysis
      top_p: 0.9,
      stop: [] // Let it finish naturally
    }
  })

  // Collect the streamed response
  for await (const part of response) {
    if (part.response) {
      result += part.response
    }
  }

  return result.trim()
}