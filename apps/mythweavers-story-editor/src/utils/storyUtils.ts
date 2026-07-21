import { STORY_SETTINGS } from '../constants'
import { Message } from '../types/core'

export const getStoryStats = (
  messages: Message[],
  charsPerToken: number,
  _model?: string,
  _provider?: 'ollama' | 'openrouter' | 'anthropic',
) => {
  const storyMessages = messages.filter((msg) => !msg.isQuery)

  console.log('getStoryStats debug:', {
    totalMessages: messages.length,
    storyMessages: storyMessages.length,
    charsPerToken,
  })

  // For word count, always use full content
  const storyText = storyMessages.map((msg) => msg.content).join(' ')
  const wordCount = storyText.trim() ? storyText.trim().split(/\s+/).length : 0

  const contextText = storyMessages.map((msg) => msg.content).join('\n\n')

  const charCount = contextText.length
  const estimatedTokens = Math.ceil(charCount / charsPerToken)

  console.log('getStoryStats content breakdown:', {
    fullCount: storyMessages.length,
    fullTextCharCount: storyText.length,
    contextTextCharCount: charCount,
    estimatedTokens,
  })

  return { wordCount, charCount, estimatedTokens }
}

export const getMessagesInContext = (
  messages: Message[],
  contextSize: number,
  charsPerToken: number,
  _model?: string,
  _provider?: 'ollama' | 'openrouter' | 'anthropic',
) => {
  const messagesInContext = new Set<string>()

  // Only consider assistant messages (actual story content) like we do in generation
  const storyMessages = messages.filter((msg) => !msg.isQuery && msg.role === 'assistant')

  const storyContext = storyMessages.map((msg) => msg.content).join('\n\n')

  const contextTokens = Math.ceil(storyContext.length / charsPerToken)

  // If the actual story context fits, mark all story messages as in context
  if (contextTokens <= contextSize) {
    storyMessages.forEach((msg) => messagesInContext.add(msg.id))
  } else {
    // If it doesn't fit, work backwards to see which recent messages fit
    let totalTokens = 0
    for (let i = storyMessages.length - 1; i >= 0; i--) {
      const msg = storyMessages[i]
      const content = msg.content

      const messageTokens = Math.ceil(content.length / charsPerToken)

      if (totalTokens + messageTokens <= contextSize) {
        messagesInContext.add(msg.id)
        totalTokens += messageTokens
      } else {
        break
      }
    }
  }

  return messagesInContext
}

/**
 * Get the minimal system message - just the role description and genre.
 * Detailed instructions are now in getStoryInstructions() and placed near the user message.
 */
export const getMinimalSystemPrompt = (
  storySetting: string,
  storyFormat?: 'narrative' | 'cyoa',
) => {
  const selectedSetting = STORY_SETTINGS.find((s) => s.value === storySetting)
  const settingText = selectedSetting?.value
    ? ` This is a ${selectedSetting.label.toLowerCase()} story.`
    : ''

  if (storyFormat === 'cyoa') {
    return `You are a creative story writer creating an interactive "Choose Your Own Adventure" narrative.${settingText}`
  }

  return `You are a creative story writer helping to create an engaging narrative.${settingText}`
}

/**
 * Get the detailed writing instructions - placed near the end of context for better LLM attention.
 */
