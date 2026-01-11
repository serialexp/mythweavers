import { Character, ContextItem, Message, Node } from '../types/core'
import { generateAnalysis } from './analysisClient'
import { MissingSummariesError } from './errors'
import { getMarkedNodesContent } from './nodeContentExport'
import { calculateActivePath, getSceneNodesBeforeNode } from './nodeTraversal'
import { buildSmartContext } from './smartContext'
import { ChatMessage, getMinimalSystemPrompt, getStoryInstructions } from './storyUtils'

export type ContextType = 'story' | 'query' | 'smart-story'

export interface ContextGenerationOptions {
  // Required
  inputText: string
  messages: Message[]

  // Context type determines system prompt and behavior
  contextType: ContextType

  // Story-specific options
  storySetting?: string
  storyFormat?: 'narrative' | 'cyoa'
  person?: string
  tense?: string
  protagonistName?: string
  viewpointCharacterName?: string // Name of the viewpoint character for this chapter
  paragraphsPerTurn?: number

  // Context data
  characterContext?: string
  characters?: Character[]
  contextItems?: ContextItem[]

  // Node handling
  nodes?: Node[]
  targetMessageId?: string // For determining current node

  // Branch handling
  branchChoices?: Record<string, string> // branchMessageId -> selectedOptionId

  // Model info
  model?: string
  provider?: 'ollama' | 'openrouter' | 'anthropic'

  // Advanced options
  includeQueryHistory?: boolean // For query contexts
  maxQueryHistory?: number // Default: 5
  forceMissingSummaries?: boolean // Force generation even if scene summaries are missing
}

/**
 * Apply summarization based on position in context
 */
function applySummarization(
  message: Message,
  position: number,
  total: number,
  isClaudeModel: boolean,
  isCurrentChapter = false,
): string {
  // For Claude models, use full content only for current chapter
  // Previous chapters should use summaries
  if (isClaudeModel && isCurrentChapter) {
    return message.content
  }

  const turnsFromEnd = total - position

  // More than 14 turns from end: use sentence summary
  const sentenceSummary = message.sentenceSummary ?? message.summary
  if (turnsFromEnd > 14 && sentenceSummary) {
    return sentenceSummary
  }
  // 8-14 turns from end: use paragraph summary
  if (turnsFromEnd > 7 && message.paragraphSummary) {
    return message.paragraphSummary
  }
  // Last 7 turns: use full content

  return message.content
}

/**
 * Unified function for generating context messages for all use cases
 */
