import { Character, ContextItem, Message, Node } from '../types/core'
import { generateAnalysis } from './analysisClient'
import { MissingSummariesError } from './errors'
import { calculateActivePath, getSceneNodesBeforeNode } from './nodeTraversal'
import { buildSmartContext } from './smartContext'
import { ChatMessage, getStoryInstructions } from './storyUtils'
import { selectActiveSegments } from './summarySegments'

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
    storySetting: _storySetting = '', // unused but kept for API compatibility
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
    // Bound the active-path walk at the node we're generating for. Branches that
    // sit *after* the current node in story order are not yet on any decided
    // path, but they must never truncate the active sets we use to gather the
    // history that PRECEDES the current node. Derive the boundary node from the
    // target message (the message we're inserting/regenerating at), falling back
    // to the last message that carries a sceneId — mirroring how currentNodeId is
    // resolved below. Without a boundary the walk reverts to the strict
    // abort-at-unselected-branch semantics, which is exactly the bug we're fixing.
    let boundaryNodeId = targetMessageId ? messages.find((m) => m.id === targetMessageId)?.sceneId : undefined
    if (!boundaryNodeId) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].sceneId) {
          boundaryNodeId = messages[i].sceneId
          break
        }
      }
    }
    const activePath = calculateActivePath(messages, nodes, branchChoices, boundaryNodeId)
    activeMessageIds = activePath.activeMessageIds
    activeNodeIds = activePath.activeNodeIds
    console.log('[generateContextMessages] Active path:', {
      activeMessages: activeMessageIds.size,
      activeNodes: activeNodeIds.size,
      boundaryNodeId,
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

  // Add minimal system message - same for all context types to preserve cache
  // Detailed instructions (story continuation vs query) are added near the end
  const systemContent =
    'You are an assistant helping with creative story writing. You can continue the narrative, refine existing content, or answer questions about the story.'
  chatMessages.push({ role: 'system', content: systemContent })

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

      // Add marked previous nodes — filtered by active branch path at both
      // node and message levels (sceneNodesBeforeCurrent is already filtered
      // by activeNodeIds; storyMessages is already filtered by activeMessageIds).
      //
      // Emit per-turn user/assistant pairs (so CYOA's alternating structure
      // is preserved across history, and so each turn is independently
      // cacheable up to the breakpoint at the end of this block).
      const markedHistoryStart = chatMessages.length
      for (const node of sceneNodesBeforeCurrent) {
        // Skip current node - handled separately below
        if (node.id === currentNodeId) continue
        if (node.includeInFull !== 1 && node.includeInFull !== 2) continue

        if (node.includeInFull === 1) {
          // Summary mode. If the scene has per-segment summaries (because it
          // contains branches), emit one assistant message per ACTIVE segment
          // — splitting along the branch path so we don't include summary
          // text from paths the reader never took. Fall back to the legacy
          // whole-scene `summary` field when no segments are stored.
          const segments = node.summarySegments
          if (segments && segments.length > 0) {
            // Reconstruct the scene's full ordered message list (segments are
            // anchored against all scene messages, not just active ones).
            const sceneMessagesForNode = messages.filter(
              (m) => m.sceneId === node.id && m.role === 'assistant' && m.type !== 'chapter' && !m.isQuery,
            )
            const activeSegments = selectActiveSegments(segments, sceneMessagesForNode, activeMessageIds)
            if (activeSegments.length === 0) continue
            console.log(
              '[generateContextMessages] Adding segmented summary for node:',
              node.title,
              '— segments:',
              activeSegments.length,
              '/',
              segments.length,
            )
            activeSegments.forEach((seg, idx) => {
              if (!seg.summary?.trim()) return
              chatMessages.push({
                role: 'assistant',
                content: idx === 0 ? `[Scene: ${node.title}]\n${seg.summary}` : seg.summary,
              })
            })
            continue
          }

          // Legacy path: single whole-scene summary.
          if (!node.summary?.trim()) continue
          console.log('[generateContextMessages] Adding summary for node:', node.title)
          chatMessages.push({
            role: 'assistant',
            content: `[Scene: ${node.title}]\n${node.summary}`,
          })
          continue
        }

        // includeInFull === 2: full content, per-turn splitting
        const nodeMessages = storyMessages.filter((msg) => msg.sceneId === node.id)
        if (nodeMessages.length === 0) continue
        console.log('[generateContextMessages] Adding full content for node:', node.title, '— turns:', nodeMessages.length)

        let isFirstAssistantInScene = true
        for (const msg of nodeMessages) {
          if (!msg.content?.trim()) continue

          // In CYOA mode, surface the player's instruction as its own user turn
          if (storyFormat === 'cyoa' && msg.instruction?.trim()) {
            chatMessages.push({
              role: 'user',
              content: msg.instruction,
            })
          }

          chatMessages.push({
            role: 'assistant',
            content: isFirstAssistantInScene
              ? `[Scene: ${node.title}]\n${msg.content}`
              : msg.content,
          })
          isFirstAssistantInScene = false
        }
      }

      // Single cache breakpoint at the boundary between marked history and
      // current scene. Marked history is stable across turns, so this gives
      // us one large cacheable prefix; the current scene gets its own
      // per-turn breakpoints below.
      if (isClaudeModel && chatMessages.length > markedHistoryStart) {
        const lastMarked = chatMessages[chatMessages.length - 1]
        lastMarked.cache_control = { type: 'ephemeral', ttl: '1h' }
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
      console.log('[generateContextMessages] No nodes available, using full message content')

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
        const content = msg.content

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
  // Only include queries that come AFTER the last story message to preserve temporal context
  if (contextType === 'query' && includeQueryHistory) {
    // Find the index of the last story message in the original array
    let lastStoryMessageIndex = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (!msg.isQuery && msg.role === 'assistant' && msg.type !== 'chapter') {
        lastStoryMessageIndex = i
        break
      }
    }

    // Only include queries that come after the last story message
    const queryMessages = messages.filter((msg, index) => {
      return msg.isQuery && msg.role === 'assistant' && index > lastStoryMessageIndex
    })
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
    // Add query instructions inline with the question
    const queryInstructions =
      'Answer the following question about the story. Provide a clear, concise answer about the story, its characters, plot, or any other aspect being asked about. Do not continue the story itself.'
    chatMessages.push({
      role: 'user',
      content: `${queryInstructions}\n\nQuestion: ${inputText}`,
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