export const getStoryInstructions = (
  person?: string,
  tense?: string,
  protagonistName?: string,
  isNewStory?: boolean,
  viewpointCharacterName?: string,
  chapterGoal?: string,
  storyFormat?: 'narrative' | 'cyoa',
  paragraphsPerTurn?: number,
) => {
  // Build narrative style instruction
  const personText = person === 'first' ? 'first person' : person === 'second' ? 'second person' : 'third person'
  const tenseText = tense === 'present' ? 'present tense' : 'past tense'

  // Determine the viewpoint character name to use (explicit viewpoint or protagonist fallback)
  const viewpointName = viewpointCharacterName || protagonistName

  // Build perspective text based on person and viewpoint character
  let perspectiveText = ''
  if (viewpointName) {
    if (person === 'first') {
      perspectiveText = ` from the perspective of ${viewpointName}`
    } else if (person === 'second') {
      perspectiveText = ` where "you" refers to ${viewpointName}`
    } else {
      // Third person - use "following X's viewpoint"
      perspectiveText = ` following ${viewpointName}'s viewpoint`
    }
  }

  const styleText = `Write in ${personText} ${tenseText}${perspectiveText}.`

  // Build chapter goal text if provided
  const goalText = chapterGoal
    ? `\n\nCHAPTER GOAL: ${chapterGoal}\nKeep this goal in mind as you continue the story, but don't feel obligated to fully accomplish it in a single turn. Progress naturally toward this goal through character actions and developments.`
    : ''

  const taskText = isNewStory
    ? `Create a story based on the user's direction.`
    : `Continue the story based on the user's direction, maintaining consistency with previous events and character development.`

  // CYOA-specific instructions
  if (storyFormat === 'cyoa') {
    const protagonistRef = viewpointName || 'the protagonist'
    const paragraphGuidance =
      paragraphsPerTurn && paragraphsPerTurn > 0
        ? `\n\n- Write no more than ${paragraphsPerTurn} paragraph${paragraphsPerTurn !== 1 ? 's' : ''} before asking what the protagonist does`
        : ''
    return `WRITING INSTRUCTIONS:
${styleText} ${taskText}${goalText}

Write in a natural, flowing style that draws the reader in. Focus on "show, don't tell" and include vivid descriptions, dialogue, and character thoughts where appropriate.

IMPORTANT:
- Write a single story section that responds to the reader's choice
- Use natural paragraph breaks to structure your writing
- Do not include chapter headers, separators, or section labels
- Do not add author notes or commentary
- Do NOT use any other tags (no </s>, <|im_end|>, etc.)
- When introducing new characters, select names from the <name-suggestions> element in the context

PACING AND TONE GUIDELINES:
- Not every turn needs to end with a cliffhanger or dramatic revelation
- ABSOLUTELY NEVER use repetitive reflective endings. FORBIDDEN phrases include: "their life would never be the same", "everything had changed", "nothing would ever be the same", "the world had shifted", "everything was different now", "life as they knew it was over", "a new chapter had begun", "the old world was gone", "everything was forever altered", or ANY similar clichéd reflective conclusion. These are BANNED.
- Allow for natural story rhythms with quieter moments, conversations, and character development
- Focus on authentic character actions and dialogue rather than overly dramatic internal monologues

PLAYER AGENCY:
The reader controls ONLY the main character (the POV character for this scene). You, as the author, control all other characters, NPCs, world events, and story developments. The reader decides their character's actions; you decide how the world responds.

INTERPRETING PLAYER INPUT:
- Player input describes their intent or general action, NOT literal dialogue or exact wording
- Write the scene showing the character performing this action naturally with appropriate dialogue and description
- EXCEPTION: Text in "quotes" should be used literally as the character's exact words
- Example: "I ask about the artifact" → Write a natural scene where the character inquires about the artifact
- Example: "I say 'Give me the artifact or else'" → Use that exact dialogue in the scene

ENDING FORMAT:
After completing this turn's story content, end by asking what the protagonist does next. Do NOT provide numbered options or choices - just ask the open-ended question.

CORRECT ending format:
[End of narrative paragraph]

What does ${protagonistRef} do?

Do NOT add dramatic setup sentences before the question. Do NOT ask what NPCs do or what happens - ONLY ask what ${protagonistRef} does.${paragraphGuidance}`
  }

  // Standard narrative mode
  return `WRITING INSTRUCTIONS:
${styleText} ${taskText}${goalText}

Write in a natural, flowing style that draws the reader in. Focus on "show, don't tell" and include vivid descriptions, dialogue, and character thoughts where appropriate.

IMPORTANT:
- Write ONLY a single story continuation turn
- Write ONLY what the user's direction specifically asks for - do not add extra scenes, events, or content beyond what was requested
- If the user asks for a conversation, write only that conversation - do not add events before or after
- If the user asks for a specific action or scene, write only that action or scene - do not extend beyond it
- Use natural paragraph breaks to structure your writing
- Do not include chapter headers, separators, or section labels
- Do not add author notes or commentary
- Simply continue the story directly with proper paragraphs
- Do NOT use any other tags (no </s>, <|im_end|>, etc.)
- When introducing new characters, select names from the <name-suggestions> element in the context

PACING AND TONE GUIDELINES:
- Not every turn needs to end with a cliffhanger or dramatic revelation
- ABSOLUTELY NEVER use repetitive reflective endings. FORBIDDEN phrases include: "their life would never be the same", "everything had changed", "nothing would ever be the same", "the world had shifted", "everything was different now", "life as they knew it was over", "a new chapter had begun", "the old world was gone", "everything was forever altered", or ANY similar clichéd reflective conclusion. These are BANNED.
- Allow for natural story rhythms with quieter moments, conversations, and character development
- Sometimes the most engaging turns simply advance the story naturally without forced drama
- Focus on authentic character actions and dialogue rather than overly dramatic internal monologues`
}

/**
 * @deprecated Use getMinimalSystemPrompt and getStoryInstructions separately for better LLM attention.
 * This function is kept for backward compatibility with existing code.
 */
export const getStoryPrompt = (
  storySetting: string,
  person?: string,
  tense?: string,
  protagonistName?: string,
  isNewStory?: boolean,
  viewpointCharacterName?: string,
  chapterGoal?: string,
  storyFormat?: 'narrative' | 'cyoa',
) => {
  // For backward compatibility, combine the minimal system prompt with instructions
  const minimal = getMinimalSystemPrompt(storySetting, storyFormat)
  const instructions = getStoryInstructions(person, tense, protagonistName, isNewStory, viewpointCharacterName, chapterGoal, storyFormat)
  return `${minimal}\n\n${instructions}`
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  cache_control?: {
    type: 'ephemeral'
    ttl?: '5m' | '1h'
  }
}

