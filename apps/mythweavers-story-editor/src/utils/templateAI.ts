import { settingsStore } from '../stores/settingsStore'
import { AnthropicClient } from './anthropicClient'
import { createOllamaClient } from './ollamaClient'
import { createOpenRouterClient } from './openrouterClient'

/**
 * Generate a new template based on a change request using AI
 */
export const generateTemplateChange = async (
  currentTemplate: string,
  currentResolvedState: any,
  changeRequest: string,
): Promise<string> => {
  const { provider, model, anthropicApiKey } = settingsStore

  if (!model) {
    throw new Error('No model selected')
  }

  const prompt = createTemplatePrompt(currentTemplate, currentResolvedState, changeRequest)

  if (provider === 'ollama') {
    const client = createOllamaClient()
    return generateWithOllamaClient(client, prompt, model)
  }
  if (provider === 'openrouter') {
    const client = createOpenRouterClient()
    return generateWithOpenRouterClient(client, prompt, model)
  }
  if (provider === 'anthropic') {
    if (!anthropicApiKey) {
      throw new Error('Anthropic API key not configured')
    }
    const client = new AnthropicClient(anthropicApiKey)
    return generateWithAnthropicClient(client, prompt, model)
  }
  throw new Error('Unknown provider')
}

/**
 * Create the prompt for template generation
 */
function createTemplatePrompt(currentTemplate: string, currentResolvedState: any, changeRequest: string): string {
  const stateJson = JSON.stringify(currentResolvedState, null, 2)

  return `You are a template editor assistant. Your task is to modify an EJS template based on a user's change request.

CURRENT TEMPLATE:
${currentTemplate}

AVAILABLE STATE/CONTEXT (this is what's available in the template):
${stateJson}

USER'S CHANGE REQUEST:
${changeRequest}

IMPORTANT INSTRUCTIONS:
1. Output ONLY the new template - no explanations, no markdown, just the raw template text
2. Preserve the existing EJS syntax style (use <%= %> for output, <% %> for logic)
3. Only use variables that exist in the available state
4. Keep the template concise and readable
5. If the current template doesn't use EJS tags and the change doesn't require them, keep it simple
6. Ensure the template is valid EJS syntax

OUTPUT THE NEW TEMPLATE NOW:`
}

/**
 * Generate with Ollama client
 */
async function generateWithOllamaClient(client: any, prompt: string, model: string): Promise<string> {
  let result = ''

  const response = await client.generate({
    model,
    prompt,
    stream: true,
    options: {
      num_ctx: 4096,
      temperature: 0.3, // Low temperature for consistent template generation
      top_p: 0.9,
      stop: [],
    },
  })

  for await (const part of response) {
    if (part.response) {
      result += part.response
    }
  }

  return result.trim()
}

/**
 * Generate with OpenRouter client
 */
async function generateWithOpenRouterClient(client: any, prompt: string, model: string): Promise<string> {
  let result = ''

  const response = await client.generate({
    model,
    prompt,
    stream: true,
    options: {
      num_ctx: 4096,
      temperature: 0.3,
      top_p: 0.9,
      stop: [],
    },
  })

  for await (const part of response) {
    if (part.response) {
      result += part.response
    }
  }

  return result.trim()
}

/**
 * Generate with Anthropic client
 */
async function generateWithAnthropicClient(client: AnthropicClient, prompt: string, model: string): Promise<string> {
  let result = ''

  const response = await client.generate({
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    stream: true,
    options: {
      num_ctx: 4096,
    },
  })

  for await (const part of response) {
    if (part.response) {
      result += part.response
    }
  }

  return result.trim()
}
