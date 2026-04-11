import { createContext, createEffect, onCleanup, onMount, useContext } from 'solid-js'
import type { AdventurePersistence } from '../../hooks/useAdventurePersistence'
import type { LLMMessage } from '../../types/llm'
import { effectiveSettings } from '../../stores/effectiveSettingsStore'
import { adventureStore } from '../../stores/adventureStore'
import { LLMClientFactory } from '../../utils/llm/LLMClientFactory'
import { resolveModel } from '../../utils/llm/resolveModel'
import {
  SETTING_KNOBS,
  SETTING_GEN_PROMPT,
  pickRandom,
  buildNarrativeMessages,
  buildTrajectoryMessages,
  buildDirectorMessages,
  cleanNarrative,
  parseTrajectory,
} from './prompts'
import { processLLMDiffResponse } from '@mythweavers/shared'

// --- Engine interface & context ---

export interface AdventureEngine {
  handleStart: () => Promise<void>
  handleSubmit: () => void
  handleKeyDown: (e: KeyboardEvent) => void
  handleAbort: () => void
  handleRetry: () => void
  handleRegenerate: () => void
  handleRegenerateDirector: () => void
  handleRewindTo: (turnIndex: number) => void
  handleReset: () => void
  handleGenerateSetting: () => Promise<void>
  persist: () => void
  setStoryAreaRef: (el: HTMLDivElement) => void
  setInputRef: (el: HTMLTextAreaElement) => void
  onStoryAreaScroll: () => void
  scrollToBottom: () => void
}

export const AdventureEngineContext = createContext<AdventureEngine>()

export function useEngine(): AdventureEngine {
  const ctx = useContext(AdventureEngineContext)
  if (!ctx)
    throw new Error('useEngine must be used within AdventureEngineProvider')
  return ctx
}

// --- Engine factory ---