export async function generateContextMessages(options: ContextGenerationOptions): Promise<ChatMessage[]> {
  console.log('[generateContextMessages] Starting with options:', {
    contextType: options.contextType,
    messageCount: options.messages.length,
    nodeCount: options.nodes?.length || 0,
    targetMessageId: options.targetMessageId,
    forceMissingSummaries: options.forceMissingSummaries,
  })
  const {
    inputText,
    messages,
    contextType,
    storySetting = '',
    storyFormat = 'narrative',
    person,
    tense,
    protagonistName,
    viewpointCharacterName,
    paragraphsPerTurn,
    characterContext,
    characters = [],
    contextItems = [],
    targetMessageId,
    model,
    provider: _provider, // unused but part of interface
    includeQueryHistory = false,
    maxQueryHistory = 5,
  } = options

  const chatMessages: ChatMessage[] = []
  const isClaudeModel = model?.toLowerCase().includes('claude')

  // Calculate active path based on branch choices
  const nodes = options.nodes || []
  const branchChoices = options.branchChoices || {}
  let activeMessageIds: Set<string> | null = null
  let activeNodeIds: Set<string> | null = null

  if (nodes.length > 0 && Object.keys(branchChoices).length > 0) {
    const activePath = calculateActivePath(messages, nodes, branchChoices)
    activeMessageIds = activePath.activeMessageIds
    activeNodeIds = activePath.activeNodeIds
    console.log('[generateContextMessages] Active path:', {
      activeMessages: activeMessageIds.size,
      activeNodes: activeNodeIds.size,
    })
  }

  // Filter messages based on context type AND active path
  const storyMessages = messages.filter((msg) => {
    // Basic filtering
    if (msg.isQuery || msg.role !== 'assistant' || msg.type === 'chapter') return false

    // If we have an active path, only include messages on the path
    if (activeMessageIds && !activeMessageIds.has(msg.id)) {
      console.log('[generateContextMessages] Excluding message (not on active path):', msg.id.substring(0, 8))
      return false
    }

    return true
  })
  console.log('[generateContextMessages] Filtered story messages:', storyMessages.length)

  // Determine current node and scene goal
  let currentNodeId: string | undefined
  let sceneGoal: string | undefined

  if (targetMessageId) {
    const targetMessage = messages.find((msg) => msg.id === targetMessageId)
    currentNodeId = targetMessage?.sceneId
  }

  if (!currentNodeId && storyMessages.length > 0) {
    // Find from the last story message with a nodeId
    for (let i = storyMessages.length - 1; i >= 0; i--) {
      if (storyMessages[i].sceneId) {
        currentNodeId = storyMessages[i].sceneId
        break
      }
    }
  }

  if (currentNodeId && nodes.length > 0) {
    const currentNode = nodes.find((n) => n.id === currentNodeId)
    if (currentNode?.type === 'scene' && currentNode.goal) {
      sceneGoal = currentNode.goal
    }
  }

  // Add minimal system message based on context type
  // Detailed instructions are added near the end for better LLM attention
  if (contextType === 'query') {
    const systemContent =
      'You are a helpful assistant answering questions about a story in progress. Provide clear, concise answers about the story, its characters, plot, or any other aspect the user is asking about. Do not continue the story itself.'
    chatMessages.push({ role: 'system', content: systemContent })
  } else {
    // Story or smart-story context - use minimal system prompt
    // Detailed instructions will be added near the end
    const systemContent = getMinimalSystemPrompt(storySetting, storyFormat)
    chatMessages.push({ role: 'system', content: systemContent })
  }

  // Handle smart context if requested
  if (contextType === 'smart-story') {
    try {
      // Import messagesStore here to avoid circular dependency
      const { messagesStore } = await import('../stores/messagesStore')
      messagesStore.setIsAnalyzing(true)

      const selectedMessages = await buildSmartContext(
        inputText,
        messages,
        characters,
        contextItems,
        generateAnalysis,
        targetMessageId,
        options.forceMissingSummaries,
      )

      messagesStore.setIsAnalyzing(false)

      if (selectedMessages && selectedMessages.length > 0) {
        // Add the selected messages
        selectedMessages.forEach((msg) => {
          if (msg.content?.trim()) {
            chatMessages.push({
              role: 'assistant',
              content: msg.content,
              // Smart context returns pre-selected messages, no need for additional caching
            })
          }
        })
      } else {
        console.warn('Smart context returned no messages, falling back to traditional approach')
        // Fall through to traditional approach below
        // Use a mutable variable to track the effective context type
      }
    } catch (error) {
      console.error('Smart context generation failed:', error)
      // Fall through to traditional approach
      // Will be handled below by checking chatMessages length
    }
  }

  // Traditional context generation (story or query)
  if (contextType !== 'smart-story' || chatMessages.length === 1) {
    // First check if we have nodes (new system)
    const nodes = options.nodes || []
    if (nodes.length > 0) {
      console.log('[generateContextMessages] Using node-based context generation, nodes:', nodes.length)

      // Find current node based on targetMessageId
      let currentNodeId: string | undefined
      if (targetMessageId) {
        const targetMessage = messages.find((msg) => msg.id === targetMessageId)
        currentNodeId = targetMessage?.sceneId
        console.log('[generateContextMessages] Current node from target message:', currentNodeId)
      }

      if (!currentNodeId) {
        // Find from the last story message with a nodeId
        for (let i = storyMessages.length - 1; i >= 0; i--) {
          if (storyMessages[i].sceneId) {
            currentNodeId = storyMessages[i].sceneId
            console.log('[generateContextMessages] Current node from last story message:', currentNodeId)
            break
          }
        }
      }

      // Get all scene nodes that come before the current node in story order
      let sceneNodesBeforeCurrent = getSceneNodesBeforeNode(nodes, currentNodeId || '')

      // Filter by active path if we have branch choices
      if (activeNodeIds) {
        const beforeFiltering = sceneNodesBeforeCurrent.length
        sceneNodesBeforeCurrent = sceneNodesBeforeCurrent.filter((node) => activeNodeIds.has(node.id))
        console.log(
          '[generateContextMessages] Filtered scene nodes by active path:',
          beforeFiltering,
          '->',
          sceneNodesBeforeCurrent.length,
        )
      }

      const currentNode = nodes.find((n) => n.id === currentNodeId)

      // Check nodes that come BEFORE current for missing summaries
      // Skip nodes with includeInFull === 2 since they use full content anyway
      const nodesWithoutSummaries: string[] = []
      for (const node of sceneNodesBeforeCurrent) {
        // Skip nodes that will include full content (no summary needed)
        if (node.includeInFull === 2) continue

        if (!node.summary) {
          const nodeMessages = storyMessages.filter((msg) => msg.sceneId === node.id)
          const hasMeaningfulContent = nodeMessages.some((msg) => msg.content.trim().length > 0)
          if (hasMeaningfulContent) {
            nodesWithoutSummaries.push(node.title)
          }
        }
      }

      // If there are nodes without summaries and we're not forcing, throw an error listing all of them
      if (nodesWithoutSummaries.length > 0 && !options.forceMissingSummaries) {
        console.error('[generateContextMessages] Nodes missing summaries:', nodesWithoutSummaries)
        throw new MissingSummariesError(nodesWithoutSummaries)
      }

      // Add marked previous nodes using shared utility
      // This ensures same content format as character/context updates for cache sharing
      const markedContent = getMarkedNodesContent()
      for (const markedNode of markedContent) {
        // Skip current node - handled separately below
        if (markedNode.nodeId === currentNodeId) continue

        console.log(
          `[generateContextMessages] Adding ${markedNode.isFullContent ? 'full content' : 'summary'} for node:`,
          markedNode.title,
        )
        chatMessages.push({
          role: 'assistant',
          content: `[Scene: ${markedNode.title}]\n${markedNode.content}`,
        })
      }

      // Current node - add full messages with CYOA handling and cache control
      if (currentNode?.type === 'scene') {
        console.log('[generateContextMessages] Adding full messages for current node:', currentNode.title)
        const nodeMessages = storyMessages.filter((msg) => msg.sceneId === currentNodeId)
        nodeMessages.forEach((msg, index) => {
          if (msg.content?.trim()) {
            // In CYOA mode, add user instruction as a separate message before the assistant response
            if (storyFormat === 'cyoa' && msg.instruction?.trim()) {
              chatMessages.push({
                role: 'user',
                content: msg.instruction,
              })
            }

            const message: ChatMessage = {
              role: 'assistant',
              content: msg.content,
            }

            // Add cache control for Claude models to the last 3 turns
            if (isClaudeModel && index > nodeMessages.length - 4) {
              message.cache_control = { type: 'ephemeral', ttl: '1h' }
            }

            chatMessages.push(message)
          }
        })
      }
    } else {
      // Fallback: no nodes available, load all messages with summarization
      console.log('[generateContextMessages] No nodes available, using all messages with summarization')

      // Warn if there are many messages without node organization
      if (storyMessages.length > 50 && !options.forceMissingSummaries) {
        console.warn('[generateContextMessages] Many messages without node organization:', storyMessages.length)
        if (isClaudeModel) {
          const errorMsg = `Story has ${storyMessages.length} messages without scene organization. Please organize into scenes with summaries before continuing.`
          console.error(`[generateContextMessages] ${errorMsg}`)
          throw new Error(errorMsg)
        }
      }

      storyMessages.forEach((msg, index) => {
        const content = applySummarization(msg, index + 1, storyMessages.length, isClaudeModel || false, false)

        if (content?.trim()) {
          // In CYOA mode, add user instruction as a separate message before the assistant response
          if (storyFormat === 'cyoa' && msg.instruction?.trim()) {
            chatMessages.push({
              role: 'user',
              content: msg.instruction,
            })
          }

          const message: ChatMessage = {
            role: 'assistant',
            content: content,
          }

          // Add cache control for Claude models to the last 3 turns
          if (isClaudeModel && index > storyMessages.length - 4) {
            message.cache_control = { type: 'ephemeral', ttl: '1h' }
          }

          chatMessages.push(message)
        }
      })
    }
  }

  // Add character context if provided (wrapped in XML for clear structure)
  // Note: No cache_control here because story turns are added before this,
  // so the prefix changes every generation and cache would never hit.
  const fullContext = (characterContext || '').trim()
  if (fullContext) {
    chatMessages.push({
      role: 'user',
      content: `<story-context>\n${fullContext}\n</story-context>`,
    })
  }

  // Add query history if needed (for query context)
  if (contextType === 'query' && includeQueryHistory) {
    const queryMessages = messages.filter((msg) => msg.isQuery && msg.role === 'assistant')
    const recentQueries = queryMessages.slice(-maxQueryHistory)

    recentQueries.forEach((queryMsg) => {
      if (queryMsg.instruction) {
        chatMessages.push({
          role: 'user',
          content: `Question: ${queryMsg.instruction}`,
        })
      }
      if (queryMsg.content) {
        chatMessages.push({
          role: 'assistant',
          content: queryMsg.content,
        })
      }
    })
  }

  // Add writing instructions near the end for better LLM attention (story contexts only)
  if (contextType !== 'query') {
    const isNewStory = storyMessages.length === 0
    const instructions = getStoryInstructions(
      person,
      tense,
      protagonistName,
      isNewStory,
      viewpointCharacterName,
      sceneGoal,
      storyFormat,
      paragraphsPerTurn,
    )
    chatMessages.push({
      role: 'user',
      content: instructions,
    })
  }

  // Add the final user message
  if (contextType === 'query') {
    chatMessages.push({
      role: 'user',
      content: `Question: ${inputText}`,
    })
  } else if (storyFormat === 'cyoa') {
    // CYOA mode: user input is their choice, not a meta-instruction
    const paragraphGuidance =
      paragraphsPerTurn && paragraphsPerTurn > 0
        ? `\n\n[Write no more than ${paragraphsPerTurn} paragraphs before presenting choices]`
        : ''
    chatMessages.push({
      role: 'user',
      content: inputText + paragraphGuidance,
    })
  } else {
    // Narrative mode: wrap user input as a meta-instruction
    const continueOrBegin = storyMessages.length === 0 ? 'Begin' : 'Continue'
    const paragraphGuidance =
      paragraphsPerTurn && paragraphsPerTurn > 0
        ? `\n\nIMPORTANT: Write approximately ${paragraphsPerTurn} paragraph${paragraphsPerTurn !== 1 ? 's' : ''} in your response.`
        : ''
    chatMessages.push({
      role: 'user',
      content: `The following is an instruction describing what to write next. It is NOT part of the story - write the content it describes:\n\n"${inputText}"${paragraphGuidance}\n\n${continueOrBegin} the story directly below (no labels or formatting):`,
    })
  }

  console.log('[generateContextMessages] Final context:', {
    messageCount: chatMessages.length,
    totalLength: chatMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0),
    hasSystemMessage: chatMessages.some((m) => m.role === 'system'),
    hasUserMessage: chatMessages.some((m) => m.role === 'user'),
  })

  return chatMessages
}
