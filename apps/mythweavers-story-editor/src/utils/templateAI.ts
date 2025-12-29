import { settingsStore } from '../stores/settingsStore'
import { modelsStore } from '../stores/modelsStore'
import { AnthropicClient, TokenEstimate } from './anthropicClient'
import { createOllamaClient } from './ollamaClient'
import { createOpenRouterClient } from './openrouterClient'

export type { TokenEstimate }

export interface TokenEstimateResult {
  estimate: TokenEstimate
  contextLimit: number
  fitsInContext: boolean
  percentUsed: number
}

/**
 * Quick heuristic estimate of token count from text.
 * Uses approximately chars / 4 as a rough estimate.
 */
export function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Generate a new template based on a change request using AI
 * @param currentTemplate - The current EJS template
 * @param currentResolvedState - The resolved script state
 * @param changeRequest - User's instruction for the change
 * @param storyContent - Optional story content from scenes to provide context
 */
export const generateTemplateChange = async (
  currentTemplate: string,
  currentResolvedState: any,
  changeRequest: string,
  storyContent?: string,
): Promise<string> => {
  const { provider, model, anthropicApiKey } = settingsStore

  if (!model) {
    throw new Error('No model selected')
  }

  const prompt = createTemplatePrompt(currentTemplate, currentResolvedState, changeRequest, storyContent)

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
function createTemplatePrompt(
  currentTemplate: string,
  currentResolvedState: any,
  changeRequest: string,
  storyContent?: string,
): string {
  const stateJson = JSON.stringify(currentResolvedState, null, 2)

  const storyContentSection = storyContent
    ? `
RELEVANT STORY CONTENT:
${storyContent}

Use this story content as context when making changes. The user's request may reference events, character developments, or details from this content.
`
    : ''

  return `You are a template editor assistant. Your task is to modify an EJS template based on a user's change request.

CURRENT TEMPLATE:
${currentTemplate}

AVAILABLE STATE/CONTEXT (this is what's available in the template):
${stateJson}
${storyContentSection}
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

/**
 * Generate a context item description from story content using AI.
 * This condenses story content into a focused description about a specific topic.
 * @param contextType - The type of context item (theme, location, plot)
 * @param contextName - The name/topic for the context item
 * @param instruction - User's instruction for what to extract/focus on
 * @param storyContent - The story content from marked nodes
 * @param existingDescription - Optional existing description to update
 */
export const generateContextItemDescription = async (
  contextType: 'theme' | 'location' | 'plot',
  contextName: string,
  instruction: string,
  storyContent: string,
  existingDescription?: string,
): Promise<string> => {
  const { provider, model, anthropicApiKey } = settingsStore

  if (!model) {
    throw new Error('No model selected')
  }

  const prompt = createContextItemPrompt(contextType, contextName, instruction, storyContent, existingDescription)

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
 * Create the prompt for context item generation
 */
function createContextItemPrompt(
  contextType: 'theme' | 'location' | 'plot',
  contextName: string,
  instruction: string,
  storyContent: string,
  existingDescription?: string,
): string {
  const typeDescriptions = {
    theme: 'a thematic element, concept, or recurring motif in the story',
    location: 'a physical place, setting, or environment in the story world',
    plot: 'a storyline, plot thread, or narrative arc that spans multiple scenes',
  }

  const existingSection = existingDescription
    ? `
EXISTING DESCRIPTION (update this based on the story content):
${existingDescription}
`
    : ''

  return `You are a story summarization assistant. Your task is to create a concise context item description that captures key information from story content.

CONTEXT ITEM TYPE: ${contextType}
CONTEXT ITEM NAME: "${contextName}"
This should describe ${typeDescriptions[contextType]}.
${existingSection}
STORY CONTENT TO ANALYZE:
${storyContent}

USER'S INSTRUCTION:
${instruction}

IMPORTANT INSTRUCTIONS:
1. Output ONLY the description text - no explanations, no markdown formatting, no headers
2. Focus on information relevant to "${contextName}" and the specified type (${contextType})
3. Be concise but comprehensive - capture the essential details
4. Write in a style suitable for use as reference context when writing future scenes
5. If this is a location, describe its physical characteristics, atmosphere, and significance
6. If this is a theme, describe how it manifests and its importance to the story
7. If this is a plot thread, summarize key events, stakes, and current state
8. Keep the description to 2-4 paragraphs maximum
9. Use present tense for ongoing states, past tense for completed events
10. ${existingDescription ? 'Incorporate relevant information from the existing description while updating it with new details from the story content' : 'Create a fresh description based entirely on the story content'}

OUTPUT THE DESCRIPTION NOW:`
}

/**
 * Estimate token usage for context item generation.
 */
export const estimateContextItemTokens = async (
  contextType: 'theme' | 'location' | 'plot',
  contextName: string,
  instruction: string,
  storyContent: string,
  existingDescription?: string,
): Promise<TokenEstimateResult> => {
  const { provider, model, anthropicApiKey } = settingsStore

  if (!model) {
    throw new Error('No model selected')
  }

  const prompt = createContextItemPrompt(contextType, contextName, instruction, storyContent, existingDescription)

  // Get context limit from model info
  const modelInfo = modelsStore.availableModels.find((m: { name: string }) => m.name === model)
  const contextLimit = modelInfo?.context_length || 4096

  let estimate: TokenEstimate

  if (provider === 'anthropic') {
    if (!anthropicApiKey) {
      estimate = {
        tokens: Math.ceil(prompt.length / 4),
        isExact: false,
        method: 'heuristic',
      }
    } else {
      const client = new AnthropicClient(anthropicApiKey)
      estimate = await client.estimateTokens([{ role: 'user', content: prompt }], model)
    }
  } else if (provider === 'ollama') {
    const client = createOllamaClient()
    estimate = client.estimateTokens([{ role: 'user', content: prompt }])
  } else if (provider === 'openrouter') {
    const client = createOpenRouterClient()
    estimate = client.estimateTokens([{ role: 'user', content: prompt }])
  } else {
    estimate = {
      tokens: Math.ceil(prompt.length / 4),
      isExact: false,
      method: 'heuristic',
    }
  }

  const outputReserve = 2048
  const availableForInput = contextLimit - outputReserve
  const fitsInContext = estimate.tokens <= availableForInput
  const percentUsed = Math.round((estimate.tokens / availableForInput) * 100)

  return {
    estimate,
    contextLimit,
    fitsInContext,
    percentUsed,
  }
}

/**
 * Estimate token usage for a template change request.
 * This helps determine if the content will fit in the model's context window.
 */
export const estimateTemplateChangeTokens = async (
  currentTemplate: string,
  currentResolvedState: any,
  changeRequest: string,
  storyContent?: string,
): Promise<TokenEstimateResult> => {
  const { provider, model, anthropicApiKey } = settingsStore

  if (!model) {
    throw new Error('No model selected')
  }

  // Build the prompt to estimate
  const prompt = createTemplatePrompt(currentTemplate, currentResolvedState, changeRequest, storyContent)

  // Get context limit from model info
  const modelInfo = modelsStore.availableModels.find((m: { name: string }) => m.name === model)
  const contextLimit = modelInfo?.context_length || 4096

  let estimate: TokenEstimate

  if (provider === 'anthropic') {
    if (!anthropicApiKey) {
      // Fallback to heuristic if no API key
      estimate = {
        tokens: Math.ceil(prompt.length / 4),
        isExact: false,
        method: 'heuristic',
      }
    } else {
      const client = new AnthropicClient(anthropicApiKey)
      estimate = await client.estimateTokens([{ role: 'user', content: prompt }], model)
    }
  } else if (provider === 'ollama') {
    const client = createOllamaClient()
    estimate = client.estimateTokens([{ role: 'user', content: prompt }])
  } else if (provider === 'openrouter') {
    const client = createOpenRouterClient()
    estimate = client.estimateTokens([{ role: 'user', content: prompt }])
  } else {
    // Fallback for unknown providers
    estimate = {
      tokens: Math.ceil(prompt.length / 4),
      isExact: false,
      method: 'heuristic',
    }
  }

  // Reserve some tokens for output (typically 4096 for template changes)
  const outputReserve = 4096
  const availableForInput = contextLimit - outputReserve
  const fitsInContext = estimate.tokens <= availableForInput
  const percentUsed = Math.round((estimate.tokens / availableForInput) * 100)

  return {
    estimate,
    contextLimit,
    fitsInContext,
    percentUsed,
  }
}
