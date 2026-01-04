import { modelsStore } from '../stores/modelsStore'
import { settingsStore } from '../stores/settingsStore'
import type { PlotPointDefinition } from '../types/core'
import { AnthropicClient, TokenEstimate } from './anthropicClient'
import { LLMClientFactory } from './llm/LLMClientFactory'
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
 * Proposal for a new plot point or extension to an existing one.
 */
export interface PlotPointProposal {
  key: string
  isNew: boolean // true = new plot point, false = extending existing enum
  options: string[] // enum options (all options for new, only new ones if extending)
  default?: string // only required for new plot points
}

/**
 * Proposal to set a plot point state at a specific message.
 */
export interface StateProposal {
  messageId: string
  key: string
  value: string
}

/**
 * Response from AI when generating a template with plot point proposals.
 */
export interface TemplateWithPlotPointsResponse {
  template: string
  plotPoints: PlotPointProposal[]
  stateChanges: StateProposal[]
}

/**
 * Quick heuristic estimate of token count from text.
 * Uses approximately chars / 4 as a rough estimate.
 */
export function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4)
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' }
}

/**
 * Helper to generate text using LLMClientFactory (with automatic logging)
 */
async function generateWithFactory(
  provider: string,
  model: string,
  messages: ChatMessage[],
  callType: string,
): Promise<string> {
  const client = LLMClientFactory.getClient(provider)
  let result = ''

  const generator = client.generate({
    model,
    messages,
    stream: true,
    metadata: { callType },
  })

  for await (const chunk of generator) {
    if (chunk.response) {
      result += chunk.response
    }
  }

  return result.trim()
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
  const { provider, model } = settingsStore

  if (!model) {
    throw new Error('No model selected')
  }

  // Build messages for the request
  let messages: ChatMessage[]
  if (storyContent) {
    // Use caching-optimized structure when story content is present
    messages = createStoryContextMessages({
      storyContent,
      taskDescription: 'Update Character Template',
      taskDetails: createTemplateTaskDetails(currentTemplate, currentResolvedState, changeRequest),
    })
  } else {
    const prompt = createTemplatePrompt(currentTemplate, currentResolvedState, changeRequest, storyContent)
    messages = [{ role: 'user', content: prompt }]
  }

  return generateWithFactory(provider, model, messages, 'template-change')
}

/**
 * Generate a template with plot point proposals using AI.
 * Returns structured JSON with template, new/extended plot points, and state changes.
 *
 * @param currentTemplate - The current EJS template
 * @param currentResolvedState - The resolved script state
 * @param changeRequest - User's instruction for the change
 * @param storyContent - Story content from scenes (with message IDs)
 * @param existingPlotPoints - Current plot point definitions
 */
export const generateTemplateWithPlotPoints = async (
  currentTemplate: string,
  currentResolvedState: Record<string, unknown>,
  changeRequest: string,
  storyContent: string,
  existingPlotPoints: PlotPointDefinition[],
): Promise<TemplateWithPlotPointsResponse> => {
  const { provider, model } = settingsStore

  if (!model) {
    throw new Error('No model selected')
  }

  // Use caching-optimized structure with story content
  const messages = createStoryContextMessages({
    storyContent,
    taskDescription: 'Update Character Template with Plot Points',
    taskDetails: createTemplateWithPlotPointsTaskDetails(
      currentTemplate,
      currentResolvedState,
      changeRequest,
      existingPlotPoints,
    ),
  })

  const jsonResponse = await generateWithFactory(provider, model, messages, 'character-update')

  // Parse the JSON response - no fallback, must be valid JSON
  return parseTemplateWithPlotPointsResponse(jsonResponse)
}

/**
 * Parse and validate the AI response for template with plot points.
 */
