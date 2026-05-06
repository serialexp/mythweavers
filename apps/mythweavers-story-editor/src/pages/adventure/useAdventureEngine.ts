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
  buildResolutionMessages,
  buildWorldStepMessages,
  buildNonsenseCheckMessages,
  buildRevisionMessages,
  buildCompactionMessages,
  getCompactionRanges,
  cleanNarrative,
  rollSteering,
  type SteeringBucket,
} from './prompts'

// --- Engine interface & context ---

export interface AdventureEngine {
  handleStart: () => Promise<void>
  handleSubmit: () => void
  handleKeyDown: (e: KeyboardEvent) => void
  handleAbort: () => void
  handleRetry: () => void
  handleRetryWorldStep: () => void
  handleAdvanceWorld: () => void
  handleRegenerate: () => void
  handleEditAndRegenerate: (newAction: string) => void
  handleReviseNarrative: () => void
  handleRewindTo: (turnIndex: number) => void
  handleReset: () => void
  handleGenerateSetting: () => Promise<void>
  handleCompactRange: (range: { start: number; end: number; key: string }) => void
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

  /**
   * Stream a single LLM generation into `streamingContent`. Returns the
   * cleaned narrative, or null if the model returned nothing (error surfaces
   * via streamErrors / empty-narrative handling by the caller).
   */
  async function streamPass(
    messages: LLMMessage[],
    callType: string,
  ): Promise<{ narrative: string; streamErrors: string[] }> {
    const resolved = resolveModel('adventure')
    const client = LLMClientFactory.getClient(resolved.provider)

    let accumulated = ''
    const streamErrors: string[] = []
    const response = client.generate({
      model: resolved.model,
      messages,
      max_tokens: effectiveSettings.maxTokens,
      thinking_budget: effectiveSettings.thinkingBudget
        ? Math.min(
            effectiveSettings.thinkingBudget,
            Math.floor(effectiveSettings.maxTokens / 2),
          )
        : undefined,
      signal: abortController!.signal,
      metadata: { callType },
    })

    for await (const event of response) {
      if (event.type === 'chunk') {
        accumulated += event.text
        const displayContent = accumulated
          .replace(/<think>[\s\S]*?<\/think>/g, '')
          .replace(/<\/?narrative>/g, '')
          .trim()
        adventureStore.setStreamingContent(displayContent)
      }
      if (event.type === 'error') {
        streamErrors.push((event as { type: 'error'; error: string }).error)
      }
    }

    return { narrative: cleanNarrative(accumulated), streamErrors }
  }

  /**
   * Run the world-step pass (pass 2). Assumes the resolution turn has
   * already been finalized onto `adventureStore.turns`. Caller is responsible
   * for managing `isGenerating` bracketing.
   *
   * Steering is intentionally NOT applied here — it scopes only to the
   * quality of the protagonist's action in pass 1.
   */
  async function runWorldStep() {
    adventureStore.setStreamingContent('')
    const messages = buildWorldStepMessages(
      adventureStore.turns,
      adventureStore.settingDescription,
      adventureStore.directive,
      adventureStore.compactions,
      adventureStore.worldBible,
    )

    const { narrative, streamErrors } = await streamPass(
      messages,
      'adventure-world-step',
    )

    if (streamErrors.length > 0 && !narrative) {
      adventureStore.setStreamingContent('')
      adventureStore.setError(`World step: ${streamErrors.join('\n')}`)
      return
    }

    if (!narrative) {
      adventureStore.setStreamingContent('')
      adventureStore.setError(
        'World step returned an empty response. You can retry the world step or continue.',
      )
      return
    }

    adventureStore.finalizeTurn({
      playerAction: null,
      narrative,
      kind: 'world-step',
    })
    persist()
  }

