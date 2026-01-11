import { cacheStore } from '../stores/cacheStore'
import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { modelsStore } from '../stores/modelsStore'
import { nodeStore } from '../stores/nodeStore'
import { settingsStore } from '../stores/settingsStore'
import type { Character, Node } from '../types/core'
import { LLMClient, LLMMessage, convertToTokenUsage } from '../types/llm'
import { generateAnalysis } from '../utils/analysisClient'
import { generateNextStoryBeatInstructions, isStoryReadyForGeneration } from '../utils/autoGeneration'
import { getCharacterDisplayName } from '../utils/character'
import { evaluateCharacterTemplates, getTemplatedActiveCharacters } from '../utils/contextTemplating'
import { LLMClientFactory } from '../utils/llm'
import {
  analyzeStoryBeat,
  detectNewEntities,
  extractKnownEntities,
  generateEntityDescriptions,
} from '../utils/smartContext'
import {
  getParagraphSummarizationPrompt,
  getSentenceSummarizationPrompt,
  getSummarizationPrompt,
} from '../utils/storyUtils'
import { refineClichés } from '../utils/clicheRefinement'
import { getContextNodesFingerprint } from '../utils/storyFingerprint'

export const useOllama = () => {
  let currentAbortController: AbortController | null = null

  // Cache clients to avoid recreating them on every call
  let cachedClient: LLMClient | null = null
  let cachedProvider: string | null = null

  const getClient = (): LLMClient => {
    // Return cached client if provider hasn't changed
    if (cachedClient && cachedProvider === settingsStore.provider) {
      return cachedClient
    }

    // Getting client for provider
    cachedClient = LLMClientFactory.getClient(settingsStore.provider)
    cachedProvider = settingsStore.provider
    return cachedClient
  }

  // Get the effective context size (minimum of user setting and model's actual context length)
  const getEffectiveContextSize = (): number => {
    const selectedModel = modelsStore.availableModels.find((m: any) => m.name === settingsStore.model)
    if (selectedModel?.context_length) {
      return Math.min(settingsStore.contextSize, selectedModel.context_length)
    }
    return settingsStore.contextSize
  }

  // Ping cache is no longer needed with 1-hour TTL
  const pingCache = async () => {
    // Cache ping no longer needed - using 1-hour TTL
  }

  // Extract think tags from content and return cleaned content + think content
  const extractThinkTags = (content: string): { cleanedContent: string; thinkContent: string | undefined } => {
    const thinkRegex = /<think>([\s\S]*?)<\/think>/gi
    const matches = Array.from(content.matchAll(thinkRegex))

    // Extract all think content
    const thinkContent = matches.length > 0 ? matches.map((match) => match[1].trim()).join('\n\n') : undefined

    // Remove think tags and their content from the main content
    let cleanedContent = content.replace(thinkRegex, '').trim()

    // Clean up unwanted system tags (but keep orphaned think tags visible)
    cleanedContent = cleanedContent
      .replace(/<\/s>/g, '')
      .replace(/<\|im_end\|>/g, '')
      .replace(/<\|im_start\|>/g, '')
      // Clean up multiple consecutive newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return {
      cleanedContent,
      thinkContent,
    }
  }

  const generateStoryName = async (content: string): Promise<string> => {
    const client = getClient()
    let name = ''

    try {
      const prompt = `Based on this story opening, generate a short, evocative title (2-5 words) that captures the essence of the story. Only respond with the title, nothing else.

Story opening:
${content.substring(0, 1000)}

Title:`

      const messages: LLMMessage[] = [{ role: 'user', content: prompt }]

      const response = client.generate({
        model: settingsStore.model,
        messages,
        stream: true,
        max_tokens: 20, // Small response expected
        metadata: { callType: 'story:title' },
      })

      for await (const part of response) {
        if (part.response) {
          name += part.response
        }
      }

      // Clean up the title
      name = name
        .trim()
        .replace(/^["']|["']$/g, '') // Remove quotes
        .replace(/^Title:?\s*/i, '') // Remove "Title:" prefix if present
        .substring(0, 50) // Limit length

      return name || 'Untitled Story'
    } catch (error) {
      console.error('Error generating story name:', error)
      return 'Untitled Story'
    }
  }

  const runSummarizationPromptMessages = async (
    messages: LLMMessage[],
    logLabel: string,
    failureMessage: string,
    callType: string,
  ): Promise<string> => {
    const client = getClient()
    let result = ''

    try {
      const response = client.generate({
        model: settingsStore.model,
        messages,
        stream: true,
        providerOptions: settingsStore.provider === 'ollama' ? { num_ctx: getEffectiveContextSize() } : undefined,
        metadata: { callType },
      })

      for await (const part of response) {
        if (part.response) {
          result += part.response
        }
      }

      return result.trim()
    } catch (error) {
      console.error(`Error generating ${logLabel}:`, error)
      return failureMessage
    }
  }

  const runSummarizationPromptWithCache = async (
    messages: LLMMessage[],
    logLabel: string,
    failureMessage: string,
    callType: string,
  ): Promise<string> => {
    return runSummarizationPromptMessages(messages, logLabel, failureMessage, callType)
  }

  const buildCharacterContextForMessage = (messageId?: string): string => {
    const characters = charactersStore.characters
    if (characters.length === 0) {
      return ''
    }

    const messages = messagesStore.messages

    const stripEjsTags = (value: string | undefined | null): string =>
      (value ?? '').replace(/<%[-=]?[\s\S]*?%>/g, '').trim()

    const sanitizeCharacter = (character: Character | null | undefined): Character | null => {
      if (!character) {
        return null
      }
      const displayName = getCharacterDisplayName(character)
      const name = stripEjsTags(displayName)
      if (!name) {
        return null
      }
      return {
        ...character,
        firstName: stripEjsTags(character.firstName),
        lastName: character.lastName ? stripEjsTags(character.lastName) : null,
        description: stripEjsTags(character.description),
      }
    }

    const formatCharacterName = (character: Character, isViewpoint: boolean): string => {
      const name = getCharacterDisplayName(character).trim()
      if (!name || name === 'Unnamed') {
        return ''
      }

      const markers: string[] = []
      if (character.isMainCharacter) {
        markers.push('protagonist')
      }
      if (isViewpoint) {
        markers.push('viewpoint')
      }
      const suffix = markers.length > 0 ? ` (${markers.join(', ')})` : ''
      return `${name}${suffix}`
    }

    const composeContext = (activeCharacters: Character[], viewpointCharacter: Character | null): string => {
      const names: Character[] = [...activeCharacters]
      if (viewpointCharacter && !names.some((char) => char.id === viewpointCharacter.id)) {
        names.push(viewpointCharacter)
      }

      const formattedNames = names
        .map((char) =>
          formatCharacterName(
            {
              ...char,
              description: (char.description || '').trim(),
            },
            viewpointCharacter != null && char.id === viewpointCharacter.id,
          ),
        )
        .filter(Boolean)

      const sections: string[] = []
      if (formattedNames.length > 0) {
        sections.push(`Known characters: ${formattedNames.join(', ')}`)
      }

      const viewpointDescription = viewpointCharacter?.description?.trim()
      if (viewpointDescription) {
        sections.push(`Viewpoint character description:\n${viewpointDescription}`)
      }

      if (sections.length === 0) {
        return ''
      }

      return `${sections.join('\n\n')}\n\n`
    }

    const sanitizeActiveCharacters = (chapterNode?: Node): Character[] => {
      const activeIds =
        chapterNode?.activeCharacterIds && chapterNode.activeCharacterIds.length > 0
          ? new Set(chapterNode.activeCharacterIds)
          : null

      return characters
        .filter((char) => {
          if (activeIds && !activeIds.has(char.id)) {
            return false
          }
          return Boolean(stripEjsTags(getCharacterDisplayName(char)))
        })
        .map((char) => ({
          ...char,
          firstName: stripEjsTags(char.firstName),
          lastName: char.lastName ? stripEjsTags(char.lastName) : null,
          description: stripEjsTags(char.description),
        }))
    }

    const evaluateViewpointCharacter = (viewpointId: string, targetMessageId: string): Character | null => {
      const original = characters.find((char) => char.id === viewpointId)
      if (!original) {
        return null
      }

      try {
        const [evaluated] = evaluateCharacterTemplates(
          [original],
          messages,
          targetMessageId,
          nodeStore.nodesArray,
          currentStoryStore.globalScript,
        )
        if (!evaluated) {
          return null
        }
        return sanitizeCharacter(evaluated)
      } catch (error) {
        console.error('Failed to render viewpoint character template for message summaries:', error)
        return sanitizeCharacter(original)
      }
    }

    const tryRenderForMessage = (targetMessageId: string): string | null => {
      const targetMessage = messages.find((msg) => msg.id === targetMessageId)
      if (!targetMessage) {
        return null
      }

      const chapterNode = targetMessage.sceneId
        ? ((nodeStore.getNode(targetMessage.sceneId) as Node | null) ?? undefined)
        : undefined

      const templatedActive = getTemplatedActiveCharacters(
        characters,
        messages,
        targetMessageId,
        nodeStore.nodesArray,
        chapterNode,
        currentStoryStore.globalScript,
      )
        .map((char) => ({
          ...char,
          description: (char.description || '').trim(),
        }))
        .filter((char) => getCharacterDisplayName(char).trim())

      const viewpointId = chapterNode?.viewpointCharacterId
      const viewpointCharacter =
        viewpointId != null
          ? (templatedActive.find((char) => char.id === viewpointId) ??
            evaluateViewpointCharacter(viewpointId, targetMessageId))
          : null

      const templatedContext = composeContext(templatedActive, viewpointCharacter)
      if (templatedContext) {
        return templatedContext
      }

      const sanitizedActive = sanitizeActiveCharacters(chapterNode)
      const sanitizedViewpoint =
        viewpointId != null
          ? sanitizeCharacter(
              sanitizedActive.find((char) => char.id === viewpointId) ??
                characters.find((char) => char.id === viewpointId),
            )
          : null

      const fallbackContext = composeContext(sanitizedActive, sanitizedViewpoint)
      return fallbackContext || null
    }

    if (messageId) {
      const context = tryRenderForMessage(messageId)
      if (context) {
        return context
      }
    }

    const lastAssistantMessage = [...messages].reverse().find((msg) => msg.role === 'assistant' && !msg.isQuery)

    if (lastAssistantMessage) {
      const context = tryRenderForMessage(lastAssistantMessage.id)
      if (context) {
        return context
      }
    }

    const sanitizedCharacters = characters
      .map((char) => sanitizeCharacter(char))
      .filter((char): char is Character => Boolean(char))

    return composeContext(sanitizedCharacters, null)
  }

  const buildSummarizationMessages = (
    content: string,
    characterContext: string | undefined,
    instructions: string,
  ): LLMMessage[] => {
    const messages: LLMMessage[] = []
    const trimmedContext = characterContext?.trim()

    if (trimmedContext) {
      messages.push({
        role: 'user',
        content: `Character context:\n${trimmedContext}`,
        cache_control: { type: 'ephemeral', ttl: '5m' },
      })
    }

    const trimmedContent = content.trim()
    if (trimmedContent) {
      messages.push({
        role: 'user',
        content: `Story content to summarize:\n${trimmedContent}`,
        cache_control: { type: 'ephemeral', ttl: '5m' },
      })
    }

    messages.push({
      role: 'user',
      content: instructions,
    })

    return messages
  }

  const generateSentenceSummary = async (content: string, characterContext?: string): Promise<string> => {
    const instructions = getSentenceSummarizationPrompt(content, characterContext)
    const messages = buildSummarizationMessages(content, characterContext, instructions)
    return runSummarizationPromptWithCache(
      messages,
      'sentence summary',
      'Sentence summary generation failed.',
      'summary:sentence',
    )
  }

  const generateSummary = async (content: string, characterContext?: string): Promise<string> => {
    const instructions = getSummarizationPrompt(content, characterContext)
    const messages = buildSummarizationMessages(content, characterContext, instructions)
    return runSummarizationPromptWithCache(messages, 'summary', 'Summary generation failed.', 'summary:multi')
  }

  const generateParagraphSummary = async (content: string, characterContext?: string): Promise<string> => {
    const instructions = getParagraphSummarizationPrompt(content, characterContext)
    const messages = buildSummarizationMessages(content, characterContext, instructions)
    return runSummarizationPromptWithCache(
      messages,
      'paragraph summary',
      'Paragraph summary generation failed.',
      'summary:paragraph',
    )
  }

  const generateSummaries = async (
    messageId: string,
    content: string,
  ): Promise<{
    sentenceSummary: string
    summary: string
    paragraphSummary: string
  }> => {
    const characterContext = buildCharacterContextForMessage(messageId)
    const sentenceSummary = await generateSentenceSummary(content, characterContext)
    const summary = await generateSummary(content, characterContext)
    const paragraphSummary = await generateParagraphSummary(content, characterContext)
    return { sentenceSummary, summary, paragraphSummary }
  }

  const generateResponse = async (
    promptOrMessages: string | LLMMessage[],
    assistantMessageId: string,
    shouldSummarize = false,
    maxTokens?: number,
    isRegeneration = false,
  ) => {
    const client = getClient()
    let accumulatedContent = ''
    const startTime = Date.now()
    let tokenCount = 0
    let accumulatedUsage: any = null

    currentAbortController = new AbortController()
    const signal = currentAbortController.signal

    try {
      // Convert string prompt to messages if needed
      const messages: LLMMessage[] =
        typeof promptOrMessages === 'string' ? [{ role: 'user', content: promptOrMessages }] : promptOrMessages

      const response = client.generate({
        model: settingsStore.model,
        messages,
        stream: true,
        max_tokens: maxTokens,
        thinking_budget: settingsStore.thinkingBudget > 0 ? settingsStore.thinkingBudget : undefined,
        providerOptions:
          settingsStore.provider === 'ollama'
            ? {
                num_ctx: getEffectiveContextSize(),
              }
            : undefined,
        signal,
        metadata: {
          callType: shouldSummarize ? 'story:generate+summary' : 'story:generate',
        },
      })

      // Track cache for story generation and queries (both use story context)
      // Don't track summaries as they use different prompts
      const isStoryOrQuery = messages.length > 2
      if (isStoryOrQuery) {
        const cacheId = 'story-context' // Use consistent ID since the context is the same
        const cacheContent = JSON.stringify(messages.slice(0, -1)) // Exclude last user message
        cacheStore.addCacheEntry(cacheId, cacheContent, messages.length - 1)
      }

      for await (const part of response) {
        if (signal.aborted) {
          throw new DOMException('Generation aborted', 'AbortError')
        }

        if (part.response) {
          accumulatedContent += part.response
          tokenCount++
          messagesStore.updateMessage(assistantMessageId, { content: accumulatedContent })
        }

        // Accumulate usage data from message_delta events
        if (part.usage) {
          if (!accumulatedUsage) {
            accumulatedUsage = { ...part.usage }
          } else {
            // Accumulate the token counts
            accumulatedUsage.prompt_tokens = (accumulatedUsage.prompt_tokens || 0) + (part.usage.prompt_tokens || 0)
            accumulatedUsage.completion_tokens =
              (accumulatedUsage.completion_tokens || 0) + (part.usage.completion_tokens || 0)
            accumulatedUsage.total_tokens = (accumulatedUsage.total_tokens || 0) + (part.usage.total_tokens || 0)

            // For cache tokens, take the latest values (they're not cumulative)
            if (part.usage.cache_creation_input_tokens !== undefined) {
              accumulatedUsage.cache_creation_input_tokens = part.usage.cache_creation_input_tokens
            }
            if (part.usage.cache_read_input_tokens !== undefined) {
              accumulatedUsage.cache_read_input_tokens = part.usage.cache_read_input_tokens
            }
          }
        }

        if (part.done) {
          const endTime = Date.now()
          const duration = (endTime - startTime) / 1000
          const tokensPerSecond = tokenCount / duration

          // Completion data received

          // Use accumulated usage data if available, fallback to part.usage
          const usage = accumulatedUsage || part.usage

          // Calculate characters per token ratio using standardized token usage
          const tokenUsageForRatio = convertToTokenUsage(usage)

          if (tokenUsageForRatio && tokenUsageForRatio.input_normal > 0) {
            // Get total character count of visible story messages (what was actually sent)
            const visibleMessages = messagesStore.getVisibleMessages()
            const storyMessages = visibleMessages.filter((msg) => !msg.isQuery)
            const totalChars = storyMessages.reduce((sum, msg) => sum + msg.content.length, 0)

            if (totalChars > 0) {
              const newRatio = totalChars / tokenUsageForRatio.input_normal
              // Only update if the ratio seems reasonable (between 2 and 6)
              if (newRatio >= 2 && newRatio <= 6) {
                settingsStore.setCharsPerToken(newRatio)
                // Updated chars per token ratio
              } else {
                // Skipping unrealistic chars per token ratio
              }
            }
          }

          // Extract think tags from the content
          let { cleanedContent, thinkContent } = extractThinkTags(accumulatedContent)

          // Run cliche refinement if enabled and this is a story message
          if (shouldSummarize && cleanedContent.trim() && settingsStore.refineClichés) {
            try {
              messagesStore.updateMessage(assistantMessageId, {
                content: `${cleanedContent}\n\n[Refining clichés...]`,
              })

              const refinementResult = await refineClichés(cleanedContent, client, settingsStore.model)

              if (refinementResult.wasRefined) {
                cleanedContent = refinementResult.refinedContent
              }
            } catch (error) {
              console.error('Failed to refine clichés:', error)
              // Continue with original content if refinement fails
            }
          }

          const inputTokens = usage?.prompt_tokens || 0
          const outputTokens = usage?.completion_tokens || 0
          const cacheReadTokens = usage?.cache_read_input_tokens || 0
          const cacheWriteTokens = usage?.cache_creation_input_tokens || 0

          // Calculate non-cached input tokens
          const regularInputTokens = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens)

          // Get pricing from the model data
          let inputBasePrice = 0.000003 // Default fallback price (per token)
          let outputBasePrice = 0.000015 // Default fallback price (per token)

          const currentModel = modelsStore.availableModels.find((m) => m.name === settingsStore.model)
          if (currentModel?.pricing) {
            // All providers now store prices as numbers per million tokens
            inputBasePrice = currentModel.pricing.input / 1_000_000
            outputBasePrice = currentModel.pricing.output / 1_000_000

            // Using API pricing
          } else {
            // Using default pricing
          }

          // Update token statistics
          cacheStore.updateTokenStats({
            inputTokens: regularInputTokens,
            outputTokens,
            cacheWriteTokens,
            cacheReadTokens,
            inputBasePrice,
            outputBasePrice,
          })

          // Record cached prefix for cache prediction
          // When cache is written or read, record the current context fingerprint
          if (cacheWriteTokens > 0 || cacheReadTokens > 0) {
            const contextFingerprint = getContextNodesFingerprint(nodeStore.nodesArray)
            if (contextFingerprint) {
              // 1 hour TTL for Anthropic cache
              const ttlMs = 60 * 60 * 1000
              cacheStore.recordCachedPrefix(contextFingerprint, ttlMs, 'context-nodes')
            }
          }

          // Convert to standardized token usage
          const tokenUsage = convertToTokenUsage(usage)

          messagesStore.updateMessage(assistantMessageId, {
            content: cleanedContent,
            think: thinkContent,
            tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
            // Keep legacy fields for backward compatibility
            totalTokens: usage?.completion_tokens || part.eval_count || tokenCount,
            promptTokens: usage?.prompt_tokens || part.prompt_eval_count,
            cacheCreationTokens: cacheWriteTokens || undefined,
            cacheReadTokens: cacheReadTokens || undefined,
            // Add new standardized token usage
            tokenUsage,
            model: settingsStore.model,
          })

          // Check if we got an API error (like overloaded_error) and skip summarization
          const hasApiError = 'error' in part && part.error
          if (hasApiError) {
            // API error detected, skipping summarization
          }

          // Generate summaries if requested and this is a story message (and no API error)
          if (shouldSummarize && cleanedContent.trim() && !hasApiError) {
            // Generating summaries

            // Set summarizing flag before starting
            messagesStore.setSummarizing(assistantMessageId, true)

            try {
              // Check if this is the first story turn and we have a placeholder name
              const storyMessages = messagesStore.messages.filter((msg) => !msg.isQuery && msg.role === 'assistant')
              const isFirstTurn = storyMessages.length === 1
              const summariesPromise = generateSummaries(assistantMessageId, cleanedContent)

              if (isFirstTurn && currentStoryStore.isPlaceholderName) {
                // Generate story name along with summaries
                const [summaries, storyName] = await Promise.all([summariesPromise, generateStoryName(cleanedContent)])

                messagesStore.updateMessage(assistantMessageId, {
                  sentenceSummary: summaries.sentenceSummary,
                  summary: summaries.summary,
                  paragraphSummary: summaries.paragraphSummary,
                })

                // Update story name if we got a good one
                if (storyName && storyName !== 'Untitled Story') {
                  currentStoryStore.setName(storyName, false)
                  // Generated story name
                }
              } else {
                // Just generate summaries as usual
                const summaries = await summariesPromise

                messagesStore.updateMessage(assistantMessageId, {
                  sentenceSummary: summaries.sentenceSummary,
                  summary: summaries.summary,
                  paragraphSummary: summaries.paragraphSummary,
                })
              }
            } catch (error) {
              console.error('Failed to generate summaries:', error)
            } finally {
              // Always clear the summarizing flag
              messagesStore.setSummarizing(assistantMessageId, false)
            }
          }

          // Generate scene analysis and discover entities if this is a story message and smart context is enabled (and no API error)
          if (shouldSummarize && cleanedContent.trim() && settingsStore.useSmartContext && !hasApiError) {
            // Starting scene analysis

            // Set analyzing flag before starting
            messagesStore.setAnalyzing(assistantMessageId, true)

            try {
              // Create a message object for analysis
              const messageForAnalysis = messagesStore.messages.find((msg) => msg.id === assistantMessageId)
              if (!messageForAnalysis) {
                throw new Error('Message not found for analysis')
              }
              // Found message for analysis

              // Get known entities for consistency
              // Getting known entities
              const knownEntities = extractKnownEntities(
                charactersStore.characters || [],
                contextItemsStore.contextItems || [],
              )
              // Extracted known entities

              if (!knownEntities) {
                throw new Error('Failed to extract known entities')
              }

              // Analyze the story beat for scene information
              // Analyzing story beat
              const sceneAnalysis = await analyzeStoryBeat(messageForAnalysis, knownEntities, generateAnalysis)
              // Scene analysis completed

              // Update message with scene analysis
              messagesStore.updateMessage(assistantMessageId, { sceneAnalysis })

              // Detect new entities in the story beat
              const newEntities = detectNewEntities(sceneAnalysis, knownEntities)

              if (
                newEntities.newCharacters.length > 0 ||
                newEntities.newThemes.length > 0 ||
                newEntities.newLocations.length > 0
              ) {
                // Discovered new entities

                // Generate descriptions for discovered entities
                const entityDescriptions = await generateEntityDescriptions(
                  newEntities,
                  cleanedContent,
                  generateAnalysis,
                )

                // Import pendingEntitiesStore here to avoid circular dependency
                const { pendingEntitiesStore } = await import('../stores/pendingEntitiesStore')

                // Create pending entities for user confirmation
                const pendingEntities = [
                  ...Object.entries(entityDescriptions.characterDescriptions).map(([name, description]) => ({
                    id: crypto.randomUUID(),
                    type: 'character' as const,
                    name: name,
                    description: description,
                    originalName: name,
                    isSelected: true, // Default to selected
                  })),
                  ...Object.entries(entityDescriptions.themeDescriptions).map(([name, description]) => ({
                    id: crypto.randomUUID(),
                    type: 'theme' as const,
                    name: name,
                    description: description,
                    originalName: name,
                    isSelected: true,
                  })),
                  ...Object.entries(entityDescriptions.locationDescriptions).map(([name, description]) => ({
                    id: crypto.randomUUID(),
                    type: 'location' as const,
                    name: name,
                    description: description,
                    originalName: name,
                    isSelected: true,
                  })),
                ]

                // Add batch to pending entities store
                pendingEntitiesStore.addBatch({
                  id: crypto.randomUUID(),
                  entities: pendingEntities,
                  messageId: assistantMessageId,
                })
              }
            } catch (error) {
              console.error('Failed to analyze story beat:', error)
            } finally {
              // Always clear the analyzing flag
              messagesStore.setAnalyzing(assistantMessageId, false)
            }
          }

          // Check for auto-generation after all processing is complete
          if (shouldSummarize && cleanedContent.trim()) {
            checkForAutoGeneration()
          }

          // Save content: for regeneration, create a new revision; for initial generation, save to existing revision
          const finalMessage = messagesStore.messages.find((msg) => msg.id === assistantMessageId)
          if (cleanedContent.trim()) {
            const { saveService } = await import('../services/saveService')
            try {
              if (isRegeneration) {
                // Regeneration: create a new revision with the content
                const { revisionId } = await saveService.createMessageRevision(
                  assistantMessageId,
                  cleanedContent,
                  {
                    model: finalMessage?.model,
                    tokensPerSecond: finalMessage?.tokensPerSecond,
                    totalTokens: finalMessage?.totalTokens,
                    promptTokens: finalMessage?.promptTokens,
                    cacheCreationTokens: finalMessage?.cacheCreationTokens,
                    cacheReadTokens: finalMessage?.cacheReadTokens,
                    think: finalMessage?.think,
                    showThink: finalMessage?.showThink,
                  },
                )
                // Update local state with new revision ID
                messagesStore.updateMessageNoSave(assistantMessageId, { currentMessageRevisionId: revisionId })
              } else {
                // Initial generation: save paragraphs to existing revision (v1)
                const revisionId = finalMessage?.currentMessageRevisionId
                if (revisionId) {
                  // Parse content into paragraphs
                  const paragraphs = cleanedContent
                    .split(/\n\n+/)
                    .map((p) => p.trim())
                    .filter((p) => p.length > 0)
                    .map((body, i) => ({
                      id: `${assistantMessageId}-p${i}`,
                      body,
                      state: 'ai' as const,
                      comments: [],
                    })) as import('@mythweavers/shared').Paragraph[]

                  // Save paragraphs to the existing revision
                  await saveService.saveParagraphs(revisionId, [], paragraphs)

                  // Update local message with content and paragraphs
                  messagesStore.updateMessageNoSave(assistantMessageId, {
                    content: cleanedContent,
                    paragraphs,
                  })
                }
              }
            } catch (error) {
              console.error('Failed to save generated content:', error)
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        messagesStore.updateMessage(assistantMessageId, { content: `${accumulatedContent}\n\n[Generation aborted]` })
      } else {
        let errorMessage = 'Unknown error'
        if (error instanceof Error) {
          errorMessage = error.message
          // Add more context for common errors
          if (error.message.includes('fetch')) {
            errorMessage +=
              '\n\nPossible causes:\n- Network connection issues\n- Provider service is down\n- CORS/firewall blocking the request'
          } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorMessage += '\n\nPlease check your API key in settings.'
          } else if (error.message.includes('429')) {
            errorMessage += '\n\nRate limit exceeded. Please wait before trying again.'
          } else if (error.message.includes('404')) {
            errorMessage += '\n\nModel not found. Please check if the selected model is available.'
          }
        }
        const errorContent = `Error: ${errorMessage}`
        messagesStore.updateMessage(assistantMessageId, { content: errorContent })
        console.error('Generation error details:', error)
      }
      // Error message is already saved via messagesStore.updateMessage
      throw error
    } finally {
      currentAbortController = null
    }
  }

  const abortGeneration = () => {
    if (currentAbortController) {
      currentAbortController.abort()
    }
    // Also clear the analyzing state if it's active
    if (messagesStore.isAnalyzing) {
      messagesStore.setIsAnalyzing(false)
    }
  }

  const isGenerating = () => currentAbortController !== null

  const checkIfOllamaIsBusy = async (): Promise<boolean> => {
    // This is Ollama-specific, so we only check for Ollama provider
    if (settingsStore.provider !== 'ollama') {
      return false
    }

    try {
      // For Ollama, we'll need to check using a different method
      // Since the unified interface doesn't expose ps(), we'll just return false
      // This functionality might need to be moved to the Ollama client itself
      return false
    } catch (error) {
      console.error('Error checking provider status:', error)
      // If we can't check, assume it's not busy to avoid blocking the user
      return false
    }
  }

  const checkForAutoGeneration = async () => {
    // Only proceed if auto-generation is enabled
    if (!settingsStore.autoGenerate) {
      return
    }

    // Poll for readiness instead of using a fixed delay
    const pollForReadiness = async (maxAttempts = 60, interval = 1000) => {
      let attempt = 0
      const { pendingEntitiesStore } = await import('../stores/pendingEntitiesStore')

      while (attempt < maxAttempts) {
        try {
          // If pending entities dialog is visible, pause polling until it's resolved
          if (pendingEntitiesStore.isVisible && pendingEntitiesStore.hasPendingEntities) {
            // Auto-generation paused - waiting for user input

            // Wait for user to handle entities (don't increment attempt counter)
            await new Promise((resolve) => setTimeout(resolve, interval))
            continue
          }

          // Check if story is ready for generation
          if (isStoryReadyForGeneration()) {
            // Story ready for auto-generation

            // Generate next story beat instructions
            const nextInstructions = await generateNextStoryBeatInstructions(
              generateAnalysis,
              currentStoryStore.paragraphsPerTurn,
            )
            // Generated auto-instructions

            // Dispatch event to trigger generation
            const autoGenerateEvent = new CustomEvent('auto-generate-story', {
              detail: { instructions: nextInstructions },
            })
            window.dispatchEvent(autoGenerateEvent)
            return
          }

          // Auto-generation waiting

          // Wait before next check and increment attempt counter
          await new Promise((resolve) => setTimeout(resolve, interval))
          attempt++
        } catch (error) {
          console.error('Auto-generation failed:', error)
          return
        }
      }

      // Auto-generation timed out
    }

    // Start polling (max 60 seconds, check every 1 second)
    pollForReadiness()
  }
  interface GenerateNodeSummaryParams {
    nodeId: string
    title: string
    content: string
    viewpointCharacterId?: string
  }

  const generateNodeSummary = async ({
    nodeId,
    title,
    content,
    viewpointCharacterId,
  }: GenerateNodeSummaryParams): Promise<string> => {
    const client = getClient()
    let summary = ''

    try {
      const nodeMessages = messagesStore.messages.filter(
        (msg) => msg.sceneId === nodeId && msg.role === 'assistant' && !msg.isQuery && msg.type !== 'chapter',
      )
      const lastNodeMessageId = nodeMessages[nodeMessages.length - 1]?.id

      let evaluatedCharacters: Character[] = charactersStore.characters
      if (lastNodeMessageId) {
        try {
          evaluatedCharacters = evaluateCharacterTemplates(
            charactersStore.characters,
            messagesStore.messages,
            lastNodeMessageId,
            nodeStore.nodesArray,
            currentStoryStore.globalScript,
          )
        } catch (error) {
          console.error('Failed to render character templates for node summary:', error)
        }
      }

      const findCharacter = (predicate: (char: Character) => boolean): Character | undefined => {
        const evaluated = evaluatedCharacters.find(predicate)
        if (evaluated) return evaluated
        return charactersStore.characters.find(predicate)
      }

      const protagonist = findCharacter((char) => char.isMainCharacter)
      const viewpointCharacter = viewpointCharacterId
        ? findCharacter((char) => char.id === viewpointCharacterId)
        : undefined

      const formatCharacterNote = (label: string, character: Character | undefined, extraNote?: string): string => {
        if (!character) return ''
        const description = character.description?.trim()
        const charName = getCharacterDisplayName(character)
        const baseLine = `\n\n${label}: ${charName}${extraNote ? ` ${extraNote}` : ''}`
        return description ? `${baseLine}\n${description}` : baseLine
      }

      const protagonistNote = formatCharacterNote('Protagonist', protagonist)
      const viewpointNote = formatCharacterNote(
        'Viewpoint Character',
        viewpointCharacter,
        '(this chapter is written from their perspective)',
      )

      // Create a prompt for content summarization
      const protagonistName = protagonist ? getCharacterDisplayName(protagonist) : null
      const viewpointName = viewpointCharacter ? getCharacterDisplayName(viewpointCharacter) : null
      const prompt = `Create a concise summary of the following content from a story. The summary should capture the key events, character developments, and plot points.${protagonistName ? ` Focus on ${protagonistName}'s role and experiences as the protagonist.` : ''}${viewpointName ? ` Note that this chapter is written from ${viewpointName}'s perspective.` : ''} Be objective and comprehensive. Do NOT include any preamble, introduction, or meta-commentary. Output ONLY the summary itself:

Title: ${title}${protagonistNote}${viewpointNote}

${content}

---
Now write the summary of the above content. Remember: capture key events, character developments, and plot points. Be concise and objective. Output ONLY the summary text itself - no headers like "Summary:" or "Chapter Summary:", no preamble, no meta-commentary. Start directly with the summary content.`

      const messages: LLMMessage[] = [{ role: 'user', content: prompt }]

      const response = client.generate({
        model: settingsStore.model,
        messages,
        stream: true,
        providerOptions:
          settingsStore.provider === 'ollama'
            ? {
                num_ctx: getEffectiveContextSize(),
              }
            : undefined,
        metadata: { callType: 'summary:node' },
      })

      for await (const part of response) {
        if (part.response) {
          summary += part.response
        }
      }

      return summary.trim()
    } catch (error) {
      console.error('Error generating summary:', error)
      throw error
    }
  }

  return {
    generateResponse,
    generateSummaries,
    generateParagraphSummary,
    generateNodeSummary,
    generateStoryName,
    getClient,
    abortGeneration,
    isGenerating,
    checkIfOllamaIsBusy,
    pingCache,
  }
}
