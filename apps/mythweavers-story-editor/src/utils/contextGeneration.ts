import { Chapter, Character, ContextItem, Message, Node } from '../types/core'
import { generateAnalysis } from './analysisClient'
import { calculateActivePath, getSceneNodesBeforeNode } from './nodeTraversal'
import { buildSmartContext } from './smartContext'
import { ChatMessage } from './storyUtils'
import { getStoryPrompt } from './storyUtils'

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

  // Chapter/Node handling
  chapters?: Chapter[]
  nodes?: Node[] // New node-based system
  targetMessageId?: string // For determining current chapter/node

  // Branch handling
  branchChoices?: Record<string, string> // branchMessageId -> selectedOptionId

  // Model info
  model?: string
  provider?: 'ollama' | 'openrouter' | 'anthropic'

  // Advanced options
  includeQueryHistory?: boolean // For query contexts
  maxQueryHistory?: number // Default: 5
  forceMissingSummaries?: boolean // Force generation even if chapter summaries are missing
}

/**
 * Get the actual chapter order from the messages array
 * Note: Chapter markers no longer exist - chapters are managed through the node system
 */
function getChapterOrder(messages: Message[]): string[] {
  // This function is now mostly obsolete since chapters are managed through nodes
  // We can still try to extract order from messages with chapterId, but this is legacy
  const chapterOrder: string[] = []
  const seenChapters = new Set<string>()

  for (const msg of messages.filter((msg) => !msg.isQuery)) {
    if (msg.sceneId && !seenChapters.has(msg.sceneId)) {
      chapterOrder.push(msg.sceneId)
      seenChapters.add(msg.sceneId)
    }
  }

  return chapterOrder
}

/**
 * Get previous chapters in story order for a given current chapter
 */
function getPreviousChapters(
  currentChapterId: string,
  messages: Message[],
  chapters: Chapter[],
): { chapters: Chapter[]; chapterOrder: string[]; currentIndex: number } {
  const chapterOrder = getChapterOrder(messages)
  const currentIndex = chapterOrder.indexOf(currentChapterId)

  if (currentIndex === -1) {
    console.error(
      `[getPreviousChapters] Current chapter ${currentChapterId} not found in chapter markers. Chapter order:`,
      chapterOrder,
    )
    return { chapters: [], chapterOrder, currentIndex: -1 }
  }

  const previousChapterIds = chapterOrder.slice(0, currentIndex)
  const previousChapters = chapters.filter((ch) => previousChapterIds.includes(ch.id))

  return { chapters: previousChapters, chapterOrder, currentIndex }
}

/**
 * Add chapter summaries to the context in story order
 * If a chapter has includeInFull set to 2, include all messages instead of summary
 * If set to 0, skip the chapter entirely
 */