function parseTemplateWithPlotPointsResponse(response: string): TemplateWithPlotPointsResponse {
  // Try to extract JSON from the response (in case AI wrapped it in markdown)
  let jsonStr = response.trim()

  // Handle markdown code blocks
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7)
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3)
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3)
  }
  jsonStr = jsonStr.trim()

  try {
    const parsed = JSON.parse(jsonStr)

    // Validate required fields
    if (typeof parsed.template !== 'string') {
      throw new Error('Response missing required "template" field')
    }

    // Ensure arrays exist (default to empty)
    const result: TemplateWithPlotPointsResponse = {
      template: parsed.template,
      plotPoints: Array.isArray(parsed.plotPoints) ? parsed.plotPoints : [],
      stateChanges: Array.isArray(parsed.stateChanges) ? parsed.stateChanges : [],
    }

    // Validate plot point proposals
    for (const pp of result.plotPoints) {
      if (typeof pp.key !== 'string' || !pp.key) {
        throw new Error('Invalid plot point proposal: missing key')
      }
      if (typeof pp.isNew !== 'boolean') {
        throw new Error(`Invalid plot point proposal "${pp.key}": missing isNew`)
      }
      if (!Array.isArray(pp.options) || pp.options.length === 0) {
        throw new Error(`Invalid plot point proposal "${pp.key}": options must be non-empty array`)
      }
      if (pp.isNew && typeof pp.default !== 'string') {
        throw new Error(`Invalid plot point proposal "${pp.key}": new plot points require default`)
      }
    }

    // Validate state change proposals
    for (const sc of result.stateChanges) {
      if (typeof sc.messageId !== 'string' || !sc.messageId) {
        throw new Error('Invalid state change: missing messageId')
      }
      if (typeof sc.key !== 'string' || !sc.key) {
        throw new Error('Invalid state change: missing key')
      }
      if (typeof sc.value !== 'string') {
        throw new Error(`Invalid state change for "${sc.key}": missing value`)
      }
    }

    return result
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`AI returned invalid JSON: ${e.message}\n\nResponse was:\n${response.slice(0, 500)}...`)
    }
    throw e
  }
}

/**
 * Create task details for template with plot points (for Anthropic caching).
 */
