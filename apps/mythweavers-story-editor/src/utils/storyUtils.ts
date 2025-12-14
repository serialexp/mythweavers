import { Message } from '../types/core'
import { STORY_SETTINGS } from '../constants'


export const getStoryStats = (messages: Message[], charsPerToken: number, model?: string, provider?: 'ollama' | 'openrouter' | 'anthropic') => {
  const storyMessages = messages.filter(msg => !msg.isQuery)
  
  // Check if we're using a Claude model or Anthropic provider
  const isClaudeModel = model?.toLowerCase().includes('claude')
  const isAnthropicProvider = provider === 'anthropic'
  const alwaysUseFullContent = isClaudeModel || isAnthropicProvider
  
  console.log('getStoryStats debug:', {
    totalMessages: messages.length,
    storyMessages: storyMessages.length,
    model,
    provider,
    isClaudeModel,
    isAnthropicProvider,
    alwaysUseFullContent,
    charsPerToken
  })
  
  // For word count, always use full content
  const storyText = storyMessages.map(msg => msg.content).join(' ')
  const wordCount = storyText.trim() ? storyText.trim().split(/\s+/).length : 0
  
  // For token estimation, use the same logic as context calculation
  let summaryCount = 0
  let paragraphCount = 0
  let fullCount = 0
  
  const contextText = storyMessages.map((msg, index) => {
    const storyTurnNumber = index + 1
    const totalStoryTurns = storyMessages.length
    
    if (alwaysUseFullContent) {
      // For Anthropic/Claude models, always use full content
      fullCount++
      return msg.content
    } else {
      // Use different summary levels based on turn position
      const sentenceSummary = msg.sentenceSummary || msg.summary
      if (storyTurnNumber <= (totalStoryTurns - 14) && sentenceSummary) {
        // More than 14 turns from end: use sentence summary
        summaryCount++
        return sentenceSummary
      } else if (storyTurnNumber <= (totalStoryTurns - 7) && msg.paragraphSummary) {
        // 8-14 turns from end: use paragraph summary
        paragraphCount++
        return msg.paragraphSummary
      } else {
        // Last 7 turns: use full content
        fullCount++
        return msg.content
      }
    }
  }).join('\n\n')
  
  const charCount = contextText.length
  const estimatedTokens = Math.ceil(charCount / charsPerToken)
  
  console.log('getStoryStats content breakdown:', {
    summaryCount,
    paragraphCount,
    fullCount,
    fullTextCharCount: storyText.length,
    contextTextCharCount: charCount,
    estimatedTokens
  })

  return { wordCount, charCount, estimatedTokens }
}