  async function generate(playerAction: string | null) {
    if (adventureStore.isGenerating) return

    adventureStore.setError(null)
    adventureStore.setLastFailedAction(undefined)
    adventureStore.setNonsenseWarning(null)
    adventureStore.setIsGenerating(true)
    adventureStore.setStreamingContent('')
    adventureStore.setPendingAction(playerAction)
    persistNow()

    // Roll steering once for this player input — applied ONLY to the
    // resolution pass, since steering scopes to the protagonist's action
    // execution. The world-step pass runs neutral. Opening turn has no
    // player action and no steering.
    const steering: SteeringBucket | undefined =
      playerAction !== null ? rollSteering() : undefined
    if (steering) {
      console.log(`[Steering] Rolled: ${steering}`)
    }

    abortController = new AbortController()

    try {
      // --- Pass 1: resolution ---
      const resolutionMessages = buildResolutionMessages(
        adventureStore.turns,
        adventureStore.settingDescription,
        playerAction,
        steering,
        adventureStore.directive,
        adventureStore.compactions,
        adventureStore.worldBible,
      )

      const { narrative, streamErrors } = await streamPass(
        resolutionMessages,
        'adventure',
      )

      if (streamErrors.length > 0 && !narrative) {
        adventureStore.setStreamingContent('')
        adventureStore.setError(streamErrors.join('\n'))
        adventureStore.setLastFailedAction(playerAction)
        if (playerAction) adventureStore.setPlayerInput(playerAction)
        return
      }

      if (!narrative) {
        adventureStore.setStreamingContent('')
        adventureStore.setError('The model returned an empty response. Try again or switch models.')
        adventureStore.setLastFailedAction(playerAction)
        if (playerAction) adventureStore.setPlayerInput(playerAction)
        return
      }

      // Finalize the resolution turn FIRST. The narrative is committed to
      // the turn list and persisted before any optional post-processing
      // runs, so a stuck or erroring nonsense check can no longer lose the
      // narrative on reload or abort. Opening turn is stored as 'resolution'
      // (acts as the establishing beat).
      adventureStore.finalizeTurn({
        playerAction,
        narrative,
        kind: 'resolution',
        ...(steering ? { steering } : {}),
      })
      persist()

      // --- Consistency check (nonsense) — optional, gated by user toggle ---
      // Runs after finalize so the narrative is already saved. Failures or
      // aborts here are non-fatal: the turn stays committed, we just drop
      // the spinner and move on.
      if (adventureStore.nonsenseCheckEnabled) {
        try {
          await runNarrativeChecks(narrative, playerAction)
        } catch (checkErr: unknown) {
          if (
            !(checkErr instanceof DOMException && checkErr.name === 'AbortError')
          ) {
            const message =
              checkErr instanceof Error ? checkErr.message : 'Nonsense check failed'
            console.warn('[Checks] Skipped due to error:', message)
          }
        } finally {
          adventureStore.setStreamingContent('')
        }
      }

      // --- Pass 2: world step (opt-in) ---
      // Skip for opening turn (no player action to react to) or when the
      // story toggle is off.
      const shouldAdvance =
        playerAction !== null && adventureStore.autoAdvanceWorld
      if (shouldAdvance) {
        // runWorldStep handles its own error surfacing; don't crash pass 1
        // if pass 2 misbehaves.
        adventureStore.setIsGenerating(true)
        try {
          await runWorldStep()
        } catch (worldErr: unknown) {
          if (worldErr instanceof DOMException && worldErr.name === 'AbortError') {
            const partial = adventureStore.streamingContent
            const wsNarrative = partial ? cleanNarrative(partial) : ''
            if (wsNarrative && !wsNarrative.startsWith('⏳')) {
              adventureStore.finalizeAbort({
                playerAction: null,
                narrative: wsNarrative,
                kind: 'world-step',
              })
              persist()
            } else {
              adventureStore.setStreamingContent('')
            }
          } else {
            const message =
              worldErr instanceof Error ? worldErr.message : 'World step failed'
            adventureStore.setError(`World step: ${message}`)
            console.error('World step error:', worldErr)
          }
        }
      }

      // Run compaction in the background (non-blocking)
      runPendingCompactions()

      // Focus input for next action
      requestAnimationFrame(() => {
        inputRef?.focus()
      })
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User aborted during pass 1 — if we have partial narrative, save it
        const partial = adventureStore.streamingContent
        const narrative = partial ? cleanNarrative(partial) : ''
        if (narrative && !narrative.startsWith('⏳')) {
          adventureStore.finalizeAbort({
            playerAction,
            narrative,
            kind: 'resolution',
            ...(steering ? { steering } : {}),
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
        if (playerAction) adventureStore.setPlayerInput(playerAction)
        console.error('Adventure generation error:', err)
      }
    } finally {
      adventureStore.setIsGenerating(false)
      adventureStore.setStreamingContent('')
      adventureStore.setPendingAction(null)
      abortController = null
    }
  }

  /**
   * Manually trigger pass 2 on the current last turn. Only valid when the
   * last turn is a resolution with no following world-step and we're idle.
   */
  async function handleAdvanceWorld() {
    if (adventureStore.isGenerating) return
    const turns = adventureStore.turns
    if (turns.length === 0) return
    const last = turns[turns.length - 1]
    const lastKind = last.kind ?? 'resolution'
    if (lastKind !== 'resolution') return
    // Opening turn has no player action and is not a valid base.
    if (last.playerAction === null) return

    adventureStore.setError(null)
    adventureStore.setIsGenerating(true)
    adventureStore.setStreamingContent('')
    abortController = new AbortController()

    try {
      await runWorldStep()
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        const partial = adventureStore.streamingContent
        const wsNarrative = partial ? cleanNarrative(partial) : ''
        if (wsNarrative && !wsNarrative.startsWith('⏳')) {
          adventureStore.finalizeAbort({
            playerAction: null,
            narrative: wsNarrative,
            kind: 'world-step',
          })
          persist()
        } else {
          adventureStore.setStreamingContent('')
        }
      } else {
        const message =
          err instanceof Error ? err.message : 'World step failed'
        adventureStore.setError(`World step: ${message}`)
        console.error('World step error:', err)
      }
    } finally {
      adventureStore.setIsGenerating(false)
      adventureStore.setStreamingContent('')
      abortController = null
    }
  }

  /**
   * Re-run the world step. If the last turn is a stalled/failed world-step,
   * pop it first so we don't stack. Otherwise behaves like handleAdvanceWorld.
   */
  async function handleRetryWorldStep() {
    if (adventureStore.isGenerating) return
    const turns = adventureStore.turns
    if (turns.length === 0) return
    const last = turns[turns.length - 1]
    if ((last.kind ?? 'resolution') === 'world-step') {
      adventureStore.removeLastTurn()
      persist()
    }
    await handleAdvanceWorld()
  }

  // --- Compaction (background, non-blocking) ---

  /** Generate a compaction summary for a single range. */
  async function compactRange(range: { start: number; end: number; key: string }) {
    if (adventureStore.isCompacting(range.key)) return
    adventureStore.setCompactingKey(range.key, true)

    try {
      console.log(`[Compaction] Generating summary for turns ${range.start}–${range.end}`)

      const resolved = resolveModel('adventure-compaction')
      const client = LLMClientFactory.getClient(resolved.provider)
      const messages = buildCompactionMessages(adventureStore.turns, range)

      let accumulated = ''
      const response = client.generate({
        model: resolved.model,
        messages,
        max_tokens: effectiveSettings.maxTokens,
        thinking_budget: effectiveSettings.thinkingBudget
          ? Math.min(
              effectiveSettings.thinkingBudget,
              Math.floor(effectiveSettings.maxTokens / 2),
            )
          : undefined,
        metadata: { callType: 'adventure-compaction' },
      })

      for await (const event of response) {
        if (event.type === 'chunk') {
          accumulated += event.text
        }
      }

      const summary = accumulated
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/^#+\s+[^\n]+\n+/gm, '')
        .replace(/^(Story\s+)?Summary\s*:\s*/i, '')
        .trim()

      if (summary) {
        adventureStore.setCompaction(range.key, {
          summary,
          generatedAt: new Date().toISOString(),
        })
        persist()
        console.log(`[Compaction] Saved summary for ${range.key} (${summary.length} chars)`)
      }
    } catch (err) {
      console.warn(`[Compaction] Failed for range ${range.key}:`, err)
    } finally {
      adventureStore.setCompactingKey(range.key, false)
    }
  }

  /**
   * Check if any new compaction ranges need summaries and generate them.
   * Runs after turn finalization — failures are silent.
   */
  async function runPendingCompactions() {
    const ranges = getCompactionRanges(adventureStore.turns.length)
    const pending = ranges.filter((r) => !adventureStore.compactions[r.key])
    for (const range of pending) {
      await compactRange(range)
    }
  }

  // --- Narrative quality checks (nonsense only) ---

  /** Run a single check agent and return its issues (empty string = passed) */
  async function runSingleCheck(
    label: string,
    messages: LLMMessage[],
    callType: string,
  ): Promise<string> {
    const resolved = resolveModel(callType)
    const client = LLMClientFactory.getClient(resolved.provider)

    let accumulated = ''
    const response = client.generate({
      model: resolved.model,
      messages,
      max_tokens: effectiveSettings.maxTokens,
      thinking_budget: effectiveSettings.thinkingBudget
        ? Math.min(
            effectiveSettings.thinkingBudget,
            Math.floor(effectiveSettings.maxTokens / 2),
          )
        : undefined,
      signal: abortController!.signal,
      metadata: { callType },
    })

    for await (const event of response) {
      if (event.type === 'chunk') {
        accumulated += event.text
      }
    }

    const result = accumulated
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .trim()

    console.log(`[${label}] Analysis result:\n`, result)

    if (result.startsWith('CONSISTENT')) {
      console.log(`[${label}] Passed`)
      return ''
    }

    const issues = result.replace(/^INCONSISTENT\s*/i, '').trim()
    if (!issues) {
      console.log(`[${label}] Said INCONSISTENT but gave no specifics — treating as passed`)
      return ''
    }

    return issues
  }

  async function runNarrativeChecks(
    narrative: string,
    _playerAction: string | null,
  ): Promise<void> {
    // Nothing to check on the opening turn (turns list is still empty here
    // because the just-generated opening narrative was the first finalize)
    // or if the narrative is empty/trivial. The turn list now includes the
    // narrative being checked, so use length<=1 as the opening guard.
    if (adventureStore.turns.length <= 1) return
    if (!narrative || narrative.trim().length < 50) return

    // The narrative is already a committed turn at this point; show only a
    // spinner, not the narrative text again.
    adventureStore.setStreamingContent('⏳ Checking narrative...')

    const nonsenseIssues = await runSingleCheck(
      'Nonsense',
      buildNonsenseCheckMessages(
        narrative,
        adventureStore.settingDescription,
        adventureStore.directive,
      ),
      'adventure-nonsense',
    )

    if (!nonsenseIssues) {
      console.log('[Checks] Narrative passed all checks')
      adventureStore.setNonsenseWarning(null)
      return
    }

    // Store the warning for the user to review — don't auto-revise
    console.log('[Checks] Issues found (user will decide):\n', nonsenseIssues)
    adventureStore.setNonsenseWarning(nonsenseIssues)
  }

  /** Revise the latest turn's narrative based on the nonsense warning. Called on user request. */
  async function handleReviseNarrative() {
    if (adventureStore.isGenerating) return
    if (adventureStore.turns.length === 0) return
    if (!adventureStore.nonsenseWarning) return

    const lastTurn = adventureStore.turns[adventureStore.turns.length - 1]
    const nonsenseIssues = adventureStore.nonsenseWarning

    adventureStore.setIsGenerating(true)
    adventureStore.setStreamingContent('⏳ Revising narrative...')
    abortController = new AbortController()

    try {
      const revisionMessages = buildRevisionMessages(
        adventureStore.turns.slice(0, -1),
        adventureStore.settingDescription,
        lastTurn.playerAction,
        lastTurn.narrative,
        nonsenseIssues,
        lastTurn.steering,
        lastTurn.kind ?? 'resolution',
        adventureStore.directive,
        adventureStore.compactions,
        adventureStore.worldBible,
      )

      const revisionResolved = resolveModel('adventure-revision')
      const revisionClient = LLMClientFactory.getClient(
        revisionResolved.provider,
      )

      let revisionAccumulated = ''
      const revisionResponse = revisionClient.generate({
        model: revisionResolved.model,
        messages: revisionMessages,
        max_tokens: effectiveSettings.maxTokens,
        thinking_budget: effectiveSettings.thinkingBudget
          ? Math.min(
              effectiveSettings.thinkingBudget,
              Math.floor(effectiveSettings.maxTokens / 2),
            )
          : undefined,
        signal: abortController!.signal,
        metadata: { callType: 'adventure-revision' },
      })

      for await (const event of revisionResponse) {
        if (event.type === 'chunk') {
          revisionAccumulated += event.text
          const displayContent = revisionAccumulated
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .replace(/<\/?narrative>/g, '')
            .trim()
          adventureStore.setStreamingContent(displayContent)
        }
      }

      const revisedNarrative = cleanNarrative(revisionAccumulated)
      if (revisedNarrative) {
        adventureStore.updateLastTurn({ narrative: revisedNarrative })
        adventureStore.setNonsenseWarning(null)
        persist()
      }
    } catch (err) {
      console.error('[Revision] Error:', err)
      adventureStore.setError(
        err instanceof Error ? err.message : 'Failed to revise narrative',
      )
    } finally {
      adventureStore.setIsGenerating(false)
      adventureStore.setStreamingContent('')
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
    adventureStore.setPlayerInput('')
    generate(action)
  }

  function handleRegenerate() {
    if (adventureStore.isGenerating) return
    if (adventureStore.turns.length === 0) return

    const lastTurn = adventureStore.turns[adventureStore.turns.length - 1]
    const lastKind = lastTurn.kind ?? 'resolution'

    if (lastKind === 'world-step') {
      // Pop just the world-step and re-fire pass 2. World-step passes are
      // not steered, so no per-turn state needs to be replayed.
      adventureStore.removeLastTurn()
      persist()
      handleAdvanceWorld()
      return
    }

    // Resolution (or legacy): pop it and re-fire the whole pipeline. If the
    // turn right before it was a world-step from an earlier player input,
    // leave that in place — regenerate only reruns the most recent input.
    const action = lastTurn.playerAction
    adventureStore.removeLastTurn()
    persist()
    generate(action)
  }

  function handleEditAndRegenerate(newAction: string) {
    if (adventureStore.isGenerating) return
    if (adventureStore.turns.length === 0) return

    adventureStore.removeLastTurn()
    persist()
    generate(newAction)
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
    handleRetryWorldStep,
    handleAdvanceWorld,
    handleRegenerate,
    handleEditAndRegenerate,
    handleReviseNarrative,
    handleRewindTo,
    handleReset,
    handleGenerateSetting,
    handleCompactRange: compactRange,
    persist,
    setStoryAreaRef,
    setInputRef,
    onStoryAreaScroll,
    scrollToBottom,
  }
}
