import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { settingsStore } from '../stores/settingsStore'
import { Message, Node } from '../types/core'
import { generateAnalysis } from '../utils/analysisClient'
import { generateNextStoryBeatInstructions } from '../utils/autoGeneration'
import { getCharacterDisplayName } from '../utils/character'
import { generateContextMessages } from '../utils/contextGeneration'
import { getTemplatedCharacterContext, getTemplatedContextItems } from '../utils/contextTemplating'
import { MissingSummariesError } from '../utils/errors'
import { generateMessageId } from '../utils/id'
import { saveMessageVersion } from '../utils/messageVersions'
import { analyzeStoryBeat, extractKnownEntities } from '../utils/smartContext'

interface UseStoryGenerationProps {
  generateResponse: (
    messages: any[],
    assistantMessageId: string,
    shouldSummarize: boolean,
    maxTokens?: number,
    isRegeneration?: boolean,
  ) => Promise<void>
  generateSummaries: (
    messageId: string,
    content: string,
  ) => Promise<{
    sentenceSummary: string
    summary: string
    paragraphSummary: string
  }>
}

export const useStoryGeneration = (props: UseStoryGenerationProps) => {
  // Flag to prevent multiple simultaneous regenerations
  let regenerateInProgress = false

  // Helper function to get the scene/chapter node from a message ID
  // Returns the node that the message belongs to (typically a scene node)
  const getSceneNodeForMessage = (messageId: string): Node | undefined => {
    const message = messagesStore.messages.find((m) => m.id === messageId)
    if (!message || !message.sceneId) return undefined

    const node = nodeStore.nodesArray.find((n) => n.id === message.sceneId)
    if (!node) return undefined

    return node
  }

  // Helper function to generate messages with context
  const generateMessagesWithContext = async (
    inputText: string,
    messages: Message[],
    targetMessageId: string,
    forceMissingSummaries = false,
  ) => {
    console.log('[generateMessagesWithContext] Starting context generation:', {
      inputText: inputText.substring(0, 50),
      messageCount: messages.length,
      targetMessageId,
      forceMissingSummaries,
    })
    // Generate templated context based on the target message
    const chapterNode = getSceneNodeForMessage(targetMessageId)
    const characterContext = getTemplatedCharacterContext(
      charactersStore.characters,
      messages,
      targetMessageId,
      nodeStore.nodesArray,
      chapterNode,
      currentStoryStore.globalScript,
    )
    const contextItemsContext = getTemplatedContextItems(
      contextItemsStore.contextItems,
      messages,
      targetMessageId,
      nodeStore.nodesArray,
      chapterNode,
      currentStoryStore.globalScript,
    )
    const fullContext = characterContext + contextItemsContext

    // For protagonist name, we need the evaluated version
    const evaluatedCharacters = charactersStore.characters
    const protagonist = evaluatedCharacters.find((c) => c.isMainCharacter)
    const protagonistName = protagonist ? getCharacterDisplayName(protagonist) : undefined

    // Determine viewpoint character name
    // If the chapter has a viewpoint character set, use that character's name
    // Otherwise, default to the protagonist
    let viewpointCharacterName: string | undefined
    if (chapterNode?.viewpointCharacterId) {
      const viewpointChar = evaluatedCharacters.find((c) => c.id === chapterNode.viewpointCharacterId)
      viewpointCharacterName = viewpointChar ? getCharacterDisplayName(viewpointChar) : undefined
    }
    // If no viewpoint character is set (or character not found), it will fall back to protagonist in getStoryPrompt

    try {
      console.log('[generateMessagesWithContext] Calling generateContextMessages with:', {
        contextType: settingsStore.useSmartContext ? 'smart-story' : 'story',
        hasCharacterContext: fullContext.length > 0,
        charactersCount: charactersStore.characters.length,
        contextItemsCount: contextItemsStore.contextItems.length,
        viewpointCharacterName,
        protagonistName,
        forceMissingSummaries,
      })

      const result = await generateContextMessages({
        inputText,
        messages,
        contextType: settingsStore.useSmartContext ? 'smart-story' : 'story',
        storySetting: currentStoryStore.storySetting,
        storyFormat: currentStoryStore.storyFormat,
        person: currentStoryStore.person,
        tense: currentStoryStore.tense,
        protagonistName,
        viewpointCharacterName,
        paragraphsPerTurn: currentStoryStore.paragraphsPerTurn,
        characterContext: fullContext,
        characters: charactersStore.characters,
        contextItems: contextItemsStore.contextItems,
        // Pass nodes for context generation
        // Each node has a summary field that should be used
        nodes: nodeStore.nodesArray,
        branchChoices: currentStoryStore.branchChoices,
        targetMessageId,
        model: settingsStore.model,
        provider: settingsStore.provider as 'ollama' | 'openrouter' | 'anthropic',
        forceMissingSummaries,
      })

      console.log('[generateMessagesWithContext] Context generation successful, message count:', result.length)
      return result
    } catch (error) {
      console.error('[generateMessagesWithContext] Context generation failed:', error)
      // Don't show alert here - let the calling function handle the error
      // This prevents showing two dialogs when chapters are missing summaries
      throw error
    }
  }

  const handleAutoOrManualSubmit = async (isQuery = false, maxTokens?: number) => {
    // Check if model is selected before proceeding
    if (!settingsStore.model) {
      const { errorStore } = await import('../stores/errorStore')
      errorStore.addError('Please select a model before generating content', 'error')
      return
    }

    if (settingsStore.autoGenerate && !messagesStore.input.trim() && !isQuery) {
      try {
        // Generating auto-instructions
        const autoInstructions = await generateNextStoryBeatInstructions(
          generateAnalysis,
          currentStoryStore.paragraphsPerTurn,
        )
        // Generated auto-instructions

        messagesStore.setInput(autoInstructions)
        await handleSubmit(false, maxTokens, true)
      } catch (error) {
        console.error('Failed to generate auto-instructions:', error)
      }
    } else {
      await handleSubmit(isQuery, maxTokens, true)
    }
  }

  const handleSubmit = async (isQuery = false, maxTokens?: number, clearInputAfter = true) => {
    const inputText = messagesStore.input.trim()
    if (!inputText || messagesStore.isLoading) return

    // Check if model is selected
    if (!settingsStore.model) {
      const { errorStore } = await import('../stores/errorStore')
      errorStore.addError('Please select a model before generating content', 'error')
      return
    }

    messagesStore.setIsLoading(true)

    if (isQuery) {
      const assistantMessageId = generateMessageId()
      const selectedNodeId = nodeStore.selectedNodeId
      const selectedChapterId = nodeStore.selectedNodeId // Using node ID as chapter ID
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        instruction: inputText,
        timestamp: new Date(),
        order: 0, // Will be set properly by insertMessage/addMessage
        isQuery: true,
        model: settingsStore.model,
        sceneId: selectedNodeId || messagesStore.getCurrentNodeId() || undefined,
      }

      // Insert query at the end of selected node
      if (selectedNodeId) {
        const insertAfterId = messagesStore.getInsertAfterIdForNode(selectedNodeId)
        if (insertAfterId) {
          messagesStore.insertMessage(insertAfterId, assistantMessage)
        } else {
          // Fallback: add to end if we can't find the node
          messagesStore.appendMessage(assistantMessage)
        }
      } else {
        // No node selected, add to end
        messagesStore.appendMessage(assistantMessage)
      }

      try {
        // Get messages up to where we just inserted the query
        let messagesForContext: Message[]
        if (selectedChapterId) {
          const insertedMessageIndex = messagesStore.messages.findIndex((m) => m.id === assistantMessageId)
          if (insertedMessageIndex !== -1) {
            messagesForContext = messagesStore.messages.slice(0, insertedMessageIndex + 1)
          } else {
            messagesForContext = messagesStore.visibleMessages
          }
        } else {
          messagesForContext = messagesStore.visibleMessages
        }

        // Use messages up to insertion point for script execution
        const chapterNode = getSceneNodeForMessage(assistantMessageId)
        const characterContext = getTemplatedCharacterContext(
          charactersStore.characters,
          messagesForContext,
          assistantMessageId,
          nodeStore.nodesArray,
          chapterNode,
          currentStoryStore.globalScript,
        )
        const contextItemsContext = getTemplatedContextItems(
          contextItemsStore.contextItems,
          messagesForContext,
          assistantMessageId,
          nodeStore.nodesArray,
          chapterNode,
          currentStoryStore.globalScript,
        )
        const queryMessages = await generateContextMessages({
          inputText,
          messages: messagesForContext,
          contextType: 'query',
          characterContext: characterContext + contextItemsContext,
          model: settingsStore.model,
          nodes: nodeStore.nodesArray,
          branchChoices: currentStoryStore.branchChoices,
          targetMessageId: assistantMessageId,
          includeQueryHistory: true,
          maxQueryHistory: 5,
        })

        await props.generateResponse(queryMessages, assistantMessageId, false, maxTokens)
      } catch (error) {
        console.error('Query generation failed:', error)
        messagesStore.clearAssistantContent(assistantMessageId)
        const { errorStore } = await import('../stores/errorStore')
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errorStore.addError(`Failed to generate query: ${errorMessage}`, 'error')
      }
    } else {
      const assistantMessageId = generateMessageId()
      const selectedNodeId = nodeStore.selectedNodeId
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        instruction: inputText,
        timestamp: new Date(),
        order: 0, // Will be set properly by insertMessage/addMessage
        isQuery: false,
        model: settingsStore.model,
        sceneId: selectedNodeId || messagesStore.getCurrentNodeId() || undefined,
      }
      // If a node is selected, insert at the end of that node
      if (selectedNodeId) {
        const insertAfterId = messagesStore.getInsertAfterIdForNode(selectedNodeId)
        if (insertAfterId) {
          messagesStore.insertMessage(insertAfterId, assistantMessage)
        } else {
          // Fallback: add to end if we can't find the node
          messagesStore.appendMessage(assistantMessage)
        }
      } else {
        // No node selected, add to end
        messagesStore.appendMessage(assistantMessage)
      }

      try {
        // Get messages up to where we just inserted the new message
        let messagesForContext: Message[]
        if (selectedNodeId) {
          // We just inserted at the end of the selected node
          const insertedMessageIndex = messagesStore.messages.findIndex((m) => m.id === assistantMessageId)
          if (insertedMessageIndex !== -1) {
            messagesForContext = messagesStore.messages.slice(0, insertedMessageIndex + 1).filter((m) => !m.isQuery)
          } else {
            // Fallback
            messagesForContext = messagesStore.visibleMessages.filter((m) => !m.isQuery)
          }
        } else {
          // No node selected, message was added at the end
          messagesForContext = messagesStore.visibleMessages.filter((m) => !m.isQuery)
        }

        console.log('[handleSubmit] Generating context for story message')
        const messages = await generateMessagesWithContext(inputText, messagesForContext, assistantMessageId)
        console.log('[handleSubmit] Context generated, starting generation')
        await props.generateResponse(messages, assistantMessageId, true, maxTokens)
      } catch (error: any) {
        console.error('[handleSubmit] Story generation failed:', error)
        console.error('[handleSubmit] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        })

        // Handle missing chapter/scene summaries with a confirmation dialog
        if (error instanceof MissingSummariesError) {
          console.warn('[handleSubmit] Missing scene summaries detected:', error.missingNodeTitles)
          const proceed = confirm(
            `${error.message}\n\nDo you want to continue anyway? The story might lack important context from previous scenes.`,
          )

          if (proceed) {
            try {
              console.log('[handleSubmit] User chose to continue without summaries')
              // Generate with forceMissingSummaries flag
              const messages = await generateMessagesWithContext(
                inputText,
                messagesStore.visibleMessages.filter((m) => !m.isQuery),
                assistantMessageId,
                true, // forceMissingSummaries flag
              )
              await props.generateResponse(messages, assistantMessageId, true, maxTokens)
            } catch (retryError) {
              console.error('Story generation failed on retry:', retryError)
              messagesStore.clearAssistantContent(assistantMessageId)
              const { errorStore } = await import('../stores/errorStore')
              const errorMessage = retryError instanceof Error ? retryError.message : 'Unknown error'
              errorStore.addError(`Failed to generate story: ${errorMessage}`, 'error')
            }
          } else {
            messagesStore.clearAssistantContent(assistantMessageId)
          }
        } else {
          messagesStore.clearAssistantContent(assistantMessageId)
          const { errorStore } = await import('../stores/errorStore')
          const errorMessage = error.message || 'Unknown error'
          errorStore.addError(`Failed to generate story: ${errorMessage}`, 'error')
        }
      }
    }

    if (clearInputAfter) {
      messagesStore.clearInput()
    }
    messagesStore.setIsLoading(false)
  }

  const regenerateLastMessage = async (maxTokens?: number) => {
    // regenerateLastMessage called

    if (regenerateInProgress) {
      // Regeneration already in progress
      return
    }

    if (messagesStore.isLoading) {
      // Already loading, skipping regenerate
      return
    }

    const messages = messagesStore.messages
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || !lastMessage.instruction) {
      // No last message or instruction to regenerate
      return
    }

    try {
      regenerateInProgress = true
      // Regenerating message
      const instruction = lastMessage.instruction
      const isQuery = lastMessage.isQuery || false

      // Save the current version before regenerating
      await saveMessageVersion(
        lastMessage.id,
        lastMessage.content,
        lastMessage.instruction,
        lastMessage.model,
        'regeneration',
      )

      // Import batch from solid-js to batch updates
      const { batch } = await import('solid-js')

      // Batch all store updates together to prevent multiple reactive updates
      batch(() => {
        // Delete the message first
        messagesStore.deleteMessage(lastMessage.id)

        // Set the input after deletion
        messagesStore.setInput(instruction)
      })

      // Submit the regeneration after the batch completes
      await handleSubmit(isQuery, maxTokens, false)
    } finally {
      regenerateInProgress = false
    }
  }

  const handleRegenerateFromMessage = async (messageId: string, content: string, maxTokens?: number) => {
    const message = messagesStore.messages.find((m) => m.id === messageId)
    if (!message) return

    // Save the current version before regenerating
    await saveMessageVersion(messageId, message.content, message.instruction, message.model, 'regeneration')

    messagesStore.setIsLoading(true)
    messagesStore.updateMessage(messageId, { content: '', paragraphs: [] })

    try {
      // Find the index of the message being regenerated
      const messageIndex = messagesStore.messages.findIndex((m) => m.id === messageId)
      if (messageIndex === -1) throw new Error('Message not found')

      // Include messages up to and including the one being regenerated
      // The regenerated message should have empty content at this point
      const messagesUpToTarget = messagesStore.messages.slice(0, messageIndex + 1)
      const messages = await generateMessagesWithContext(
        content,
        messagesUpToTarget.filter((m) => !m.isQuery),
        messageId,
      )

      // Regenerate the response for this specific message
      await props.generateResponse(messages, messageId, !message.isQuery, maxTokens, true)
    } catch (error: any) {
      console.error('Regeneration failed:', error)

      // Handle missing chapter/scene summaries with a confirmation dialog
      if (error instanceof MissingSummariesError) {
        const proceed = confirm(
          `${error.message}\n\nDo you want to continue anyway? The story might lack important context from previous scenes.`,
        )

        if (proceed) {
          try {
            // Find the index of the message being regenerated
            const messageIndex = messagesStore.messages.findIndex((m) => m.id === messageId)
            if (messageIndex === -1) throw new Error('Message not found')

            // Include messages up to and including the one being regenerated
            const messagesUpToTarget = messagesStore.messages.slice(0, messageIndex + 1)
            const messages = await generateMessagesWithContext(
              content,
              messagesUpToTarget.filter((m) => !m.isQuery),
              messageId,
              true, // forceMissingSummaries flag
            )

            // Regenerate the response for this specific message
            await props.generateResponse(messages, messageId, !message.isQuery, maxTokens, true)
          } catch (retryError) {
            console.error('Regeneration failed on retry:', retryError)
            const { errorStore } = await import('../stores/errorStore')
            const errorMessage = retryError instanceof Error ? retryError.message : 'Unknown error'
            errorStore.addError(`Failed to regenerate message: ${errorMessage}`, 'error')
          }
        }
      } else {
        const { errorStore } = await import('../stores/errorStore')
        const errorMessage = error.message || 'Unknown error'
        errorStore.addError(`Failed to regenerate message: ${errorMessage}`, 'error')
      }
    }

    messagesStore.setIsLoading(false)
  }

  const handleRegenerateQuery = async (messageId: string, queryText: string, maxTokens?: number) => {
    const message = messagesStore.messages.find((m) => m.id === messageId)
    if (!message || !message.isQuery) return

    messagesStore.setIsLoading(true)
    messagesStore.updateMessage(messageId, { content: '', paragraphs: [] })

    try {
      // Find the index of the query being regenerated
      const messageIndex = messagesStore.messages.findIndex((m) => m.id === messageId)
      if (messageIndex === -1) throw new Error('Query message not found')

      // For queries, we need messages up to this query to include previous Q&As
      const messagesUpToTarget = messagesStore.messages.slice(0, messageIndex + 1)
      const allMessages = messagesUpToTarget
      // But for character/context templating, we only use story messages
      const storyMessages = allMessages.filter((m) => !m.isQuery && m.role === 'assistant')
      const chapterNode = getSceneNodeForMessage(messageId)
      const characterContext = getTemplatedCharacterContext(
        charactersStore.characters,
        storyMessages,
        messageId,
        nodeStore.nodesArray,
        chapterNode,
        currentStoryStore.globalScript,
      )
      const contextItemsContext = getTemplatedContextItems(
        contextItemsStore.contextItems,
        storyMessages,
        messageId,
        nodeStore.nodesArray,
        chapterNode,
        currentStoryStore.globalScript,
      )
      const queryMessages = await generateContextMessages({
        inputText: queryText,
        messages: allMessages,
        contextType: 'query',
        characterContext: characterContext + contextItemsContext,
        model: settingsStore.model,
        nodes: nodeStore.nodesArray,
        branchChoices: currentStoryStore.branchChoices,
        targetMessageId: messageId,
        includeQueryHistory: true,
        maxQueryHistory: 5,
      })

      await props.generateResponse(queryMessages, messageId, false, maxTokens, true)
    } catch (error) {
      console.error('Query regeneration failed:', error)
      const { errorStore } = await import('../stores/errorStore')
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errorStore.addError(`Failed to regenerate query: ${errorMessage}`, 'error')
    }

    messagesStore.setIsLoading(false)
  }

  const handleSummarizeMessage = async (messageId: string) => {
    const message = messagesStore.messages.find((m) => m.id === messageId)
    if (!message) return

    messagesStore.setSummarizing(messageId, true)

    try {
      const { sentenceSummary, summary, paragraphSummary } = await props.generateSummaries(message.id, message.content)

      messagesStore.updateMessage(messageId, {
        sentenceSummary,
        summary,
        paragraphSummary,
        isExpanded: true, // Keep showing full content after summaries are generated
      })
    } catch (error) {
      console.error('Summarization failed:', error)
    }

    messagesStore.setSummarizing(messageId, false)
  }

  const handleAnalyzeMessage = async (messageId: string) => {
    const message = messagesStore.messages.find((m) => m.id === messageId)
    if (!message) return

    messagesStore.setAnalyzing(messageId, true)

    try {
      const entities = extractKnownEntities(charactersStore.characters, contextItemsStore.contextItems)

      const analysis = await analyzeStoryBeat(message, entities, generateAnalysis)

      messagesStore.updateMessage(messageId, { sceneAnalysis: analysis })

      // TODO: Add smartEntityDetection to settingsStore if needed
      // if (settingsStore.smartEntityDetection) {
      //   const newEntities = await detectNewEntities(
      //     message.content,
      //     entities.knownCharacters,
      //     entities.knownLocations,
      //     entities.knownThemes,
      //     generateAnalysis
      //   )
      //
      //   if ((newEntities.characters.length > 0 || newEntities.locations.length > 0 || newEntities.themes.length > 0)) {
      //     const descriptions = await generateEntityDescriptions(
      //       newEntities,
      //       messagesStore.getStoryContext(),
      //       generateAnalysis
      //     )
      //
      //     addDiscoveredEntitiesToStores(newEntities, descriptions)
      //   }
      // }
    } catch (error) {
      console.error('Analysis failed:', error)
    }

    messagesStore.setAnalyzing(messageId, false)
  }

  const handleShowContextPreview = async () => {
    console.log('[useStoryGeneration] handleShowContextPreview started')
    const inputText = messagesStore.input.trim() || '[Empty input]'
    console.log('[useStoryGeneration] Input text:', inputText.substring(0, 50))

    try {
      console.log('[useStoryGeneration] Getting selected node and chapter...')
      const selectedNodeId = nodeStore.selectedNodeId
      const selectedChapterId = nodeStore.selectedNodeId // Using node ID as chapter ID
      const visibleMessages = messagesStore.getVisibleMessages()
      console.log(
        '[useStoryGeneration] Selected node:',
        selectedNodeId,
        'Chapter:',
        selectedChapterId,
        'Messages:',
        visibleMessages.length,
      )

      // Only include messages up to the selected node
      let messagesUpToChapter: Message[]
      let targetMessageId: string

      if (selectedNodeId) {
        // Find where the new message would be inserted based on node
        const insertAfterId = messagesStore.getInsertAfterIdForNode(selectedNodeId)
        if (insertAfterId) {
          // Find the index of this message
          const insertAfterIndex = visibleMessages.findIndex((m) => m.id === insertAfterId)
          if (insertAfterIndex !== -1) {
            // Include all messages up to and including the insertion point
            messagesUpToChapter = visibleMessages.slice(0, insertAfterIndex + 1).filter((m) => !m.isQuery)
            targetMessageId = insertAfterId
          } else {
            // Fallback to all messages if we can't find the insertion point
            messagesUpToChapter = visibleMessages.filter((m) => !m.isQuery)
            targetMessageId = messagesUpToChapter[messagesUpToChapter.length - 1]?.id || ''
          }
        } else {
          // No insertion point found for this node - use all messages
          messagesUpToChapter = visibleMessages.filter((m) => !m.isQuery)
          targetMessageId = messagesUpToChapter[messagesUpToChapter.length - 1]?.id || ''
        }
      } else {
        // No node selected, use all messages
        messagesUpToChapter = visibleMessages.filter((m) => !m.isQuery)
        targetMessageId = messagesUpToChapter[messagesUpToChapter.length - 1]?.id || ''
      }

      // Make sure we have at least one message to use as target
      if (!targetMessageId || messagesUpToChapter.length === 0) {
        console.error('[handleShowContextPreview] No messages found for context preview')
        const { errorStore } = await import('../stores/errorStore')
        errorStore.addError('No messages found to generate context preview', 'error')
        return null
      }

      console.log('[handleShowContextPreview] Generating preview context:', {
        inputText: inputText.substring(0, 50),
        messagesCount: messagesUpToChapter.length,
        selectedNodeId,
        targetMessageId,
        selectedChapterId,
      })

      console.log('[useStoryGeneration] Calling generateMessagesWithContext...')
      const messages = await generateMessagesWithContext(
        inputText,
        messagesUpToChapter,
        targetMessageId,
        true, // Force missing summaries for preview (same as when user clicks "Yes" on warning)
      )
      console.log('[useStoryGeneration] generateMessagesWithContext completed')

      console.log('[handleShowContextPreview] Preview context generated:', {
        messageCount: messages.length,
        totalLength: messages.reduce((sum, m) => sum + (m.content?.length || 0), 0),
      })

      // Filter out any message that might contain our preview instruction
      const filteredMessages = messages.filter((msg) => !(msg.role === 'user' && msg.content === inputText))

      // Check total size before returning
      let totalSize = 0
      const limitedMessages = []

      for (const msg of filteredMessages) {
        const msgSize = msg.content?.length || 0
        if (totalSize + msgSize > 5000000) {
          // 5MB limit for preview
          console.warn('[useStoryGeneration] Stopping at', limitedMessages.length, 'messages due to size limit')
          break
        }
        totalSize += msgSize
        limitedMessages.push({
          role: msg.role,
          content: msg.content,
          cache_control: msg.cache_control,
        })
      }

      const result = {
        type: settingsStore.useSmartContext ? 'Smart Context' : 'Full History',
        messages: limitedMessages,
      }
      console.log(
        '[useStoryGeneration] Returning preview result with',
        result.messages.length,
        'messages, total size:',
        totalSize,
        'bytes',
      )
      return result
    } catch (error) {
      console.error('[handleShowContextPreview] Failed to generate context preview:', error)
      console.error('[handleShowContextPreview] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      })
      // Show the error to the user
      const { errorStore } = await import('../stores/errorStore')
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errorStore.addError(`Failed to generate context preview: ${errorMessage}`, 'error')
      return null
    }
  }

  return {
    generateMessagesWithContext,
    handleAutoOrManualSubmit,
    handleSubmit,
    regenerateLastMessage,
    handleRegenerateFromMessage,
    handleRegenerateQuery,
    handleSummarizeMessage,
    handleAnalyzeMessage,
    handleShowContextPreview,
  }
}
