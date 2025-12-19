import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { globalOperationStore } from '../stores/globalOperationStore'
import { messagesStore } from '../stores/messagesStore'
import { pendingEntitiesStore } from '../stores/pendingEntitiesStore'

/**
 * Determines if the story is ready for a new automatic generation
 * Checks for ongoing operations that should block auto-generation
 */
export const isStoryReadyForGeneration = (): boolean => {
  // Don't generate if already loading or analyzing
  if (messagesStore.isLoading || messagesStore.isAnalyzing) {
    return false
  }

  // Don't generate if there are pending entities waiting for user confirmation
  if (pendingEntitiesStore.hasPendingEntities) {
    return false
  }

  // Don't generate if there are global operations in progress (bulk summarization, analysis, etc.)
  if (globalOperationStore.isOperationInProgress()) {
    return false
  }

  // Check if any messages are currently being summarized
  const isSummarizing = messagesStore.messages.some((msg) => msg.isSummarizing)
  if (isSummarizing) {
    return false
  }

  // Check if any messages are currently being analyzed
  const isAnalyzing = messagesStore.messages.some((msg) => msg.isAnalyzing)
  if (isAnalyzing) {
    return false
  }

  // All checks passed - story is ready for generation
  return true
}

/**
 * Generate instructions for the next story beat based on the current story context
 */
export const generateNextStoryBeatInstructions = async (
  generateFn: (prompt: string) => Promise<string>,
  paragraphsPerTurn = 3,
): Promise<string> => {
  // Get the last few visible story messages for context
  const storyMessages = messagesStore.visibleMessages
    .filter((msg) => !msg.isQuery && msg.role === 'assistant')
    .slice(-3) // Last 3 story beats
    .map((msg) => msg.content)
    .join('\n\n')

  if (!storyMessages.trim()) {
    return 'Begin a compelling story that introduces the setting and main character.'
  }

  // Get active context items and character information
  const characterContext = charactersStore.getCharacterContext()
  const contextItemsContext = contextItemsStore.getGlobalContextItems()
  const fullContext = (characterContext + contextItemsContext).trim()

  const prompt = `Based on the following recent story content, suggest what should happen next. 
Your response should be a brief, specific instruction for the next story beat (1-2 sentences)${paragraphsPerTurn > 0 ? ` that will generate ${paragraphsPerTurn} paragraph${paragraphsPerTurn !== 1 ? 's' : ''} of content` : ''}.
Focus on natural story progression, character development, or plot advancement.

IMPORTANT: Only provide the instruction for what should happen next. Do NOT include any user instructions, prompts, or meta-commentary at the end.

Recent story content:
${storyMessages}

${
  fullContext
    ? `Active story context:
${fullContext}

`
    : ''
}Instructions for next story beat:`

  try {
    const response = await generateFn(prompt)
    return response.trim() || 'Continue the story, developing the current scene further.'
  } catch (error) {
    console.warn('Failed to generate next story beat instructions:', error)
    return 'Continue the story, developing the current scene further.'
  }
}