export const getMessagesInContext = (messages: Message[], contextSize: number, charsPerToken: number, model?: string, provider?: 'ollama' | 'openrouter' | 'anthropic') => {
  const messagesInContext = new Set<string>()
  
  // Only consider assistant messages (actual story content) like we do in generation
  const storyMessages = messages.filter(msg => !msg.isQuery && msg.role === 'assistant')
  
  // Check if we're using a Claude model or Anthropic provider (which always uses full content)
  const isClaudeModel = model?.toLowerCase().includes('claude')
  const isAnthropicProvider = provider === 'anthropic'
  const alwaysUseFullContent = isClaudeModel || isAnthropicProvider
  
  // Calculate actual content size using the same logic as generation
  const storyContext = storyMessages.map((msg, index) => {
    const storyTurnNumber = index + 1
    const totalStoryTurns = storyMessages.length
    
    if (alwaysUseFullContent) {
      // For Anthropic/Claude models, always use full content
      return msg.content
    } else {
      // Use different summary levels based on turn position
      const sentenceSummary = msg.sentenceSummary || msg.summary
      if (storyTurnNumber <= (totalStoryTurns - 14) && sentenceSummary) {
        // More than 14 turns from end: use sentence summary
        return sentenceSummary
      } else if (storyTurnNumber <= (totalStoryTurns - 7) && msg.paragraphSummary) {
        // 8-14 turns from end: use paragraph summary
        return msg.paragraphSummary
      } else {
        // Last 7 turns: use full content
        return msg.content
      }
    }
  }).join('\n\n')
  
  const contextTokens = Math.ceil(storyContext.length / charsPerToken)
  
  // If the actual story context fits, mark all story messages as in context
  if (contextTokens <= contextSize) {
    storyMessages.forEach(msg => messagesInContext.add(msg.id))
  } else {
    // If it doesn't fit, work backwards to see which recent messages fit
    let totalTokens = 0
    for (let i = storyMessages.length - 1; i >= 0; i--) {
      const msg = storyMessages[i]
      const storyTurnNumber = i + 1
      const totalStoryTurns = storyMessages.length
      
      // Use different summary levels based on turn position
      let content: string
      if (alwaysUseFullContent) {
        // For Anthropic/Claude models, always use full content
        content = msg.content
      } else {
        const sentenceSummary = msg.sentenceSummary || msg.summary
        if (storyTurnNumber <= (totalStoryTurns - 14) && sentenceSummary) {
          // More than 14 turns from end: use sentence summary
          content = sentenceSummary
        } else if (storyTurnNumber <= (totalStoryTurns - 7) && msg.paragraphSummary) {
          // 8-14 turns from end: use paragraph summary
          content = msg.paragraphSummary
        } else {
          // Last 7 turns: use full content
          content = msg.content
        }
      }
      
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

export const getStoryPrompt = (storySetting: string, person?: string, tense?: string, protagonistName?: string, isNewStory?: boolean, viewpointCharacterName?: string, chapterGoal?: string) => {
  const selectedSetting = STORY_SETTINGS.find(s => s.value === storySetting)
  const settingText = selectedSetting && selectedSetting.value
    ? `This is a ${selectedSetting.label.toLowerCase()} story. Write in the appropriate tone, style, and atmosphere for this genre. `
    : ''

  // Build narrative style instruction
  const personText = person === 'first' ? 'first person' : 'third person'
  const tenseText = tense === 'present' ? 'present tense' : 'past tense'

  // Determine the viewpoint character name to use (explicit viewpoint or protagonist fallback)
  const viewpointName = viewpointCharacterName || protagonistName

  // Build perspective text based on person and viewpoint character
  let perspectiveText = ''
  if (viewpointName) {
    if (person === 'first') {
      perspectiveText = ` from the perspective of ${viewpointName}`
    } else {
      // Third person - use "following X's viewpoint"
      perspectiveText = ` following ${viewpointName}'s viewpoint`
    }
  }

  const styleText = `Write in ${personText} ${tenseText}${perspectiveText}. `

  // Build chapter goal text if provided
  const goalText = chapterGoal
    ? `\n\nCHAPTER GOAL: ${chapterGoal}\nKeep this goal in mind as you continue the story, but don't feel obligated to fully accomplish it in a single turn. Progress naturally toward this goal through character actions and developments. `
    : ''

  const taskText = isNewStory
    ? `Create a story based on the user's direction. `
    : `Continue the story based on the user's direction, maintaining consistency with previous events and character development. `

  return `You are a creative story writer helping to create an engaging narrative. ${settingText}${styleText}${taskText}${goalText}Write in a natural, flowing style that draws the reader in. Focus on "show, don't tell" and include vivid descriptions, dialogue, and character thoughts where appropriate.

IMPORTANT: 
- Write ONLY a single story continuation turn
- Write ONLY what the user's direction specifically asks for - do not add extra scenes, events, or content beyond what was requested
- If the user asks for a conversation, write only that conversation - do not add events before or after
- If the user asks for a specific action or scene, write only that action or scene - do not extend beyond it
- Use natural paragraph breaks to structure your writing
- Do not include chapter headers, separators, or section labels
- Do not add author notes or commentary
- Simply continue the story directly with proper paragraphs
- If you need to reason about the story, use <think>your reasoning here</think> tags
- Do NOT use any other tags (no </s>, <|im_end|>, etc.) - only <think> tags when needed

PACING AND TONE GUIDELINES:
- Not every turn needs to end with a cliffhanger or dramatic revelation
- ABSOLUTELY NEVER use repetitive reflective endings. FORBIDDEN phrases include: "their life would never be the same", "everything had changed", "nothing would ever be the same", "the world had shifted", "everything was different now", "life as they knew it was over", "a new chapter had begun", "the old world was gone", "everything was forever altered", or ANY similar clichéd reflective conclusion. These are BANNED.
- Allow for natural story rhythms with quieter moments, conversations, and character development
- Sometimes the most engaging turns simply advance the story naturally without forced drama
- Focus on authentic character actions and dialogue rather than overly dramatic internal monologues`
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
export const getStoryPromptWithHistory = (inputText: string, messages: Message[], storySetting: string, characterContext?: string, person?: string, tense?: string, protagonistName?: string, viewpointCharacterName?: string) => {
  // Only use assistant messages (actual story content)
  const storyMessages = messages.filter(msg => !msg.isQuery && msg.role === 'assistant')

  // Build context with summaries for older turns
  const storyContext = storyMessages.map((msg, index) => {
    const storyTurnNumber = index + 1
    const totalStoryTurns = storyMessages.length

    // Use different summary levels based on turn position
    const sentenceSummary = msg.sentenceSummary || msg.summary
    if (storyTurnNumber <= (totalStoryTurns - 14) && sentenceSummary) {
      // More than 14 turns from end: use sentence summary
      return sentenceSummary
    } else if (storyTurnNumber <= (totalStoryTurns - 7) && msg.paragraphSummary) {
      // 8-14 turns from end: use paragraph summary
      return msg.paragraphSummary
    } else {
      // Last 7 turns: use full content
      return msg.content
    }
  }).join('\n\n')

  const contextSection = characterContext ? `${characterContext}` : ''
  const isNewStory = storyMessages.length === 0

  return `${contextSection}${getStoryPrompt(storySetting, person, tense, protagonistName, isNewStory, viewpointCharacterName)}

Previous story:
${storyContext}

The following is an instruction describing what to write next. It is NOT part of the story - write the content it describes:

"${inputText}"

Continue the story directly below (no labels or formatting):`
}

export const getStoryPromptWithFullHistory = (inputText: string, messages: Message[], storySetting: string, characterContext?: string, person?: string, tense?: string, protagonistName?: string, viewpointCharacterName?: string) => {
  // Only use assistant messages (actual story content)
  const storyMessages = messages.filter(msg => !msg.isQuery && msg.role === 'assistant')

  // Build context with full content for all turns (no summaries)
  const storyContext = storyMessages.map(msg => msg.content).join('\n\n')

  const contextSection = characterContext ? `${characterContext}` : ''
  const isNewStory = storyMessages.length === 0

  console.log('Story messages for full history context:', storyMessages.map((m, i) => ({
    turnNumber: i + 1,
    content: m.content.substring(0, 50) + '...',
    summaryType: 'full'
  })))
  console.log('Full history prompt being sent:', `${contextSection}${getStoryPrompt(storySetting, person, tense, protagonistName, isNewStory, viewpointCharacterName)}

Previous story:
${storyContext}

User direction: ${inputText}

Story continuation:`)

  return `${contextSection}${getStoryPrompt(storySetting, person, tense, protagonistName, isNewStory, viewpointCharacterName)}

Previous story:
${storyContext}

The following is an instruction describing what to write next. It is NOT part of the story - write the content it describes:

"${inputText}"

Continue the story directly below (no labels or formatting):`
}

export const getStoryMessagesWithFullHistory = (inputText: string, messages: Message[], storySetting: string, characterContext?: string, person?: string, tense?: string, protagonistName?: string, paragraphsPerTurn?: number, viewpointCharacterName?: string): ChatMessage[] => {
  // Only use assistant messages (actual story content)
  const storyMessages = messages.filter(msg => !msg.isQuery && msg.role === 'assistant')

  // Build context with full content for all turns (no summaries)
  const storyContext = storyMessages.map(msg => msg.content).join('\n\n')

  // System message: writing guidelines only (no character context)
  const isNewStory = storyMessages.length === 0
  const systemContent = getStoryPrompt(storySetting, person, tense, protagonistName, isNewStory, viewpointCharacterName)

  // User message: story context + character context + user instruction (optimized order for attention)
  const fullContext = (characterContext || '').trim()
  const paragraphGuidance = paragraphsPerTurn && paragraphsPerTurn > 0
    ? `\n\nIMPORTANT: Write approximately ${paragraphsPerTurn} paragraph${paragraphsPerTurn !== 1 ? 's' : ''} in your response.`
    : ''
  const userContent = storyContext
    ? `Previous story:\n${storyContext}\n\n${fullContext ? `Active story context:\n${fullContext}\n\n` : ''}The following is an instruction describing what to write next. It is NOT part of the story - write the content it describes:\n\n"${inputText}"${paragraphGuidance}\n\nContinue the story directly below (no labels or formatting):`
    : `${fullContext ? `Active story context:\n${fullContext}\n\n` : ''}The following is an instruction describing what to write next. It is NOT part of the story - write the content it describes:\n\n"${inputText}"${paragraphGuidance}\n\nBegin the story directly below (no labels or formatting):`

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent }
  ]
}

// Keep backward compatibility
export const getQueryPrompt = (inputText: string, messages: Message[]) => {
  // Only use assistant messages (actual story content)
  const storyMessages = messages.filter(msg => !msg.isQuery && msg.role === 'assistant')
  
  // Build context with summaries for older turns
  const storyContext = storyMessages.map((msg, index) => {
    const storyTurnNumber = index + 1
    const totalStoryTurns = storyMessages.length
    
    // Use different summary levels based on turn position
    const sentenceSummary = msg.sentenceSummary || msg.summary
    if (storyTurnNumber <= (totalStoryTurns - 14) && sentenceSummary) {
      // More than 14 turns from end: use sentence summary
      return sentenceSummary
    } else if (storyTurnNumber <= (totalStoryTurns - 7) && msg.paragraphSummary) {
      // 8-14 turns from end: use paragraph summary
      return msg.paragraphSummary
    } else {
      // Last 7 turns: use full content
      return msg.content
    }
  }).join('\n\n')

  return `You are a helpful assistant answering questions about a story in progress. Here is the story so far:

${storyContext}

User question: ${inputText}

Please provide a clear, concise answer about the story, its characters, plot, or any other aspect the user is asking about. Do not continue the story itself.`
}

export const getSummarizationPrompt = (content: string, characterContext?: string): string => {
  // Calculate dynamic sentence count based on content length
  const wordCount = content.trim().split(/\s+/).length
  let sentenceCount: number
  
  if (wordCount <= 200) {
    sentenceCount = 2
  } else if (wordCount <= 500) {
    sentenceCount = 3
  } else if (wordCount <= 1000) {
    sentenceCount = 4
  } else if (wordCount <= 2000) {
    sentenceCount = 5
  } else {
    sentenceCount = 6
  }
  
  const sentenceText = sentenceCount === 1 ? 'sentence' : 'sentences'
  
  // Check if there's a protagonist mentioned in the character context
  const hasProtagonist = characterContext?.includes('(protagonist)')
  const protagonistNote = hasProtagonist ? ' Pay special attention to the protagonist\'s actions and development.' : ''
  
  return `Summarize the story section provided above in exactly ${sentenceCount} ${sentenceText}. Focus on the most important plot points, character developments, or key events.${protagonistNote} Be concise and capture the essence of what happens. Use character names directly without introducing or describing who they are. Do NOT include any preamble, introduction, or meta-commentary. Output ONLY the summary itself.`
}

export const getSentenceSummarizationPrompt = (
  _content: string,
  characterContext?: string,
): string => {
  const hasProtagonist = characterContext?.includes('(protagonist)')
  const protagonistNote = hasProtagonist
    ? ' Highlight the protagonist’s role if relevant.'
    : ''
  return `Summarize the story section provided above in exactly one sentence. Capture the most important event or character development using character names directly.${protagonistNote} Do NOT include any preamble, introduction, or meta-commentary. Output ONLY the single sentence summary.`
}

export const getParagraphSummarizationPrompt = (content: string, characterContext?: string): string => {
  // Calculate dynamic paragraph count based on content length
  const wordCount = content.trim().split(/\s+/).length
  let paragraphCount: number
  
  if (wordCount <= 300) {
    paragraphCount = 1
  } else if (wordCount <= 800) {
    paragraphCount = 2
  } else if (wordCount <= 1500) {
    paragraphCount = 3
  } else {
    paragraphCount = 4
  }
  
  const paragraphText = paragraphCount === 1 ? 'paragraph' : 'paragraphs'
  
  // Check if there's a protagonist mentioned in the character context
  const hasProtagonist = characterContext?.includes('(protagonist)')
  const protagonistNote = hasProtagonist ? ' Give special emphasis to the protagonist\'s journey and experiences.' : ''
  
  return `Summarize the story section provided above in exactly ${paragraphCount} ${paragraphText}. Focus on what happens - the events, actions, and plot developments. Include key dialogue and character actions, but avoid descriptive language, metaphors, or embellishments.${protagonistNote} Write in a straightforward, factual style that captures the sequence of events. Use character names directly. Do NOT include any preamble, introduction, or meta-commentary. Output ONLY the summary itself.`
}