// Keep backward compatibility
export const getStoryPromptWithHistory = (
  inputText: string,
  messages: Message[],
  storySetting: string,
  characterContext?: string,
  person?: string,
  tense?: string,
  protagonistName?: string,
  viewpointCharacterName?: string,
) => {
  // Only use assistant messages (actual story content)
  const storyMessages = messages.filter((msg) => !msg.isQuery && msg.role === 'assistant')

  const storyContext = storyMessages.map((msg) => msg.content).join('\n\n')

  const contextSection = characterContext ? `${characterContext}` : ''
  const isNewStory = storyMessages.length === 0

  return `${contextSection}${getStoryPrompt(storySetting, person, tense, protagonistName, isNewStory, viewpointCharacterName)}

Previous story:
${storyContext}

The following is an instruction describing what to write next. It is NOT part of the story - write the content it describes:

"${inputText}"

Continue the story directly below (no labels or formatting):`
}

export const getStoryPromptWithFullHistory = (
  inputText: string,
  messages: Message[],
  storySetting: string,
  characterContext?: string,
  person?: string,
  tense?: string,
  protagonistName?: string,
  viewpointCharacterName?: string,
) => {
  // Only use assistant messages (actual story content)
  const storyMessages = messages.filter((msg) => !msg.isQuery && msg.role === 'assistant')

  // Build context with full content for all turns (no summaries)
  const storyContext = storyMessages.map((msg) => msg.content).join('\n\n')

  const contextSection = characterContext ? `${characterContext}` : ''
  const isNewStory = storyMessages.length === 0

  console.log(
    'Story messages for full history context:',
    storyMessages.map((m, i) => ({
      turnNumber: i + 1,
      content: `${m.content.substring(0, 50)}...`,
      summaryType: 'full',
    })),
  )
  console.log(
    'Full history prompt being sent:',
    `${contextSection}${getStoryPrompt(storySetting, person, tense, protagonistName, isNewStory, viewpointCharacterName)}

Previous story:
${storyContext}

User direction: ${inputText}

Story continuation:`,
  )

  return `${contextSection}${getStoryPrompt(storySetting, person, tense, protagonistName, isNewStory, viewpointCharacterName)}

Previous story:
${storyContext}

The following is an instruction describing what to write next. It is NOT part of the story - write the content it describes:

"${inputText}"

Continue the story directly below (no labels or formatting):`
}

export const getStoryMessagesWithFullHistory = (
  inputText: string,
  messages: Message[],
  storySetting: string,
  characterContext?: string,
  person?: string,
  tense?: string,
  protagonistName?: string,
  paragraphsPerTurn?: number,
  viewpointCharacterName?: string,
): ChatMessage[] => {
  // Only use assistant messages (actual story content)
  const storyMessages = messages.filter((msg) => !msg.isQuery && msg.role === 'assistant')

  // Build context with full content for all turns (no summaries)
  const storyContext = storyMessages.map((msg) => msg.content).join('\n\n')

  // System message: writing guidelines only (no character context)
  const isNewStory = storyMessages.length === 0
  const systemContent = getStoryPrompt(storySetting, person, tense, protagonistName, isNewStory, viewpointCharacterName)

  // User message: story context + character context + user instruction (optimized order for attention)
  const fullContext = (characterContext || '').trim()
  const paragraphGuidance =
    paragraphsPerTurn && paragraphsPerTurn > 0
      ? `\n\nIMPORTANT: Write approximately ${paragraphsPerTurn} paragraph${paragraphsPerTurn !== 1 ? 's' : ''} in your response.`
      : ''
  const userContent = storyContext
    ? `Previous story:\n${storyContext}\n\n${fullContext ? `Active story context:\n${fullContext}\n\n` : ''}The following is an instruction describing what to write next. It is NOT part of the story - write the content it describes:\n\n"${inputText}"${paragraphGuidance}\n\nContinue the story directly below (no labels or formatting):`
    : `${fullContext ? `Active story context:\n${fullContext}\n\n` : ''}The following is an instruction describing what to write next. It is NOT part of the story - write the content it describes:\n\n"${inputText}"${paragraphGuidance}\n\nBegin the story directly below (no labels or formatting):`

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ]
}

// Keep backward compatibility
export const getQueryPrompt = (inputText: string, messages: Message[]) => {
  // Only use assistant messages (actual story content)
  const storyMessages = messages.filter((msg) => !msg.isQuery && msg.role === 'assistant')

  const storyContext = storyMessages.map((msg) => msg.content).join('\n\n')

  return `You are a helpful assistant answering questions about a story in progress. Here is the story so far:

${storyContext}

User question: ${inputText}

Please provide a clear, concise answer about the story, its characters, plot, or any other aspect the user is asking about. Do not continue the story itself.`
}