function createTemplateWithPlotPointsTaskDetails(
  currentTemplate: string,
  currentResolvedState: Record<string, unknown>,
  changeRequest: string,
  existingPlotPoints: PlotPointDefinition[],
): string {
  const stateJson = JSON.stringify(currentResolvedState, null, 2)

  const plotPointsSection = existingPlotPoints.length > 0
    ? `EXISTING PLOT POINTS:
${existingPlotPoints.map((pp) => {
  const optionsStr = pp.type === 'enum' && pp.options ? ` (options: ${pp.options.join(', ')})` : ''
  return `- ${pp.key}: ${pp.type}${optionsStr}, default: ${JSON.stringify(pp.default)}`
}).join('\n')}

You can reference these in the template as plotPoints.keyName.
You can also EXTEND existing enum plot points by adding new options.
`
    : `No existing plot points defined. You can propose new ones.
`

  return `TASK: Update this character's EJS template and optionally propose plot points.

CURRENT TEMPLATE:
${currentTemplate}

AVAILABLE STATE/CONTEXT:
${stateJson}

${plotPointsSection}

USER'S CHANGE REQUEST:
${changeRequest}

INSTRUCTIONS:
1. Update the template based on the user's request
2. Focus on CHARACTER-RELEVANT information only:
   - Personality traits and behavioral patterns
   - How they think, react, and make decisions
   - Emotional tendencies and coping mechanisms
   - Values, beliefs, and motivations
   - Relationships and how they interact with others
   - Character growth and development
3. Do NOT include event descriptions or knowledge of events - those are provided as separate context
4. If the change involves tracking story state (e.g., emotional states, relationship status), propose a plot point
5. Plot points should be ENUMs with meaningful state options
6. Only propose plot points that you actually USE in the template
7. Reference message IDs from the story content when proposing state changes

OUTPUT FORMAT (strict JSON, no markdown):
{
  "template": "The updated EJS template text",
  "plotPoints": [
    {
      "key": "characterKnowsSecret",
      "isNew": true,
      "options": ["unaware", "suspicious", "knows"],
      "default": "unaware"
    }
  ],
  "stateChanges": [
    {
      "messageId": "the_message_id_where_state_changes",
      "key": "characterKnowsSecret",
      "value": "knows"
    }
  ]
}

IMPORTANT:
- Output ONLY valid JSON, no explanations
- "plotPoints" and "stateChanges" can be empty arrays if not needed
- For extending existing enums, set "isNew": false and only include NEW options
- Use exact message IDs from [MSG:id] markers in story content

OUTPUT JSON NOW:`
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
 * Shared interface for story context requests.
 * Used by both character updates and context item updates to share cache.
 */
interface StoryContextRequest {
  storyContent: string
  taskDescription: string
  taskDetails: string
}

/**
 * Create messages structured for Anthropic prompt caching.
 * Uses a GENERIC system prompt so both character updates and context item updates
 * can share the same cached prefix (system + story content).
 */
function createStoryContextMessages(request: StoryContextRequest): ChatMessage[] {
  // 1. Generic system message (cached, 1h TTL)
  const systemMessage: ChatMessage = {
    role: 'system',
    content: `You are a story assistant helping manage context and character information for an ongoing story.
You will be provided with story content and a specific task.
Always output only the requested content without additional formatting or explanation.`,
    cache_control: { type: 'ephemeral', ttl: '1h' },
  }

  // 2. Story content (cached, 1h TTL) - SHARED between all requests
  const storyContextMessage: ChatMessage = {
    role: 'user',
    content: `STORY CONTENT:\n${request.storyContent}`,
    cache_control: { type: 'ephemeral', ttl: '1h' },
  }

  // 3. Assistant acknowledgment
  const assistantAck: ChatMessage = {
    role: 'assistant',
    content: 'I have read the story content. Please provide the task.',
  }

  // 4. Task-specific request (NOT cached - varies per character/context item)
  const taskMessage: ChatMessage = {
    role: 'user',
    content: `${request.taskDescription}\n\n${request.taskDetails}`,
  }

  return [systemMessage, storyContextMessage, assistantAck, taskMessage]
}

/**
 * Create task details for character template update.
 */
function createTemplateTaskDetails(
  currentTemplate: string,
  currentResolvedState: any,
  changeRequest: string,
): string {
  const stateJson = JSON.stringify(currentResolvedState, null, 2)

  return `TASK: Update this character's EJS template based on the story content.

CURRENT TEMPLATE:
${currentTemplate}

AVAILABLE STATE/CONTEXT (variables available in the template):
${stateJson}

USER'S CHANGE REQUEST:
${changeRequest}

INSTRUCTIONS:
1. Output ONLY the new template - no explanations, no markdown
2. Preserve the existing EJS syntax style (use <%= %> for output, <% %> for logic)
3. Only use variables that exist in the available state
4. Keep the template concise and readable
5. Ensure the template is valid EJS syntax

OUTPUT THE NEW TEMPLATE NOW:`
}

/**
 * Create task details for context item description generation.
 */
function createContextItemTaskDetails(
  contextType: 'theme' | 'location' | 'plot',
  contextName: string,
  instruction: string,
  existingDescription?: string,
): string {
  const typeDescriptions = {
    theme: 'a thematic element, concept, or recurring motif in the story',
    location: 'a physical place, setting, or environment in the story world',
    plot: 'a storyline, plot thread, or narrative arc that spans multiple scenes',
  }

  const existingSection = existingDescription
    ? `\nEXISTING DESCRIPTION (update based on story content):\n${existingDescription}\n`
    : ''

  return `TASK: Create/update a context item description based on the story content.

CONTEXT ITEM TYPE: ${contextType}
CONTEXT ITEM NAME: "${contextName}"
This should describe ${typeDescriptions[contextType]}.
${existingSection}
USER'S INSTRUCTION:
${instruction}

INSTRUCTIONS:
1. Output ONLY the description text - no explanations, no markdown formatting, no headers
2. Focus on information relevant to "${contextName}" and the specified type (${contextType})
3. Be concise but comprehensive - capture the essential details
4. Write in a style suitable for use as reference context when writing future scenes
5. Keep the description to 2-4 paragraphs maximum
6. Use present tense for ongoing states, past tense for completed events
${existingDescription ? '7. Incorporate relevant information from the existing description while updating it with new details' : '7. Create a fresh description based entirely on the story content'}

OUTPUT THE DESCRIPTION NOW:`
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
  const { provider, model } = settingsStore

  if (!model) {
    throw new Error('No model selected')
  }

  // Use caching-optimized structure - shares cache with character updates
  const messages = createStoryContextMessages({
    storyContent,
    taskDescription: 'Generate Context Item Description',
    taskDetails: createContextItemTaskDetails(contextType, contextName, instruction, existingDescription),
  })

  return generateWithFactory(provider, model, messages, 'context-item-generate')
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
