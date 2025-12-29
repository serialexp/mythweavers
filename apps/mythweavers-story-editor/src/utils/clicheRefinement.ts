import type { LLMClient, LLMMessage } from '../types/llm'

const CRITIQUE_PROMPT = `You are a critical writing assistant with a particular focus on identifying overused, cliché, or cringe-worthy writing. Analyze the provided story content and identify issues such as:

- Melodramatic or overly edgy descriptions
- Cheesy or cliché dialogue
- Purple prose or overwrought metaphors
- Overused tropes or phrases
- Unnatural or forced emotional moments
- Inconsistent or unrealistic character reactions
- Repetitive reflective endings ("their life would never be the same", "everything had changed", etc.)

Format your response as a list of specific issues, each with a brief explanation of why it's problematic. Be direct but constructive. Focus mostly on stylistic issues, not plot or continuity.

Example output:
- "His azure orbs sparkled with determination" - Purple prose, just say "blue eyes"
- "Her heart shattered into a million pieces" - Melodramatic and cliché description of sadness
- "Nothing would ever be the same again" - Overused reflective ending that adds no value

If the writing is generally good and has no significant issues, simply respond with "No significant issues found."`

const REFINE_PROMPT = `You are a writing assistant. Rewrite the following story content, addressing the identified issues while maintaining:
- The same events and plot progression
- The same characters and their actions
- The same approximate length and structure
- The same narrative voice and perspective

Replace clichés with fresh, specific descriptions. Remove purple prose in favor of clear, evocative language. Keep dialogue natural and character-appropriate.

ISSUES TO ADDRESS:
{critique}

ORIGINAL CONTENT:
{content}

Output only the refined story content, nothing else.`

export interface ClicheRefinementResult {
  critique: string
  refinedContent: string
  wasRefined: boolean
}

/**
 * Runs a two-step cliche refinement process:
 * 1. Critique: Identify clichés and problematic writing
 * 2. Refine: Rewrite the content addressing the identified issues
 */
export async function refineClichés(
  content: string,
  client: LLMClient,
  model: string,
  onProgress?: (stage: 'critique' | 'refine') => void,
): Promise<ClicheRefinementResult> {
  // Step 1: Critique the content
  onProgress?.('critique')

  const critiqueMessages: LLMMessage[] = [
    { role: 'user', content: CRITIQUE_PROMPT },
    { role: 'user', content: `Story content to analyze:\n\n${content}` },
  ]

  let critique = ''
  const critiqueResponse = client.generate({
    model,
    messages: critiqueMessages,
    stream: true,
    metadata: { callType: 'cliche:critique' },
  })

  for await (const part of critiqueResponse) {
    if (part.response) {
      critique += part.response
    }
  }

  critique = critique.trim()

  // If no significant issues found, return the original content
  if (critique.toLowerCase().includes('no significant issues found')) {
    return {
      critique,
      refinedContent: content,
      wasRefined: false,
    }
  }

  // Step 2: Refine the content based on critique
  onProgress?.('refine')

  const refinePrompt = REFINE_PROMPT.replace('{critique}', critique).replace('{content}', content)

  const refineMessages: LLMMessage[] = [{ role: 'user', content: refinePrompt }]

  let refinedContent = ''
  const refineResponse = client.generate({
    model,
    messages: refineMessages,
    stream: true,
    metadata: { callType: 'cliche:refine' },
  })

  for await (const part of refineResponse) {
    if (part.response) {
      refinedContent += part.response
    }
  }

  return {
    critique,
    refinedContent: refinedContent.trim(),
    wasRefined: true,
  }
}
