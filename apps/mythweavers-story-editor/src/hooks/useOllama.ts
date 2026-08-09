import { generateMessageId } from '../utils/id'
import { cacheStore } from '../stores/cacheStore'
import { charactersStore } from '../stores/charactersStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { modelsStore } from '../stores/modelsStore'
import { nodeStore } from '../stores/nodeStore'
import { effectiveSettings } from '../stores/effectiveSettingsStore'
import { settingsStore } from '../stores/settingsStore'
import type { Character, NodeSummaryLevels } from '../types/core'
import type { LLMMessage, TokenUsage } from '@mythweavers/llm'
import { normalizeTokenUsage } from '@mythweavers/llm'
import { generateAnalysis } from '../utils/analysisClient'
import { generateNextStoryBeatInstructions, isStoryReadyForGeneration } from '../utils/autoGeneration'
import { getCharacterDisplayName } from '../utils/character'
import { evaluateCharacterTemplates } from '../utils/contextTemplating'
import { LLMClientFactory } from '../utils/llm'
import { resolveModel } from '../utils/llm/resolveModel'
import { refineClichés } from '../utils/clicheRefinement'
import { getContextNodesFingerprint } from '../utils/storyFingerprint'

export const useOllama = () => {
  let currentAbortController: AbortController | null = null

  // Get the effective context size (minimum of user setting and model's actual context length)
  const getEffectiveContextSize = (): number => {
    const selectedModel = modelsStore.availableModels.find((m: any) => m.name === effectiveSettings.model)
    if (selectedModel?.context_length) {
      return Math.min(effectiveSettings.contextSize, selectedModel.context_length)
    }
    return effectiveSettings.contextSize
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
    const resolved = resolveModel('story:title')
    const client = LLMClientFactory.getClient(resolved.provider)
    let name = ''

    try {
      const prompt = `Here is the opening of a story:

${content.substring(0, 1000)}

Based on the above, generate a short, evocative title (2-5 words) that captures the essence of the story. Only respond with the title, nothing else.`

      const messages: LLMMessage[] = [{ role: 'user', content: prompt }]

      const response = client.generate({
        model: resolved.model,
        messages,
        max_tokens: 20, // Small response expected
        metadata: { callType: 'story:title' },
      })

      for await (const event of response) {
        if (event.type === 'chunk') {
          name += event.text
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

  const generateResponse = async (
    promptOrMessages: string | LLMMessage[],
    assistantMessageId: string,
    shouldSummarize = false,
    maxTokens?: number,
    isRegeneration = false,
  ) => {
    const callType = shouldSummarize ? 'story:generate+summary' : 'story:generate'
    const resolved = resolveModel(callType)
    const client = LLMClientFactory.getClient(resolved.provider)
    let accumulatedContent = ''
    const startTime = Date.now()
    let tokenCount = 0
    let accumulatedUsage: TokenUsage | undefined

    currentAbortController = new AbortController()
    const signal = currentAbortController.signal

    try {
      // Convert string prompt to messages if needed
      const messages: LLMMessage[] =
        typeof promptOrMessages === 'string' ? [{ role: 'user', content: promptOrMessages }] : promptOrMessages

      const response = client.generate({
        model: resolved.model,
        messages,
        max_tokens: maxTokens,
        thinking_budget: resolved.thinkingBudget > 0 ? resolved.thinkingBudget : undefined,
        providerOptions:
          resolved.provider === 'ollama'
            ? {
                num_ctx: getEffectiveContextSize(),
              }
            : undefined,
        signal,
        metadata: { callType },
      })

      // Track cache for story generation and queries (both use story context)
      // Don't track summaries as they use different prompts
      const isStoryOrQuery = messages.length > 2
      if (isStoryOrQuery) {
        const cacheId = 'story-context' // Use consistent ID since the context is the same
        const cacheContent = JSON.stringify(messages.slice(0, -1)) // Exclude last user message
        cacheStore.addCacheEntry(cacheId, cacheContent, messages.length - 1)
      }

      let doneProcessed = false // Guard to prevent processing done event multiple times

      for await (const event of response) {
        if (signal.aborted) {
          throw new DOMException('Generation aborted', 'AbortError')
        }

        if (event.type === 'chunk') {
          accumulatedContent += event.text
          tokenCount++
          // Use NoSave variant during streaming - content is saved via saveParagraphs after generation
          messagesStore.updateMessageNoSave(assistantMessageId, { content: accumulatedContent })
        }

        // Accumulate usage data from usage events
        if (event.type === 'usage') {
          if (!accumulatedUsage) {
            accumulatedUsage = { ...event.usage }
          } else {
            // Input tokens are reported as totals — take the max
            accumulatedUsage.prompt_tokens = Math.max(accumulatedUsage.prompt_tokens ?? 0, event.usage.prompt_tokens ?? 0)
            // Output tokens accumulate during streaming
            accumulatedUsage.completion_tokens =
              (accumulatedUsage.completion_tokens ?? 0) + (event.usage.completion_tokens ?? 0)
            accumulatedUsage.total_tokens =
              (accumulatedUsage.prompt_tokens ?? 0) + (accumulatedUsage.completion_tokens ?? 0)

            // For cache tokens, take the max (they're reported once)
            if (event.usage.cache_creation_input_tokens !== undefined) {
              accumulatedUsage.cache_creation_input_tokens = Math.max(
                accumulatedUsage.cache_creation_input_tokens ?? 0,
                event.usage.cache_creation_input_tokens,
              )
            }
            if (event.usage.cache_read_input_tokens !== undefined) {
              accumulatedUsage.cache_read_input_tokens = Math.max(
                accumulatedUsage.cache_read_input_tokens ?? 0,
                event.usage.cache_read_input_tokens,
              )
            }
          }
        }

        if (event.type === 'done' && !doneProcessed) {
          doneProcessed = true // Prevent processing multiple done events
          const endTime = Date.now()
          const duration = (endTime - startTime) / 1000
          const tokensPerSecond = tokenCount / duration

          const usage = accumulatedUsage

          // Calculate characters per token ratio using standardized token usage
          const tokenUsageForRatio = normalizeTokenUsage(usage)

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

              const refinementResult = await refineClichés(cleanedContent)

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

          const currentModel = modelsStore.availableModels.find((m) => m.name === effectiveSettings.model)
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
          const tokenUsage = normalizeTokenUsage(usage)

          messagesStore.updateMessage(assistantMessageId, {
            content: cleanedContent,
            think: thinkContent,
            tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
            // Keep legacy fields for backward compatibility
            totalTokens: usage?.completion_tokens || tokenCount,
            promptTokens: usage?.prompt_tokens,
            cacheCreationTokens: cacheWriteTokens || undefined,
            cacheReadTokens: cacheReadTokens || undefined,
            // Add new standardized token usage
            tokenUsage,
            model: resolved.model,
          })

          // Summary generation and auto story naming disabled

          // Check for auto-generation after all processing is complete
          if (shouldSummarize && cleanedContent.trim()) {
            checkForAutoGeneration()
          }

          // Parse paragraphs synchronously so they're in the store BEFORE isGenerating goes false.
          // This ensures the editor picks up the new content during the editable transition.
          const finalMessage = messagesStore.messages.find((msg) => msg.id === assistantMessageId)
          if (cleanedContent.trim()) {
            const localParagraphs = cleanedContent
              .split(/\n\n+/)
              .map((p) => p.trim())
              .filter((p) => p.length > 0)
              .map((body) => ({
                id: generateMessageId(),
                body,
                state: 'ai' as const,
                comments: [],
              })) as import('@mythweavers/shared').Paragraph[]

            // Update store with paragraphs immediately (synchronous) and bump content version
            // so the editor accepts this as authoritative content
            messagesStore.updateMessageNoSave(assistantMessageId, {
              content: cleanedContent,
              paragraphs: localParagraphs,
            })
            messagesStore.bumpContentVersion(assistantMessageId)

            // Fire-and-forget: persist to backend
            import('../services/saveService').then(({ saveService }) => {
              if (isRegeneration) {
                // Regeneration: create a new revision with the content
                saveService
                  .createMessageRevision(assistantMessageId, cleanedContent, {
                    model: finalMessage?.model,
                    tokensPerSecond: finalMessage?.tokensPerSecond,
                    totalTokens: finalMessage?.totalTokens,
                    promptTokens: finalMessage?.promptTokens,
                    cacheCreationTokens: finalMessage?.cacheCreationTokens,
                    cacheReadTokens: finalMessage?.cacheReadTokens,
                    think: finalMessage?.think,
                    showThink: finalMessage?.showThink,
                  })
                  .then(({ revisionId, paragraphs }) => {
                    // Update local state with server revision ID and paragraph IDs
                    messagesStore.updateMessageNoSave(assistantMessageId, {
                      currentMessageRevisionId: revisionId,
                      paragraphs,
                    })
                    messagesStore.bumpContentVersion(assistantMessageId)
                  })
                  .catch((error) => {
                    console.error('Failed to save generated content (regeneration):', error)
                  })
              } else {
                // Initial generation: save paragraphs to existing revision
                const revisionId = finalMessage?.currentMessageRevisionId
                if (revisionId) {
                  saveService.saveParagraphs(revisionId, [], localParagraphs).catch((error) => {
                    console.error('Failed to save generated content (initial):', error)
                  })
                }
              }
            })
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
    if (effectiveSettings.provider !== 'ollama') {
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
    messageContents: string[]
    viewpointCharacterId?: string
  }

  const CHUNK_SIZE = 10

  // Pull the JSON object out of a model response that may be fenced, prefixed
  // with commentary, or both. Returns null when nothing parseable is found so
  // the caller can fall back to treating the response as plain text.
  const parseJsonObject = (text: string): Record<string, unknown> | null => {
    const withoutFences = text.replace(/```(?:json)?/gi, '').trim()
    const start = withoutFences.indexOf('{')
    const end = withoutFences.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null

    try {
      const parsed = JSON.parse(withoutFences.slice(start, end + 1))
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }

  const asTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

  const generateNodeSummary = async ({
    nodeId,
    messageContents,
    viewpointCharacterId,
  }: GenerateNodeSummaryParams): Promise<NodeSummaryLevels> => {
    const resolved = resolveModel('summary:node')
    const client = LLMClientFactory.getClient(resolved.provider)

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

      const protagonistName = protagonist ? getCharacterDisplayName(protagonist) : null
      const viewpointName = viewpointCharacter ? getCharacterDisplayName(viewpointCharacter) : null

      // Split messages into chunks of CHUNK_SIZE
      const chunks: string[][] = []
      for (let i = 0; i < messageContents.length; i += CHUNK_SIZE) {
        chunks.push(messageContents.slice(i, i + CHUNK_SIZE))
      }

      console.log(
        `[generateNodeSummary] Splitting ${messageContents.length} messages into ${chunks.length} chunks of up to ${CHUNK_SIZE}`,
      )

      // Generate a summary for each chunk
      const chunkSummaries: NodeSummaryLevels[] = []

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex]
        const chunkContent = chunk.join('\n\n')

        const focusNote = `${protagonistName ? ` Focus on ${protagonistName}'s role and experiences as the protagonist.` : ''}${viewpointName ? ` Note that this chapter is written from ${viewpointName}'s perspective.` : ''}`

        const prompt = `Summarize the following content from a story at three levels of detail. Capture the key events, character developments, and plot points.${focusNote} Be objective and comprehensive.

${chunkContent}

---
Now summarize the above content at three levels of detail:
- "detailed": 3-4 paragraphs covering key events, character developments, and plot points.
- "paragraph": a single paragraph condensing the same material.
- "sentence": a single sentence capturing the essential thrust of what happens.

Each level must stand on its own and describe the same content — the shorter levels are not continuations of the longer ones. Be concise and objective, with no preamble or meta-commentary.

Respond with ONLY a JSON object in exactly this shape, with no surrounding text or code fences:
{"detailed": "...", "paragraph": "...", "sentence": "..."}`

        const messages: LLMMessage[] = [{ role: 'user', content: prompt }]

        const response = client.generate({
          model: resolved.model,
          messages,
          providerOptions:
            resolved.provider === 'ollama'
              ? {
                  num_ctx: getEffectiveContextSize(),
                }
              : undefined,
          metadata: { callType: 'summary:node' },
        })

        let chunkResponse = ''
        for await (const event of response) {
          if (event.type === 'chunk') {
            chunkResponse += event.text
          }
        }

        const parsed = parseJsonObject(chunkResponse)
        const detailed = asTrimmedString(parsed?.detailed)

        if (!parsed || !detailed) {
          // The model ignored the JSON instruction (small local models do this
          // regularly). Keep the raw text as the detailed level rather than
          // losing the whole summary, and leave the shorter levels empty so
          // they aren't overwritten with junk.
          console.warn(
            `[generateNodeSummary] Chunk ${chunkIndex + 1}/${chunks.length} did not return parseable JSON; falling back to raw text`,
          )
          chunkSummaries.push({ detailed: chunkResponse.trim(), paragraph: '', sentence: '' })
        } else {
          chunkSummaries.push({
            detailed,
            paragraph: asTrimmedString(parsed.paragraph),
            sentence: asTrimmedString(parsed.sentence),
          })
        }

        console.log(`[generateNodeSummary] Generated summary for chunk ${chunkIndex + 1}/${chunks.length}`)
      }

      // Combine all chunk summaries. A scene that fits in one chunk — the
      // common case — gets exactly the three lengths the model produced. A
      // multi-chunk scene necessarily gets one entry per chunk at every level,
      // since each call only ever sees its own slice of the scene.
      const joinLevel = (pick: (levels: NodeSummaryLevels) => string) =>
        chunkSummaries
          .map(pick)
          .filter((text) => text.length > 0)
          .join('\n\n')

      return {
        detailed: joinLevel((levels) => levels.detailed),
        paragraph: joinLevel((levels) => levels.paragraph),
        sentence: joinLevel((levels) => levels.sentence),
      }
    } catch (error) {
      console.error('Error generating summary:', error)
      throw error
    }
  }

  const generateNodeTitle = async (content: string, nodeType: string): Promise<string> => {
    const resolved = resolveModel('node:title')
    const client = LLMClientFactory.getClient(resolved.provider)
    let title = ''

    try {
      const prompt = `Here is the content of a ${nodeType}:

${content.substring(0, 3000)}

Based on the above, generate a short, evocative title (2-5 words) that captures the essence of what happens. Only respond with the title, nothing else.`

      const messages: LLMMessage[] = [{ role: 'user', content: prompt }]

      const response = client.generate({
        model: resolved.model,
        messages,
        max_tokens: 20,
        metadata: { callType: 'node:title' },
      })

      for await (const event of response) {
        if (event.type === 'chunk') {
          title += event.text
        }
      }

      title = title
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/^Title:?\s*/i, '')
        .substring(0, 50)

      return title || 'Untitled'
    } catch (error) {
      console.error('Error generating node title:', error)
      return 'Untitled'
    }
  }

  return {
    generateResponse,
    generateNodeSummary,
    generateNodeTitle,
    generateStoryName,
    abortGeneration,
    isGenerating,
    checkIfOllamaIsBusy,
    pingCache,
  }
}
