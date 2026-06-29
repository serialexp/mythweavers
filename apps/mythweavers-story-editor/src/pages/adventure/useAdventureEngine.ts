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
  buildDirectorMessages,
  buildNonsenseCheckMessages,
  buildRevisionMessages,
  buildCompactionMessages,
  buildAnalysisMessages,
  buildSynthesisMessages,
  buildStorylineGateMessages,
  buildPartnerActionMessages,
  parseSplitNarrative,
  getCompactionRanges,
  cleanNarrative,
  rollSteering,
  ANALYSIS_TOOLS,
  type SteeringBucket,
} from './prompts'
import { applyAnalysisToolCall } from './applyAnalysisToolCall'

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
  /** Manually re-run the analysis pass against the existing world state + last turns. */
  runAnalysisPass: () => Promise<void>
  /** Manually re-run the synthesis pass (rebuild the global storyline). */
  runSynthesisPass: () => Promise<void>
  /** Approve the in-flight storyline-gate brief and continue generation. */
  acceptGateBrief: () => void
  /** Reject the in-flight storyline-gate brief and continue without arc context. */
  rejectGateBrief: () => void
  handleEditAndRegenerate: (newAction: string) => void
  /** Replace the last turn's narrative text in-place (no regeneration). */
  handleEditNarrative: (newNarrative: string, field?: 'narrative' | 'deuteragonistNarrative') => void
  /** Edit the setting description and optionally regenerate the opening turn. */
  handleEditSetting: (newSetting: string) => void
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

  /**
   * Resolver for the in-flight storyline-gate approval, if any. Set when
   * the gate brief is shown to the user and the engine is parked waiting
   * for a decision. Cleared as soon as accept/reject/cancel fires.
   * - accept: resolves with the (possibly edited) brief string
   * - reject: resolves with undefined (proceed without arc context)
   * - cancel: rejects with an AbortError (engine catches it like any
   *   other abort and unwinds the turn cleanly)
   */
  let gateApprovalResolve:
    | ((brief: string | undefined) => void)
    | null = null
  let gateApprovalReject: ((reason: unknown) => void) | null = null

  function clearPendingGateApproval() {
    gateApprovalResolve = null
    gateApprovalReject = null
    adventureStore.setPendingGateBrief(null, null)
  }

  onCleanup(() => {
    abortController?.abort()
    if (gateApprovalReject) {
      gateApprovalReject(new DOMException('cleanup', 'AbortError'))
      clearPendingGateApproval()
    }
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
   * Returns the live world state object passed to writer/director/revision
   * prompt builders — or `undefined` when the living-world subsystem is
   * disabled. The four prompt builders all treat `liveWorldState` as
   * optional and skip the `appendLiveWorldState` injection if undefined,
   * so this is the single chokepoint that cleanly elides the characters /
   * plot points / agenda block from every prompt when the toggle is off.
   *
   * (Internal usages inside `runAnalysisPass` / `runSynthesisPass` build
   * the same object directly — those passes themselves are gated above
   * and won't run when the toggle is off, so their construction site
   * doesn't need this guard.)
   */
  function liveWorldStateForPrompt() {
    if (!adventureStore.livingWorldEnabled) return undefined
    return {
      characters: adventureStore.characters,
      plotPoints: adventureStore.plotPoints,
      agenda: adventureStore.agenda,
    }
  }

  /**
   * Run the optional "director" pass: a grounded analysis-class model that
   * produces a numbered BEATS plan for the writer call that follows. Output is
   * NOT streamed to the UI — the brief is plumbing for the writer, and
   * we keep the visible streaming block tied to actual prose.
   *
   * Returns the trimmed plan text, or `undefined` if the call fails
   * non-fatally. Aborts propagate (AbortError) so the parent try/catch
   * around `generate()` handles them uniformly.
   *
   * Errors here are intentionally non-fatal — the writer can still run
   * un-briefed (same behaviour as when the toggle is off), so a transient
   * provider hiccup on the director shouldn't cost the player their turn.
   */
  async function runDirector(
    playerAction: string | null,
    kind: 'resolution' | 'world-step',
    steering: SteeringBucket | undefined,
    storylineBrief: string | undefined,
  ): Promise<string | undefined> {
    const resolved = resolveModel('adventure-director')
    const client = LLMClientFactory.getClient(resolved.provider)

    const messages = buildDirectorMessages(
      adventureStore.turns,
      adventureStore.settingDescription,
      playerAction,
      steering,
      kind,
      adventureStore.directive,
      adventureStore.compactions,
      adventureStore.worldBible,
      liveWorldStateForPrompt(),
      storylineBrief,
    )

    let accumulated = ''
    try {
      const response = client.generate({
        model: resolved.model,
        messages,
        max_tokens: resolved.maxTokens,
        thinking_budget: resolved.thinkingBudget
          ? Math.min(
              resolved.thinkingBudget,
              Math.floor(resolved.maxTokens / 2),
            )
          : undefined,
        signal: abortController!.signal,
        metadata: { callType: 'adventure-director' },
      })

      for await (const event of response) {
        if (event.type === 'chunk') {
          accumulated += event.text
        }
        if (event.type === 'error') {
          // Mid-stream provider errors abort the director pass but don't
          // abort the parent — we fall through to the empty-result path.
          console.warn(
            '[Director] Stream error, skipping brief:',
            (event as { type: 'error'; error: string }).error,
          )
          accumulated = ''
          break
        }
      }
    } catch (err) {
      // Re-throw aborts so the parent generate()/runWorldStep() catch
      // handles them like any other aborted call.
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      const message = err instanceof Error ? err.message : 'Director call failed'
      console.warn('[Director] Skipped due to error:', message)
      return undefined
    }

    // Strip thinking tags / stray XML the model may have introduced. Don't
    // run the full `cleanNarrative` (it's tuned for prose); just strip
    // <think> blocks and trim.
    const brief = accumulated.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    return brief.length > 0 ? brief : undefined
  }

  /**
   * Stream a single LLM generation into `streamingContent`. Returns the
   * cleaned narrative, or null if the model returned nothing (error surfaces
   * via streamErrors / empty-narrative handling by the caller).
   */
  async function streamPass(
    messages: LLMMessage[],
    callType: string,
  ): Promise<{ narrative: string; raw: string; streamErrors: string[] }> {
    const resolved = resolveModel('adventure')
    const client = LLMClientFactory.getClient(resolved.provider)

    let accumulated = ''
    const streamErrors: string[] = []
    const response = client.generate({
      model: resolved.model,
      messages,
      max_tokens: resolved.maxTokens,
      thinking_budget: resolved.thinkingBudget
        ? Math.min(
            resolved.thinkingBudget,
            Math.floor(resolved.maxTokens / 2),
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
          .replace(/<\/?(?:narrative|protagonist|deuteragonist)>/g, '')
          .trim()
        adventureStore.setStreamingContent(displayContent)
      }
      if (event.type === 'error') {
        streamErrors.push((event as { type: 'error'; error: string }).error)
      }
    }

    return { narrative: cleanNarrative(accumulated), raw: accumulated, streamErrors }
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
    adventureStore.setStreamingKind('world-step')

    // Storyline gate — independently filtered for the world-step beat
    // (no player action; the gate sees the just-finalized resolution
    // narrative as the most recent turn in history). The brief here may
    // be a different slice than the resolution brief — the world is
    // reacting, not the protagonist.
    const worldStepStorylineBrief = await runStorylineGate(null, 'world-step')

    // Optional director pass — grounded plan for the writer to render.
    // No steering on world-step (the world is neutral). Failures are
    // non-fatal: writer just runs un-briefed.
    const worldStepDirectorBrief = adventureStore.directorEnabled
      ? await runDirector(null, 'world-step', undefined, worldStepStorylineBrief)
      : undefined

    const messages = buildWorldStepMessages(
      adventureStore.turns,
      adventureStore.settingDescription,
      adventureStore.directive,
      adventureStore.compactions,
      adventureStore.worldBible,
      liveWorldStateForPrompt(),
      worldStepStorylineBrief,
      worldStepDirectorBrief,
      adventureStore.protagonistInput || undefined,
      adventureStore.deuteragonistInput || undefined,
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
      ...(worldStepDirectorBrief ? { directorBrief: worldStepDirectorBrief } : {}),
    })
    persist()
  }

  /**
   * Run the deuteragonist action call: ask the LLM what the partner
   * character wants to do this turn, given the story so far, their
   * personality, and what the player just did.
   *
   * Returns the action text, or undefined if the call fails non-fatally
   * (the resolution pass proceeds without a partner action). Aborts
   * propagate so the parent catch in generate() handles them uniformly.
   */
  async function runPartnerAction(
    playerAction: string,
  ): Promise<string | undefined> {
    const deuteragonistInput = adventureStore.deuteragonistInput.trim()
    if (!deuteragonistInput) return undefined

    const resolved = resolveModel('adventure-analysis')
    const client = LLMClientFactory.getClient(resolved.provider)

    const messages = buildPartnerActionMessages(
      adventureStore.turns,
      adventureStore.settingDescription,
      playerAction,
      deuteragonistInput,
      adventureStore.compactions,
      adventureStore.worldBible,
      liveWorldStateForPrompt(),
    )

    let accumulated = ''
    try {
      const response = client.generate({
        model: resolved.model,
        messages,
        max_tokens: resolved.maxTokens,
        thinking_budget: resolved.thinkingBudget
          ? Math.min(
              resolved.thinkingBudget,
              Math.floor(resolved.maxTokens / 2),
            )
          : undefined,
        signal: abortController!.signal,
        metadata: { callType: 'adventure-partner-action' },
      })

      for await (const event of response) {
        if (event.type === 'chunk') {
          accumulated += event.text
        }
        if (event.type === 'error') {
          console.warn(
            '[Partner] Stream error, skipping partner action:',
            (event as { type: 'error'; error: string }).error,
          )
          accumulated = ''
          break
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      const message = err instanceof Error ? err.message : 'Partner action call failed'
      console.warn('[Partner] Skipped due to error:', message)
      return undefined
    }

    const action = accumulated.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    return action.length > 0 ? action : undefined
  }

  async function generate(playerAction: string | null) {
    if (adventureStore.isGenerating) return

    adventureStore.setError(null)
    adventureStore.setLastFailedAction(undefined)
    adventureStore.setNonsenseWarning(null)
    adventureStore.setIsGenerating(true)
    adventureStore.setStreamingContent('')
    adventureStore.setStreamingKind('resolution')
    adventureStore.setPendingAction(playerAction)
    persistNow()

    // Roll steering once for this player input — applied ONLY to the
    // resolution pass, since steering scopes to the protagonist's action
    // execution. The world-step pass runs neutral. Opening turn has no
    // player action and no steering. The user can disable steering
    // entirely via `steeringEnabled` (in which case every action resolves
    // at face value, like a permanent `steady` roll without the prompt
    // overhead).
    const steering: SteeringBucket | undefined =
      playerAction !== null && adventureStore.steeringEnabled
        ? rollSteering()
        : undefined
    if (steering) {
      console.log(`[Steering] Rolled: ${steering}`)
    }
    // Reflect the steering bucket in the streaming block so the chip is
    // already in place when content starts arriving — finalize then
    // doesn't introduce a chip-shaped height jump.
    adventureStore.setStreamingSteering(steering)

    abortController = new AbortController()

    // Declared outside the try block so the AbortError catch below can
    // attach metadata to a partial-aborted resolution turn (data that was
    // finalized BEFORE the stream that got aborted is still the honest
    // record of intent).
    let resolutionDirectorBrief: string | undefined
    let partnerAction: string | undefined
    let deuteragonistNarrative: string | undefined
    let resolutionNarrative: string | undefined

    try {
      // --- Deuteragonist action (pre-resolution) ---
      // Ask the LLM what the partner character wants to do, given the
      // story state, their personality, and the player's action. Runs
      // before the resolution so both actions can be woven together.
      // Only when a deuteragonist is configured and this is not the
      // opening turn. Failures are non-fatal — the resolution proceeds
      // without a partner action.
      if (playerAction !== null && adventureStore.deuteragonistInput.trim() && adventureStore.deuteragonistActive) {
        adventureStore.setStreamingPartnerAction('…')
        const pa = await runPartnerAction(playerAction)
        if (pa) {
          partnerAction = pa
          adventureStore.setStreamingPartnerAction(pa)
        } else {
          adventureStore.setStreamingPartnerAction(null)
        }
      }

      // --- Storyline gate (pre-resolution) ---
      // Filter the author-side storyline against the player's intended
      // action and the current world state. The narrative pass sees only
      // the resulting brief — never the full arc.
      const resolutionStorylineBrief = await runStorylineGate(playerAction, 'resolution')

      // --- Optional director pass (pre-resolution) ---
      // Skipped for the opening turn (no player action to direct yet).
      // Failures are non-fatal — the writer just runs un-briefed.
      resolutionDirectorBrief =
        adventureStore.directorEnabled && playerAction !== null
          ? await runDirector(playerAction, 'resolution', steering, resolutionStorylineBrief)
          : undefined

      // --- Pass 1: resolution ---
      const resolutionMessages = buildResolutionMessages(
        adventureStore.turns,
        adventureStore.settingDescription,
        playerAction,
        steering,
        adventureStore.directive,
        adventureStore.compactions,
        adventureStore.worldBible,
        liveWorldStateForPrompt(),
        resolutionStorylineBrief,
        resolutionDirectorBrief,
        partnerAction,
        adventureStore.protagonistInput || undefined,
        adventureStore.deuteragonistInput || undefined,
        adventureStore.partySplit || undefined,
      )

      const { narrative, raw, streamErrors } = await streamPass(
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

      resolutionNarrative = narrative

      // --- Parse split narrative (when party is split) ---
      // The resolution pass generates both protagonist and deuteragonist
      // narratives in a single response wrapped in XML tags. Parse them out.
      // Use `raw` (before cleanNarrative strips tags) so the XML markers
      // are still present.
      if (
        adventureStore.partySplit &&
        playerAction !== null &&
        adventureStore.deuteragonistInput.trim() &&
        adventureStore.deuteragonistActive
      ) {
        const split = parseSplitNarrative(raw)
        resolutionNarrative = split.protagonist
        deuteragonistNarrative = split.deuteragonist
      }

      // Finalize the resolution turn. The narrative is committed to
      // the turn list and persisted before any optional post-processing
      // runs, so a stuck or erroring nonsense check can no longer lose the
      // narrative on reload or abort. Opening turn is stored as 'resolution'
      // (acts as the establishing beat). When the party is split, both the
      // protagonist and deuteragonist narratives are stored.
      adventureStore.finalizeTurn({
        playerAction,
        narrative: resolutionNarrative,
        kind: 'resolution',
        ...(steering ? { steering } : {}),
        ...(resolutionDirectorBrief ? { directorBrief: resolutionDirectorBrief } : {}),
        ...(partnerAction ? { partnerAction } : {}),
        ...(deuteragonistNarrative ? { deuteragonistNarrative } : {}),
      })
      persist()

      // --- Consistency check (nonsense) — optional, gated by user toggle ---
      // Runs after finalize so the narrative is already saved. Failures or
      // aborts here are non-fatal: the turn stays committed, we just drop
      // the spinner and move on.
      if (adventureStore.nonsenseCheckEnabled) {
        try {
          await runNarrativeChecks(resolutionNarrative, playerAction)
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

      // Run analysis + compaction in the background (non-blocking).
      // Analysis goes first so the next turn's prompt sees fresh world
      // state; compaction is purely retrospective and order doesn't matter.
      // Synthesis chains AFTER analysis so it sees the freshly-seeded /
      // patched plot points + characters this turn produced. All three
      // are fire-and-forget; we don't await.
      if (adventureStore.livingWorldEnabled) {
        runAnalysisPass()
          .then(() => runSynthesisPass())
          .catch((err) => {
            console.warn('[Analysis→Synthesis] chain error:', err)
          })
      }
      runPendingCompactions()

      // Focus input for next action
      requestAnimationFrame(() => {
        inputRef?.focus()
      })
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User aborted — if we have partial narrative, save it.
        // If party is split, parse the partial to capture both narratives.
        const partial = adventureStore.streamingContent
        const partialNarrative = partial ? cleanNarrative(partial) : ''

        if (partialNarrative && !partialNarrative.startsWith('⏳')) {
          let protagonistNarrative = resolutionNarrative ?? partialNarrative
          let deutNarrative = deuteragonistNarrative

          if (
            adventureStore.partySplit &&
            playerAction !== null
          ) {
            const split = parseSplitNarrative(partialNarrative)
            protagonistNarrative = split.protagonist || protagonistNarrative
            deutNarrative = split.deuteragonist || deutNarrative
          }

          adventureStore.finalizeAbort({
            playerAction,
            narrative: protagonistNarrative,
            kind: 'resolution',
            ...(steering ? { steering } : {}),
            ...(resolutionDirectorBrief ? { directorBrief: resolutionDirectorBrief } : {}),
            ...(partnerAction ? { partnerAction } : {}),
            ...(deutNarrative ? { deuteragonistNarrative: deutNarrative } : {}),
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
      adventureStore.setStreamingKind(null)
      adventureStore.setStreamingSteering(undefined)
      adventureStore.setStreamingPartnerAction(null)
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
      adventureStore.setStreamingKind(null)
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
        max_tokens: resolved.maxTokens,
        thinking_budget: resolved.thinkingBudget
          ? Math.min(
              resolved.thinkingBudget,
              Math.floor(resolved.maxTokens / 2),
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
   * Background analysis pass — feeds the most recent narrative + current
   * world state to the cheap analysis model and applies any tool calls it
   * emits. Non-blocking, runs after a resolution turn finalizes. Failures
   * are non-fatal (state simply doesn't update this turn). Aborts cleanly
   * when the model doesn't support tool calls (e.g. Anthropic, Ollama).
   *
   * The analysis call is gated by:
   *   - At least one turn on the books (nothing to analyze on the empty state)
   *   - The user hasn't disabled it via the toggle (analysisPassEnabled)
   *
   * The model is whatever the user has assigned to `adventure-analysis`,
   * which falls under the `analysis` category in resolveModel.
   */
  async function runAnalysisPass() {
    if (!adventureStore.livingWorldEnabled) return
    if (adventureStore.isAnalyzing) return
    const turns = adventureStore.turns
    if (turns.length === 0) return

    // Feed the last several turns of narrative — wide enough that the
    // analyzer can ground a newly-introduced character in how they
    // actually showed up in the story (entrance, dialogue, prior beats),
    // not just react to the most recent paragraph. Walk back from the end
    // and stop when we have ~6000 chars (~4-6 turns, rough budget).
    const recentParts: string[] = []
    let chars = 0
    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i]
      if (t.playerAction) {
        recentParts.unshift(`> ${t.playerAction}`)
      }
      recentParts.unshift(t.narrative)
      chars += t.narrative.length
      if (chars >= 6000) break
    }
    const recentNarrative = recentParts.join('\n\n')
    if (!recentNarrative.trim()) return

    const liveWorldState = {
      characters: adventureStore.characters,
      plotPoints: adventureStore.plotPoints,
      agenda: adventureStore.agenda,
    }

    adventureStore.setIsAnalyzing(true)
    try {
      const resolved = resolveModel('adventure-analysis')
      const client = LLMClientFactory.getClient(resolved.provider)
      const messages = buildAnalysisMessages(
        recentNarrative,
        liveWorldState,
        adventureStore.protagonistInput,
        {
          settingDescription: adventureStore.settingDescription,
          worldBible: adventureStore.worldBible,
        },
      )

      console.log(
        `[Analysis] Running with ${resolved.provider}/${resolved.model}`,
      )

      const response = client.generate({
        model: resolved.model,
        messages,
        max_tokens: resolved.maxTokens,
        thinking_budget: resolved.thinkingBudget
          ? Math.min(
              resolved.thinkingBudget,
              Math.floor(resolved.maxTokens / 2),
            )
          : undefined,
        tools: ANALYSIS_TOOLS,
        tool_choice: 'auto',
        metadata: { callType: 'adventure-analysis' },
      })

      const opCount = { applied: 0, noop: 0, failed: 0 }
      for await (const event of response) {
        if (event.type === 'tool_call') {
          const at = new Date().toISOString()
          try {
            const outcome = applyAnalysisToolCall(event.name, event.arguments)
            adventureStore.appendAnalysisLog({
              at,
              tool: event.name,
              args: event.arguments,
              status: outcome.status,
              summary: outcome.summary,
            })
            if (outcome.status === 'applied') opCount.applied++
            else opCount.noop++
          } catch (err: unknown) {
            opCount.failed++
            const message =
              err instanceof Error ? err.message : 'Failed to apply tool call'
            adventureStore.appendAnalysisLog({
              at,
              tool: event.name,
              args: event.arguments,
              status: 'failed',
              summary: `Failed: ${message}`,
              error: message,
            })
            console.warn(
              `[Analysis] Failed to apply ${event.name}:`,
              message,
              event.arguments,
            )
          }
        }
        // We deliberately ignore `chunk` events — the analysis model's
        // prose response is a turn-summary at best and we don't show it.
      }

      if (opCount.applied > 0 || opCount.noop > 0 || opCount.failed > 0) {
        console.log(
          `[Analysis] ${opCount.applied} applied, ${opCount.noop} no-op, ${opCount.failed} failed`,
        )
        persist()
      } else {
        console.log('[Analysis] No tool calls this turn')
      }
    } catch (err: unknown) {
      // Tool-call-unsupported errors come back here — non-fatal, just skip.
      const message =
        err instanceof Error ? err.message : 'Analysis pass failed'
      console.warn('[Analysis] Skipped due to error:', message)
    } finally {
      adventureStore.setIsAnalyzing(false)
    }
  }

  /**
   * Background synthesis pass — runs AFTER `runAnalysisPass()` each turn.
   * Builds the same shared history as the story generator (so the cache
   * prefix is shared) and asks a model to synthesize the full story-so-far
   * + the current characters/plot points/agenda into a coherent global
   * storyline. The result is stored on `adventureStore.storyline` and fed
   * back into the narrative prompt as additional context, giving the
   * generator a real throughline rather than just disconnected plot-point
   * fragments.
   *
   * Skipped on the empty state and while another synthesis pass is in
   * flight. Failures are non-fatal — the previous storyline (if any) just
   * stays in place this turn.
   */
  async function runSynthesisPass() {
    if (!adventureStore.livingWorldEnabled) return
    if (adventureStore.isSynthesizing) return
    const turns = adventureStore.turns
    if (turns.length === 0) return

    const liveWorldState = {
      characters: adventureStore.characters,
      plotPoints: adventureStore.plotPoints,
      agenda: adventureStore.agenda,
    }

    adventureStore.setIsSynthesizing(true)
    try {
      const resolved = resolveModel('adventure-synthesis')
      const client = LLMClientFactory.getClient(resolved.provider)
      const messages = buildSynthesisMessages(
        turns,
        liveWorldState,
        adventureStore.settingDescription,
        adventureStore.compactions,
        {
          worldBible: adventureStore.worldBible,
          previousStoryline: adventureStore.storyline,
        },
      )

      console.log(
        `[Synthesis] Running with ${resolved.provider}/${resolved.model}`,
      )

      let accumulated = ''
      const response = client.generate({
        model: resolved.model,
        messages,
        max_tokens: resolved.maxTokens,
        thinking_budget: resolved.thinkingBudget
          ? Math.min(
              resolved.thinkingBudget,
              Math.floor(resolved.maxTokens / 2),
            )
          : undefined,
        metadata: { callType: 'adventure-synthesis' },
      })

      for await (const event of response) {
        if (event.type === 'chunk') {
          accumulated += event.text
        }
      }

      const storyline = accumulated
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/^#+\s+[^\n]+\n+/gm, '')
        .trim()

      // SAME = explicit no-op. The model is telling us nothing meaningful
      // has changed since the previous synthesis; reuse the previous
      // storyline verbatim. Only honored when there's a previous storyline
      // on file — the prompt forbids SAME on the first pass, but defend
      // against a misbehaving model anyway.
      const isSameMarker =
        /^SAME\.?$/i.test(storyline) && !!adventureStore.storyline.trim()

      if (isSameMarker) {
        console.log('[Synthesis] SAME — keeping previous storyline verbatim')
      } else if (storyline) {
        adventureStore.setStoryline(storyline)
        persist()
        console.log(`[Synthesis] Updated storyline (${storyline.length} chars)`)
      } else {
        console.log('[Synthesis] Empty response — keeping previous storyline')
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Synthesis pass failed'
      console.warn('[Synthesis] Skipped due to error:', message)
    } finally {
      adventureStore.setIsSynthesizing(false)
    }
  }

  /**
   * Storyline-gate pass — runs SYNCHRONOUSLY before each narrative pass
   * (resolution and world-step). Takes the full author-side storyline and
   * filters it down to the slice that's actually visible to / informing
   * the next beat. The narrative pass receives this brief instead of the
   * raw storyline; everything else stays off-page.
   *
   * Returns the filtered brief as a string, or `undefined` when:
   * - There is no storyline yet (synthesis hasn't run / first turn).
   * - The gate model returns "NONE" (or the empty string).
   * - The gate call errors out (we'd rather narrate without arc context
   *   than crash the turn).
   *
   * Note this is awaited inline by the narrative pipeline — it adds one
   * sequential LLM call per narrative pass. That cost is the price of
   * keeping arc information off the page; if it becomes a problem we can
   * cache or skip strategically later.
   */
  async function runStorylineGate(
    playerAction: string | null,
    kind: 'resolution' | 'world-step',
  ): Promise<string | undefined> {
    // The storyline gate is a living-world pre-pass: it slices the synthesized/
    // authored storyline for the next beat. When living world is off there is no
    // advancing storyline to gate (the field is hidden and never synthesized), so
    // skip the pass entirely rather than gating against stale hand-authored text.
    if (!adventureStore.livingWorldEnabled) return undefined

    const storyline = adventureStore.storyline.trim()
    if (!storyline) return undefined

    try {
      const resolved = resolveModel('adventure-storyline-gate')
      const client = LLMClientFactory.getClient(resolved.provider)
      const messages = buildStorylineGateMessages(
        adventureStore.turns,
        adventureStore.settingDescription,
        storyline,
        playerAction,
        adventureStore.compactions,
        { worldBible: adventureStore.worldBible },
      )

      console.log(
        `[StorylineGate] Running with ${resolved.provider}/${resolved.model} for ${
          playerAction === null ? 'world-step' : 'resolution'
        }`,
      )

      let accumulated = ''
      const response = client.generate({
        model: resolved.model,
        messages,
        max_tokens: resolved.maxTokens,
        thinking_budget: resolved.thinkingBudget
          ? Math.min(
              resolved.thinkingBudget,
              Math.floor(resolved.maxTokens / 2),
            )
          : undefined,
        metadata: { callType: 'adventure-storyline-gate' },
      })

      for await (const event of response) {
        if (event.type === 'chunk') {
          accumulated += event.text
        }
      }

      const brief = accumulated
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/^#+\s+[^\n]+\n+/gm, '')
        .trim()

      // NONE / empty → no relevant arc context this beat. Drop entirely.
      if (!brief || /^(none|n\/a|nothing)\.?$/i.test(brief)) {
        console.log('[StorylineGate] NONE — narrating without arc context')
        return undefined
      }

      console.log(`[StorylineGate] Brief (${brief.length} chars):\n${brief}`)

      // Approval gate (opt-in). When enabled, hand the brief to the UI
      // and park here until the user clicks accept/reject. Reject =
      // proceed without arc context this beat (returns undefined).
      // Accept = proceed with the (possibly-edited) brief. Cancel
      // (handleAbort or unmount) rejects the promise with an
      // AbortError, which the outer try/catch surfaces normally.
      if (adventureStore.gateApprovalEnabled) {
        adventureStore.setPendingGateBrief(brief, kind)
        const approved = await new Promise<string | undefined>(
          (resolve, reject) => {
            gateApprovalResolve = resolve
            gateApprovalReject = reject
          },
        )
        if (approved === undefined) {
          console.log('[StorylineGate] User rejected brief — proceeding without arc context')
        } else {
          console.log('[StorylineGate] User accepted brief')
        }
        return approved
      }

      return brief
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Storyline gate failed'
      console.warn('[StorylineGate] Skipped due to error:', message)
      return undefined
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
      max_tokens: resolved.maxTokens,
      thinking_budget: resolved.thinkingBudget
        ? Math.min(
            resolved.thinkingBudget,
            Math.floor(resolved.maxTokens / 2),
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
    // spinner, not the narrative text again. Match the streaming-kind to
    // the turn being checked so the chip stays consistent above the spinner.
    const lastKind =
      adventureStore.turns[adventureStore.turns.length - 1]?.kind ??
      'resolution'
    adventureStore.setStreamingKind(lastKind)
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
    adventureStore.setStreamingKind(lastTurn.kind ?? 'resolution')
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
        liveWorldStateForPrompt(),
      )

      const revisionResolved = resolveModel('adventure-revision')
      const revisionClient = LLMClientFactory.getClient(
        revisionResolved.provider,
      )

      let revisionAccumulated = ''
      const revisionResponse = revisionClient.generate({
        model: revisionResolved.model,
        messages: revisionMessages,
        max_tokens: revisionResolved.maxTokens,
        thinking_budget: revisionResolved.thinkingBudget
          ? Math.min(
              revisionResolved.thinkingBudget,
              Math.floor(revisionResolved.maxTokens / 2),
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
      adventureStore.setStreamingKind(null)
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
    if (adventureStore.deuteragonistInput.trim()) {
      description += `\n\nDEUTERAGONIST: ${adventureStore.deuteragonistInput.trim()}`
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
    // Also unblock any in-flight gate approval so the await unwinds.
    if (gateApprovalReject) {
      gateApprovalReject(new DOMException('aborted', 'AbortError'))
      clearPendingGateApproval()
    }
  }

  /**
   * Accept the in-flight gate brief — the narrative pass proceeds with
   * the brief as additional context. No-op when no brief is pending.
   */
  function acceptGateBrief() {
    if (!gateApprovalResolve) return
    const brief = adventureStore.pendingGateBrief ?? undefined
    gateApprovalResolve(brief)
    clearPendingGateApproval()
  }

  /**
   * Reject the in-flight gate brief — the narrative pass proceeds with
   * NO arc context this beat. The brief is discarded; the gate will run
   * fresh next turn. No-op when no brief is pending.
   */
  function rejectGateBrief() {
    if (!gateApprovalResolve) return
    gateApprovalResolve(undefined)
    clearPendingGateApproval()
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

  function handleEditNarrative(
    newNarrative: string,
    field: 'narrative' | 'deuteragonistNarrative' = 'narrative',
  ) {
    if (adventureStore.isGenerating) return
    if (adventureStore.turns.length === 0) return
    adventureStore.updateLastTurn({ [field]: newNarrative })
    persist()
  }

  function handleEditSetting(newSetting: string) {
    if (adventureStore.isGenerating) return
    const trimmed = newSetting.trim()
    if (!trimmed) return
    adventureStore.setSettingDescription(trimmed)
    // If there's exactly one turn (the opening turn), regenerate it with
    // the updated setting so the prose reflects the changes.
    if (adventureStore.turns.length === 1) {
      adventureStore.removeLastTurn()
      persist()
      generate(null)
    } else {
      persist()
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
      navigate('/stories', { replace: true })
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
        max_tokens: settingResolved.maxTokens,
        thinking_budget: settingResolved.thinkingBudget
          ? Math.min(
              settingResolved.thinkingBudget,
              Math.floor(settingResolved.maxTokens / 2),
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
    runAnalysisPass,
    runSynthesisPass,
    acceptGateBrief,
    rejectGateBrief,
    handleEditAndRegenerate,
    handleEditNarrative,
    handleEditSetting,
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
