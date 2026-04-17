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
  buildNonsenseCheckMessages,
  buildRevisionMessages,
  buildMomentumResolutionMessages,
  buildCompactionMessages,
  getCompactionRanges,
  cleanNarrative,
  parseTrajectory,
  sanitizeDirectorNotes,
} from './prompts'

// --- Engine interface & context ---

export interface AdventureEngine {
  handleStart: () => Promise<void>
  handleSubmit: () => void
  handleKeyDown: (e: KeyboardEvent) => void
  handleAbort: () => void
  handleRetry: () => void
  handleRegenerate: () => void
  handleEditAndRegenerate: (newAction: string) => void
  handleReviseNarrative: () => void
  handleRegenerateDirector: () => void
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

  // Cache the last momentum resolution so retries don't re-run it.
  // Keyed by turnCount + playerAction — if either changes, the cache is stale.
  let cachedMomentum: {
    turnCount: number
    playerAction: string
    resolved: string | null
  } | null = null

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
    adventureStore.setNonsenseWarning(null)
    adventureStore.setIsGenerating(true)
    adventureStore.setStreamingContent('')
    adventureStore.setPendingAction(playerAction)
    persistNow()

    abortController = new AbortController()

    try {
      // --- Step 0: Resolve momentum against player action ---
      // When world momentum is enabled and there's a previous turn with trajectory,
      // run a lightweight reasoning call to filter/adjust momentum items based on
      // what the player actually did, instead of dumping raw momentum into the narrative.
      // The result is cached so retries (same turn + same action) skip the LLM call.
      let resolvedMomentum: string | null | undefined
      const lastTurn = adventureStore.turns.length > 0
        ? adventureStore.turns[adventureStore.turns.length - 1]
        : null
      const turnCount = adventureStore.turns.length

      if (
        adventureStore.worldMomentumEnabled &&
        playerAction !== null &&
        lastTurn?.worldTrajectory
      ) {
        // Check cache — reuse if same turn count and player action
        if (
          cachedMomentum &&
          cachedMomentum.turnCount === turnCount &&
          cachedMomentum.playerAction === playerAction
        ) {
          resolvedMomentum = cachedMomentum.resolved
          console.log('[Momentum] Using cached resolution')
        } else {
          adventureStore.setStreamingContent('⏳ Resolving world momentum...')

          const momentumMessages = buildMomentumResolutionMessages(
            lastTurn.narrative,
            lastTurn.worldTrajectory,
            playerAction,
          )

          const momentumResolved = resolveModel('adventure-momentum')
          const momentumClient = LLMClientFactory.getClient(momentumResolved.provider)

          let momentumAccumulated = ''
          const momentumResponse = momentumClient.generate({
            model: momentumResolved.model,
            messages: momentumMessages,
            max_tokens: 1024,
            signal: abortController.signal,
            metadata: { callType: 'adventure-momentum' },
          })

          for await (const event of momentumResponse) {
            if (event.type === 'chunk') {
              momentumAccumulated += event.text
            }
          }

          const cleaned = momentumAccumulated
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .trim()

          if (cleaned === 'NONE' || !cleaned) {
            resolvedMomentum = null
            console.log('[Momentum] All momentum invalidated by player action')
          } else {
            resolvedMomentum = cleaned
            console.log('[Momentum] Resolved momentum:\n', cleaned)
          }

          // Cache for retries
          cachedMomentum = { turnCount, playerAction, resolved: resolvedMomentum }
        }
      }

      // --- Step 1: Stream narrative ---
      const narrativeMessages = buildNarrativeMessages(
        adventureStore.turns,
        adventureStore.settingDescription,
        playerAction,
        adventureStore.directive,
        adventureStore.compactions,
        resolvedMomentum,
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

      // If the model returned nothing (or only whitespace / thinking tags),
      // skip all downstream calls — there's nothing to analyse.
      if (!narrative) {
        adventureStore.setStreamingContent('')
        adventureStore.setError('The model returned an empty response. Try again or switch models.')
        adventureStore.setLastFailedAction(playerAction)
        return
      }

      // --- Step 1.5: Consistency check loop ---
      const checkedNarrative = await runNarrativeChecks(narrative, playerAction)

      let directorNotes: string | undefined
      let worldTrajectory = ''
      let dead = false

      if (adventureStore.worldMomentumEnabled) {
        // --- Step 2: Run director agent every 5 turns, or immediately if flagged ---
        const turnIndex = adventureStore.turns.length
        const shouldRunDirector = turnIndex % 5 === 0 || adventureStore.directorDueNextTurn

        if (shouldRunDirector) {
          adventureStore.setDirectorDueNextTurn(false)
          adventureStore.setStreamingContent(
            `${checkedNarrative}\n\n⏳ Updating the world...`,
          )
          directorNotes = await runDirector({ playerAction, narrative: checkedNarrative })
        }

        // --- Step 3: Generate world trajectory using fresh director notes ---
        adventureStore.setStreamingContent(
          `${checkedNarrative}\n\n⏳ Reading the world...`,
        )

        const trajectoryMessages = buildTrajectoryMessages(
          adventureStore.turns,
          checkedNarrative,
          playerAction,
          directorNotes,
          { directive: adventureStore.directive, compactions: adventureStore.compactions },
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

        const parsed = parseTrajectory(trajectoryAccumulated)
        worldTrajectory = parsed.trajectory
        dead = parsed.dead
      }

      // Batch-finalize: clear streaming and add turn in one render frame
      adventureStore.finalizeTurn({
        playerAction,
        narrative: checkedNarrative,
        worldTrajectory,
        ...(dead ? { dead: true } : {}),
        ...(directorNotes ? { directorNotes } : {}),
      })
      persist()

      // Run compaction in the background (non-blocking, fire-and-forget)
      runPendingCompactions()

      // Focus input for next action
      if (!dead) {
        requestAnimationFrame(() => {
          inputRef?.focus()
        })
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User aborted — if we have partial narrative content, save it
        const partial = adventureStore.streamingContent
        const narrative = partial ? cleanNarrative(partial) : ''
        if (narrative && !narrative.startsWith('⏳')) {
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
      adventureStore.setStreamingContent('')
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
      const messages = buildDirectorMessages(adventureStore.turns, currentTurn, adventureStore.directive, adventureStore.compactions)

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

      // Always full notes — sanitize in case the model misbehaves
      const sanitizedNotes = sanitizeDirectorNotes(rawResponse)
      console.log('[Director] Notes:\n', sanitizedNotes)
      return sanitizedNotes
    } catch (err) {
      // Director failures are silent — they don't affect the player experience
      console.warn('Director agent error:', err)
      return undefined
    } finally {
      adventureStore.setIsDirectorRunning(false)
    }
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

  // --- Narrative quality checks (consistency + nonsense, run in parallel) ---

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
  ): Promise<string> {
    // Nothing to check on the opening turn or if the narrative is empty/trivial
    if (adventureStore.turns.length === 0) return narrative
    if (!narrative || narrative.trim().length < 50) return narrative

    adventureStore.setStreamingContent(
      `${narrative}\n\n⏳ Checking narrative...`,
    )

    // Only check physical/logical sense — no full-history consistency check
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
      return narrative
    }

    // Store the warning for the user to review — don't auto-revise
    console.log('[Checks] Issues found (user will decide):\n', nonsenseIssues)
    adventureStore.setNonsenseWarning(nonsenseIssues)

    return narrative
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
        adventureStore.directive,
        adventureStore.compactions,
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

  function handleEditAndRegenerate(newAction: string) {
    if (adventureStore.isGenerating) return
    if (adventureStore.turns.length === 0) return

    adventureStore.removeLastTurn()
    persist()
    generate(newAction)
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
        { rejectedTrajectory: lastTurn.worldTrajectory, directive: adventureStore.directive, compactions: adventureStore.compactions },
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
    handleEditAndRegenerate,
    handleReviseNarrative,
    handleRegenerateDirector,
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
