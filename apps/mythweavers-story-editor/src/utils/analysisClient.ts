import { LLMClientFactory } from './llm/LLMClientFactory'
import { resolveModel } from './llm/resolveModel'

/**
 * Simple text generation for analysis tasks.
 * Uses the shared LLM client infrastructure.
 */
export const generateAnalysis = async (prompt: string): Promise<string> => {
  const resolved = resolveModel('analysis')
  const client = LLMClientFactory.getClient(resolved.provider)

  if (!resolved.model) {
    throw new Error('No model selected')
  }

  let result = ''

  const response = client.generate({
    model: resolved.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    metadata: { callType: 'analysis' },
  })

  for await (const event of response) {
    if (event.type === 'chunk') {
      result += event.text
    }
  }

  return result.trim()
}