export function createAdventureEngine(
  persistence: AdventurePersistence,
  navigate: (to: string, options?: { replace?: boolean }) => void,
): AdventureEngine {
  // --- Refs ---
  let storyAreaRef: HTMLDivElement | undefined
  let inputRef: HTMLTextAreaElement | undefined
  let abortController: AbortController | null = null

  onCleanup(() => {
    abortController?.abort()
  })

  // --- Persistence helpers ---

  const persist = () =>
    persistence.persistSoon(adventureStore.buildSnapshot())

  const persistNow = () =>
    persistence.persistNow(adventureStore.buildSnapshot())

  // --- Auto-scroll effect ---

  createEffect(() => {
    // Track reactive dependencies
    adventureStore.turns
    adventureStore.streamingContent
    requestAnimationFrame(() => {
      if (storyAreaRef && adventureStore.scrollLocked) {
        storyAreaRef.scrollTop = storyAreaRef.scrollHeight
      }
    })
  })

  // --- Auto-start on mount if adventure was set up from the list modal ---

  const saved = persistence.initialState()
  onMount(() => {
    if (
      adventureStore.phase === 'playing' &&
      adventureStore.turns.length === 0 &&
      adventureStore.settingDescription &&
      !saved?.pendingAction
    ) {
      generate(null)
    }
  })

  // --- Generation ---

  async function generate(playerAction: string | null) {
    if (adventureStore.isGenerating) return

    adventureStore.setError(null)
    adventureStore.setLastFailedAction(undefined)
    adventureStore.setIsGenerating(true)
    adventureStore.setStreamingContent('')
    adventureStore.setPendingAction(playerAction)
    persistNow()

    abortController = new AbortController()

    try {
      // --- Step 1: Stream narrative ---
      const narrativeMessages = buildNarrativeMessages(
        adventureStore.turns,
        adventureStore.settingDescription,
        playerAction,
        adventureStore.directive,
      )

      const narrativeResolved = resolveModel('adventure')
      const narrativeClient = LLMClientFactory.getClient(
        narrativeResolved.provider,
      )

      let accumulated = ''
      const narrativeResponse = narrativeClient.generate({
        model: narrativeResolved.model,
        messages: narrativeMessages,
        max_tokens: effectiveSettings.maxTokens,
        thinking_budget: effectiveSettings.thinkingBudget
          ? Math.min(
              effectiveSettings.thinkingBudget,
              Math.floor(effectiveSettings.maxTokens / 2),
            )
          : undefined,
        signal: abortController.signal,
        metadata: { callType: 'adventure' },
      })

      for await (const event of narrativeResponse) {
        if (event.type === 'chunk') {
          accumulated += event.text
          // Show streaming content (strip thinking tags for display)
          const displayContent = accumulated
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .replace(/<\/?narrative>/g, '')
            .trim()
          adventureStore.setStreamingContent(displayContent)
        }
      }

      const narrative = cleanNarrative(accumulated)

      // --- Step 2: Run director agent (silent) ---
      adventureStore.setStreamingContent(
        `${narrative}\n\n⏳ Updating the world...`,
      )

      const directorNotes = await runDirector({ playerAction, narrative })

      // --- Step 3: Generate world trajectory using fresh director notes ---
      adventureStore.setStreamingContent(
        `${narrative}\n\n⏳ Reading the world...`,
      )

      const trajectoryMessages = buildTrajectoryMessages(
        adventureStore.turns,
        narrative,
        playerAction,
        directorNotes,
        { directive: adventureStore.directive },
      )

      const trajectoryResolved = resolveModel('adventure-trajectory')
      const trajectoryClient = LLMClientFactory.getClient(
        trajectoryResolved.provider,
      )

      let trajectoryAccumulated = ''
      const trajectoryResponse = trajectoryClient.generate({
        model: trajectoryResolved.model,
        messages: trajectoryMessages,
        max_tokens: effectiveSettings.maxTokens,
        thinking_budget: effectiveSettings.thinkingBudget
          ? Math.min(
              effectiveSettings.thinkingBudget,
              Math.floor(effectiveSettings.maxTokens / 2),
            )
          : undefined,
        signal: abortController.signal,
        metadata: { callType: 'adventure-trajectory' },
      })

      for await (const event of trajectoryResponse) {
        if (event.type === 'chunk') {
          trajectoryAccumulated += event.text
        }
      }

      const { trajectory: worldTrajectory, dead } =
        parseTrajectory(trajectoryAccumulated)

      // Batch-finalize: clear streaming and add turn in one render frame
      adventureStore.finalizeTurn({
        playerAction,
        narrative,
        worldTrajectory,
        ...(dead ? { dead: true } : {}),
        ...(directorNotes ? { directorNotes } : {}),
      })
      persist()

      // Focus input for next action
      if (!dead) {
        requestAnimationFrame(() => {
          inputRef?.focus()
        })
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User aborted — if we have partial content, save it as narrative-only
        const partial = adventureStore.streamingContent
        if (partial) {
          const narrative = cleanNarrative(partial)
          adventureStore.finalizeAbort({
            playerAction,
            narrative,
            worldTrajectory: '(Interrupted)',
          })
          persist()
        } else {
          adventureStore.setStreamingContent('')
        }
      } else {
        const message =
          err instanceof Error ? err.message : 'Unknown error occurred'
        adventureStore.setError(message)
        adventureStore.setLastFailedAction(playerAction)
        console.error('Adventure generation error:', err)
      }
    } finally {
      adventureStore.setIsGenerating(false)
      adventureStore.setPendingAction(null)
      abortController = null
    }
  }

  // --- Director agent (background) ---

  async function runDirector(
    currentTurn?: { playerAction: string | null; narrative: string },
  ): Promise<string | undefined> {
    if (adventureStore.isDirectorRunning) return undefined

    adventureStore.setIsDirectorRunning(true)

    try {
      const directorResolved = resolveModel('adventure-director')
      const client = LLMClientFactory.getClient(directorResolved.provider)
      const messages = buildDirectorMessages(adventureStore.turns, currentTurn, adventureStore.directive)

      let accumulated = ''
      const response = client.generate({
        model: directorResolved.model,
        messages,
        max_tokens: effectiveSettings.maxTokens,
        thinking_budget: effectiveSettings.thinkingBudget
          ? Math.min(
              effectiveSettings.thinkingBudget,
              Math.floor(effectiveSettings.maxTokens / 2),
            )
          : undefined,
        metadata: { callType: 'adventure-director' },
      })

      for await (const event of response) {
        if (event.type === 'chunk') {
          accumulated += event.text
        }
      }

      // Clean up thinking tags
      const rawResponse = accumulated
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim()

      if (!rawResponse) return undefined

      // Check if we have previous notes — if so, the response is a diff
      const previousNotes = [...adventureStore.turns]
        .reverse()
        .find((t) => t.directorNotes)?.directorNotes

      if (previousNotes) {
        const result = processLLMDiffResponse(previousNotes, rawResponse)
        return result.resultContent || undefined
      }

      // First turn: response is the full notes
      return rawResponse
    } catch (err) {
      // Director failures are silent — they don't affect the player experience
      console.warn('Director agent error:', err)
      return undefined
    } finally {
      adventureStore.setIsDirectorRunning(false)
    }
  }

  // --- Handlers ---

  async function handleStart() {
    if (!effectiveSettings.model || !effectiveSettings.provider) {
      adventureStore.setError(
        'Please configure your AI provider and model first.',
      )
      return
    }

    let description = adventureStore.settingInput.trim()
    if (adventureStore.protagonistInput.trim()) {
      description += `\n\nPROTAGONIST: ${adventureStore.protagonistInput.trim()}`
    }
    adventureStore.setSettingDescription(description)
    adventureStore.setPhase('playing')
    persist()

    // Create adventure on backend if authenticated
    if (persistence.isBackendMode && !persistence.adventureId()) {
      try {
        const newId = await persistence.createAdventure(
          adventureStore.buildSnapshot(),
        )
        navigate(`/adventure/${newId}`, { replace: true })
      } catch (err) {
        console.error('Failed to create adventure on backend:', err)
        // Continue anyway — the adventure works, just isn't saved remotely
      }
    }

    // Start the adventure
    generate(null)
  }

  function handleSubmit() {
    const action = adventureStore.playerInput.trim()
    if (!action || adventureStore.isGenerating) return

    adventureStore.setPlayerInput('')
    // User just acted — they want to see what happens next
    adventureStore.setScrollLocked(true)
    generate(action)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleAbort() {
    abortController?.abort()
  }

  function handleRetry() {
    const action = adventureStore.lastFailedAction
    if (action === undefined) return
    generate(action)
  }

  function handleRegenerate() {
    if (adventureStore.isGenerating) return
    if (adventureStore.turns.length === 0) return

    const lastTurn = adventureStore.turns[adventureStore.turns.length - 1]
    const action = lastTurn.playerAction
    adventureStore.removeLastTurn()
    persist()
    generate(action)
  }

  async function handleRegenerateDirector() {
    if (adventureStore.isGenerating || adventureStore.isDirectorRunning) return
    if (adventureStore.turns.length === 0) return

    const turns = adventureStore.turns
    const lastTurn = turns[turns.length - 1]

    // Build a view of turns *without* the last turn's director notes,
    // so runDirector uses the previous turn's notes as the starting point
    // (same as if we were generating this turn fresh).
    const turnsWithoutLastDirector = turns.map((t, i) =>
      i === turns.length - 1 ? { ...t, directorNotes: undefined } : t,
    )

    // Temporarily swap turns so runDirector/buildDirectorMessages sees the right state
    const originalTurns = [...turns]
    adventureStore.setTurns(turnsWithoutLastDirector)

    try {
      adventureStore.setIsGenerating(true)

      // Step 1: Regenerate director notes
      const directorNotes = await runDirector({
        playerAction: lastTurn.playerAction,
        narrative: lastTurn.narrative,
      })

      // Restore turns and apply new director notes
      adventureStore.setTurns(originalTurns)
      if (directorNotes) {
        adventureStore.updateLastTurn({ directorNotes })
      }

      // Step 2: Regenerate trajectory using fresh director notes,
      // passing the old trajectory as rejected so the model produces something different
      const trajectoryMessages = buildTrajectoryMessages(
        // All turns except the last (buildTrajectoryMessages adds current turn itself)
        turns.slice(0, -1),
        lastTurn.narrative,
        lastTurn.playerAction,
        directorNotes,
        { rejectedTrajectory: lastTurn.worldTrajectory, directive: adventureStore.directive },
      )

      const trajectoryResolved = resolveModel('adventure-trajectory')
      const trajectoryClient = LLMClientFactory.getClient(
        trajectoryResolved.provider,
      )

      let trajectoryAccumulated = ''
      const trajectoryResponse = trajectoryClient.generate({
        model: trajectoryResolved.model,
        messages: trajectoryMessages,
        max_tokens: effectiveSettings.maxTokens,
        thinking_budget: effectiveSettings.thinkingBudget
          ? Math.min(
              effectiveSettings.thinkingBudget,
              Math.floor(effectiveSettings.maxTokens / 2),
            )
          : undefined,
        metadata: { callType: 'adventure-trajectory' },
      })

      for await (const event of trajectoryResponse) {
        if (event.type === 'chunk') {
          trajectoryAccumulated += event.text
        }
      }

      const { trajectory: worldTrajectory, dead } =
        parseTrajectory(trajectoryAccumulated)

      adventureStore.updateLastTurn({
        worldTrajectory,
        ...(dead ? { dead: true } : { dead: undefined }),
      })
      persist()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to regenerate director'
      adventureStore.setError(message)
      console.error('Director regeneration error:', err)
      // Restore original turns on error
      adventureStore.setTurns(originalTurns)
    } finally {
      adventureStore.setIsGenerating(false)
    }
  }

  function handleRewindTo(turnIndex: number) {
    if (adventureStore.isGenerating) return
    adventureStore.rewindTo(turnIndex)
    persist()
  }

  function handleReset() {
    abortController?.abort()
    adventureStore.reset()
    persistence.clearState()

    if (persistence.isBackendMode) {
      navigate('/adventure/new', { replace: true })
    }
  }

  async function handleGenerateSetting() {
    if (!effectiveSettings.model || !effectiveSettings.provider) {
      adventureStore.setError(
        'Please configure your AI provider and model first.',
      )
      return
    }

    adventureStore.setIsGeneratingSetting(true)
    adventureStore.setError(null)
    adventureStore.setSettingGenFailed(false)

    // Randomize unlocked knobs, keep locked ones
    const values = { ...adventureStore.knobValues }
    for (const knob of SETTING_KNOBS) {
      if (!adventureStore.knobLocks[knob.id]) {
        values[knob.id] = pickRandom(knob.options)
      }
    }
    adventureStore.setKnobValues(values)

    // Build the prompt from resolved values
    const paramLines = SETTING_KNOBS.map(
      (knob) => `- ${knob.label}: ${values[knob.id]}`,
    ).join('\n')

    try {
      const settingResolved = resolveModel('adventure-setting')
      const client = LLMClientFactory.getClient(settingResolved.provider)
      const messages: LLMMessage[] = [
        { role: 'system', content: SETTING_GEN_PROMPT },
        { role: 'user', content: `Parameters:\n${paramLines}` },
      ]

      let accumulated = ''
      let doneThinking = false
      const response = client.generate({
        model: settingResolved.model,
        messages,
        max_tokens: effectiveSettings.maxTokens,
        thinking_budget: effectiveSettings.thinkingBudget
          ? Math.min(
              effectiveSettings.thinkingBudget,
              Math.floor(effectiveSettings.maxTokens / 2),
            )
          : undefined,
        metadata: { callType: 'adventure-setting' },
      })

      for await (const event of response) {
        if (event.type === 'chunk') {
          accumulated += event.text

          // Track whether we've exited a <think> block
          if (accumulated.includes('</think>')) {
            doneThinking = true
          }

          // Stream into the textarea as it arrives (skip thinking content)
          if (doneThinking || !accumulated.includes('<think>')) {
            const display = accumulated
              .replace(/<think>[\s\S]*?<\/think>/g, '')
              .trim()
            if (display) {
              adventureStore.setSettingInput(display)
            }
          }
        }
      }

      // Final cleanup
      const cleaned = accumulated
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim()

      if (cleaned) {
        adventureStore.setSettingInput(cleaned)
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate setting'
      adventureStore.setError(message)
      adventureStore.setSettingGenFailed(true)
      console.error('Setting generation error:', err)
    } finally {
      adventureStore.setIsGeneratingSetting(false)
      persist()
    }
  }

  // --- Scroll management ---

  function onStoryAreaScroll() {
    if (!storyAreaRef) return
    const threshold = 32 // ~2 lines
    adventureStore.setScrollLocked(
      storyAreaRef.scrollHeight -
        storyAreaRef.scrollTop -
        storyAreaRef.clientHeight <
        threshold,
    )
  }

  function scrollToBottom() {
    if (storyAreaRef) {
      storyAreaRef.scrollTop = storyAreaRef.scrollHeight
    }
    adventureStore.setScrollLocked(true)
  }

  // --- Ref setters ---

  function setStoryAreaRef(el: HTMLDivElement) {
    storyAreaRef = el
  }

  function setInputRef(el: HTMLTextAreaElement) {
    inputRef = el
  }

  return {
    handleStart,
    handleSubmit,
    handleKeyDown,
    handleAbort,
    handleRetry,
    handleRegenerate,
    handleRegenerateDirector,
    handleRewindTo,
    handleReset,
    handleGenerateSetting,
    persist,
    setStoryAreaRef,
    setInputRef,
    onStoryAreaScroll,
    scrollToBottom,
  }
}