function addChapterSummaries(
  chatMessages: ChatMessage[],
  previousChapters: Chapter[],
  chapterOrder: string[],
  currentIndex: number,
  allMessages?: Message[], // Need all messages to get full chapter content
): void {
  // Add summaries or full content in story order
  for (const chapterId of chapterOrder.slice(0, currentIndex)) {
    const chapter = previousChapters.find((ch) => ch.id === chapterId)
    if (!chapter) continue

    // If includeInFull is 0, skip this chapter entirely
    if (chapter.includeInFull === 0) continue

    // If includeInFull is 2 and we have messages, include full chapter content
    if (chapter.includeInFull === 2 && allMessages) {
      // Get all messages for this chapter
      const chapterMessages = allMessages.filter(
        (msg) => msg.sceneId === chapterId && msg.role === 'assistant' && msg.type !== 'chapter' && !msg.isQuery,
      )

      if (chapterMessages.length > 0) {
        // Add chapter marker
        chatMessages.push({
          role: 'assistant',
          content: `[Chapter: ${chapter.title} - Full Content]`,
        })

        // Add all chapter messages
        for (const msg of chapterMessages) {
          chatMessages.push({
            role: 'assistant',
            content: msg.content,
          })
        }
      } else if (chapter.summary) {
        // Fall back to summary if no messages found
        chatMessages.push({
          role: 'assistant',
          content: `[Chapter: ${chapter.title}]\n${chapter.summary}`,
        })
      }
    } else if (chapter.summary) {
      // Use summary as normal
      chatMessages.push({
        role: 'assistant',
        content: `[Chapter: ${chapter.title}]\n${chapter.summary}`,
      })
    }
  }
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
    hasChapters: !!options.chapters?.length,
    targetMessageId: options.targetMessageId,
    forceMissingSummaries: options.forceMissingSummaries,
  })
  console.log('[generateContextMessages] Starting with options:', {
    contextType: options.contextType,
    messageCount: options.messages.length,
    hasChapters: (options.chapters?.length || 0) > 0,
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
    chapters = [],
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

  // Add system message based on context type
  if (contextType === 'query') {
    const systemContent =
      'You are a helpful assistant answering questions about a story in progress. Provide clear, concise answers about the story, its characters, plot, or any other aspect the user is asking about. Do not continue the story itself.'
    chatMessages.push({ role: 'system', content: systemContent })
  } else {
    // Story or smart-story context
    const isNewStory = storyMessages.length === 0
    const systemContent = getStoryPrompt(
      storySetting,
      person,
      tense,
      protagonistName,
      isNewStory,
      viewpointCharacterName,
      sceneGoal,
      storyFormat,
    )
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
        chapters,
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

      // Include current node if it's a scene (for full message inclusion)
      // Always include current node even if it's not in activeNodeIds (e.g., empty scene)
      const sceneNodes =
        currentNode?.type === 'scene' ? [...sceneNodesBeforeCurrent, currentNode] : sceneNodesBeforeCurrent

      console.log(
        '[generateContextMessages] Found',
        sceneNodes.length,
        'scene nodes in story order before/including current',
      )

      // Check nodes that come BEFORE current for missing summaries
      const nodesWithoutSummaries: string[] = []
      for (const node of sceneNodesBeforeCurrent) {
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
        const missingNodeTitles = nodesWithoutSummaries.join(', ')
        const errorMsg = `Cannot generate story continuation. The following previous scenes need summaries first: ${missingNodeTitles}`
        console.error('[generateContextMessages] Nodes missing summaries:', nodesWithoutSummaries)
        throw new Error(errorMsg)
      }

      // Add node summaries for all previous scenes
      for (const node of sceneNodes) {
        if (node.id === currentNodeId) {
          // Current node - add full messages
          console.log('[generateContextMessages] Adding full messages for current node:', node.title)
          const nodeMessages = storyMessages.filter((msg) => msg.sceneId === node.id)
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
        } else if (node.includeInFull === 0) {
          // Node explicitly excluded from context
          console.log('[generateContextMessages] Skipping node (includeInFull=0):', node.title)
        } else if (node.includeInFull === 2) {
          // Previous node marked for full inclusion - add all messages
          console.log('[generateContextMessages] Adding full messages for node (includeInFull=2):', node.title)
          const nodeMessages = storyMessages.filter((msg) => msg.sceneId === node.id)

          // Add a scene header first
          if (nodeMessages.length > 0) {
            chatMessages.push({
              role: 'assistant',
              content: `[Scene: ${node.title}]`,
            })

            // Then add all the messages
            nodeMessages.forEach((msg) => {
              if (msg.content?.trim()) {
                // In CYOA mode, add user instruction as a separate message before the assistant response
                if (storyFormat === 'cyoa' && msg.instruction?.trim()) {
                  chatMessages.push({
                    role: 'user',
                    content: msg.instruction,
                  })
                }

                chatMessages.push({
                  role: 'assistant',
                  content: msg.content,
                })
              }
            })
          }
        } else if (node.summary && node.includeInFull === 1) {
          // Previous node - add summary only (default behavior)
          console.log('[generateContextMessages] Adding summary for node (includeInFull=1):', node.title)
          chatMessages.push({
            role: 'assistant',
            content: `[Scene: ${node.title}]\n${node.summary}`,
          })
        }
      }
    } else {
      // Fall back to chapter-based or no-chapter logic
      let currentChapterId: string | undefined

      console.log('[generateContextMessages] Traditional context generation, chapters:', chapters.length)

      if (chapters.length > 0) {
        if (targetMessageId) {
          const targetMessage = messages.find((msg) => msg.id === targetMessageId)
          currentChapterId = targetMessage?.sceneId
          console.log('[generateContextMessages] Current chapter from target message:', currentChapterId)
        } else {
          // Find from the last story message
          for (let i = storyMessages.length - 1; i >= 0; i--) {
            if (storyMessages[i].sceneId) {
              currentChapterId = storyMessages[i].sceneId
              console.log('[generateContextMessages] Current chapter from last story message:', currentChapterId)
              break
            }
          }
        }
      }

      // Handle chapter-based context
      if (chapters.length > 0 && currentChapterId) {
        console.log('[generateContextMessages] Using chapter-based context for chapter:', currentChapterId)
        const {
          chapters: previousChapters,
          chapterOrder,
          currentIndex,
        } = getPreviousChapters(currentChapterId, messages, chapters)

        console.log('[generateContextMessages] Chapter context:', {
          previousChaptersCount: previousChapters.length,
          chapterOrder,
          currentIndex,
          currentChapterId,
        })

        // Check if previous chapters have summaries (for story context only)
        if (contextType === 'story') {
          const chaptersWithContent = previousChapters.filter((chapter) => {
            const chapterMessages = storyMessages.filter(
              (msg) => msg.sceneId === chapter.id && msg.type !== 'chapter' && !msg.isQuery,
            )
            return chapterMessages.length > 0
          })

          const chaptersWithoutSummaries = chaptersWithContent.filter((ch) => !ch.summary)
          console.log('[generateContextMessages] Chapter summary check:', {
            chaptersWithContent: chaptersWithContent.length,
            chaptersWithoutSummaries: chaptersWithoutSummaries.length,
            forceMissingSummaries: options.forceMissingSummaries,
          })

          if (chaptersWithoutSummaries.length > 0 && !options.forceMissingSummaries) {
            const missingChapterTitles = chaptersWithoutSummaries.map((ch) => ch.title).join(', ')
            const errorMsg = `Cannot generate story continuation. The following previous chapters need summaries first: ${missingChapterTitles}`
            console.error('[generateContextMessages] Missing summaries error:', errorMsg)
            throw new Error(errorMsg)
          }
        }

        // Add chapter summaries or full content based on includeInFull setting (0=skip, 1=summary, 2=full)
        addChapterSummaries(chatMessages, previousChapters, chapterOrder, currentIndex, messages)

        // Filter messages to current chapter
        const currentChapterMessages = storyMessages.filter((msg) => msg.sceneId === currentChapterId)
        console.log('[generateContextMessages] Current chapter messages:', currentChapterMessages.length)

        // Add current chapter messages with summarization
        currentChapterMessages.forEach((msg, index) => {
          // Current chapter messages should use full content for Claude
          const content = applySummarization(
            msg,
            index + 1,
            currentChapterMessages.length,
            isClaudeModel || false,
            true,
          )

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
            if (isClaudeModel && index > currentChapterMessages.length - 4) {
              message.cache_control = { type: 'ephemeral', ttl: '1h' }
            }

            chatMessages.push(message)
          }
        })
      } else {
        console.log('[generateContextMessages] No chapters or current chapter not found, using all messages')
        // No chapters or current chapter not found - include all story messages
        console.log('[generateContextMessages] No chapters or current chapter not found, using all messages')

        // Check if we have too many messages without chapters
        if (storyMessages.length > 50 && !options.forceMissingSummaries) {
          console.warn(
            '[generateContextMessages] Too many messages without chapter organization:',
            storyMessages.length,
          )
          // For Claude models, this would mean loading all messages with full content
          if (isClaudeModel) {
            const errorMsg = `Story has ${storyMessages.length} messages without chapter organization. Please organize into chapters with summaries before continuing.`
            console.error(`[generateContextMessages] ${errorMsg}`)
            throw new Error(errorMsg)
          }
        }

        storyMessages.forEach((msg, index) => {
          // When no chapters exist, don't treat messages as current chapter
          // This prevents loading 800+ messages with full content
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
      } // End of else block (no chapters found)
    } // End of else block (using chapter-based instead of node-based)
  }

  // Add character context if provided
  const fullContext = (characterContext || '').trim()
  if (fullContext) {
    chatMessages.push({
      role: 'user',
      content: `Active story context:\n${fullContext}`,
      cache_control: isClaudeModel ? { type: 'ephemeral', ttl: '1h' } : undefined,
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

  // Add the final user message
  if (contextType === 'query') {
    chatMessages.push({
      role: 'user',
      content: `Question: ${inputText}`,
    })
  } else if (storyFormat === 'cyoa') {
    // CYOA mode: user input is their choice, not a meta-instruction
    chatMessages.push({
      role: 'user',
      content: inputText,
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
