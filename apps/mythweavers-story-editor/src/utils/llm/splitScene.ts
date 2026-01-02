import { settingsStore } from '../../stores/settingsStore'
import { LLMClientFactory } from './LLMClientFactory'
import {
  type AggregatedMessageContent,
  type NodeContext,
  type ProposedStructure,
  createSplitScenePrompt,
  parseMessageRange,
} from './splitScenePrompt'

export type { AggregatedMessageContent, NodeContext, ProposedStructure }
export { createSplitScenePrompt }

export interface GenerateSceneSplitOptions {
  onProgress?: (text: string) => void
  signal?: AbortSignal
}

/**
 * Generate a scene split proposal using the LLM
 */
export async function generateSceneSplit(
  aggregatedContent: AggregatedMessageContent[],
  nodeContext: NodeContext,
  options: GenerateSceneSplitOptions = {},
): Promise<ProposedStructure> {
  const { provider, model } = settingsStore

  if (!model) {
    throw new Error('No model selected')
  }

  const client = LLMClientFactory.getClient(provider)
  const prompt = createSplitScenePrompt(aggregatedContent, nodeContext)

  let responseText = ''

  const response = client.generate({
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    stream: true,
    max_tokens: 16384,
    signal: options.signal,
    metadata: {
      callType: 'scene-split',
    },
  })

  for await (const chunk of response) {
    if (chunk.response) {
      responseText += chunk.response
      options.onProgress?.(responseText)
    }
  }

  // Parse JSON response
  return parseSceneSplitResponse(responseText)
}

/**
 * Parse the LLM response into a ProposedStructure
 */
function parseSceneSplitResponse(responseText: string): ProposedStructure {
  try {
    // Try to extract JSON from potential markdown code blocks
    const jsonMatch =
      responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || responseText.match(/(\{[\s\S]*\})/)

    if (!jsonMatch) {
      console.error('[splitScene] No valid JSON found in response:', responseText)
      throw new Error('No valid JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[1]) as ProposedStructure

    // Validate structure
    if (!parsed.structure || !Array.isArray(parsed.structure)) {
      throw new Error('Invalid structure format: missing structure array')
    }

    if (parsed.structure.length === 0) {
      throw new Error('Invalid structure format: structure array is empty')
    }

    // Validate each chapter
    for (const chapter of parsed.structure) {
      if (!chapter.title) {
        throw new Error('Invalid chapter: missing title')
      }
      if (!chapter.scenes || !Array.isArray(chapter.scenes) || chapter.scenes.length === 0) {
        throw new Error(`Invalid chapter "${chapter.title}": missing or empty scenes array`)
      }

      // Validate each scene
      for (const scene of chapter.scenes) {
        if (!scene.title) {
          throw new Error('Invalid scene: missing title')
        }
        if (
          !scene.messageAssignments ||
          !Array.isArray(scene.messageAssignments) ||
          scene.messageAssignments.length === 0
        ) {
          throw new Error(`Invalid scene "${scene.title}": missing or empty messageAssignments`)
        }

        // Validate each assignment
        for (const assignment of scene.messageAssignments) {
          // mn can be a number or a range string like "1-5"
          const messageNumbers = parseMessageRange(assignment.mn)
          if (messageNumbers.length === 0) {
            throw new Error(
              `Invalid assignment in scene "${scene.title}": mn must be a number or range like "1-5"`,
            )
          }
          if (!['full', 'splitBefore', 'splitAfter'].includes(assignment.sb)) {
            throw new Error(
              `Invalid assignment in scene "${scene.title}": invalid sb "${assignment.sb}"`,
            )
          }
          // Ranges can only be used with 'full'
          if (messageNumbers.length > 1 && assignment.sb !== 'full') {
            throw new Error(
              `Invalid assignment in scene "${scene.title}": ranges can only be used with sb:"full"`,
            )
          }
          if (
            (assignment.sb === 'splitBefore' || assignment.sb === 'splitAfter') &&
            typeof assignment.p !== 'number'
          ) {
            throw new Error(
              `Invalid assignment in scene "${scene.title}": splitBefore/splitAfter requires p`,
            )
          }
        }
      }
    }

    return parsed
  } catch (err) {
    console.error('[splitScene] Failed to parse LLM response:', responseText)
    if (err instanceof SyntaxError) {
      throw new Error(`Failed to parse AI response as JSON: ${err.message}`)
    }
    throw err
  }
}
