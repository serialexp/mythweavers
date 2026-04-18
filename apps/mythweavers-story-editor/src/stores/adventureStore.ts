import { batch } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import type {
  AdventureTurn,
  AdventureCompaction,
  AdventurePhase,
  PersistedState,
} from '../hooks/useAdventurePersistence'
import { SETTING_KNOBS } from '../pages/adventure/prompts'

// --- State shape ---

interface AdventureState {
  // Core game state
  phase: AdventurePhase
  settingInput: string
  protagonistInput: string
  settingDescription: string
  turns: AdventureTurn[]
  compactions: Record<string, AdventureCompaction>
  directive: string
  worldBible: string

  // Generation state
  isGenerating: boolean
  streamingContent: string
  pendingAction: string | null
  lastFailedAction: string | null | undefined
  error: string | null

  // Director agent
  isDirectorRunning: boolean

  // Compaction
  compactingKeys: Record<string, boolean>

  // Setting generator
  isGeneratingSetting: boolean
  settingGenFailed: boolean
  knobValues: Record<string, string>
  knobLocks: Record<string, boolean>

  // Feature toggles
  worldMomentumEnabled: boolean
  directorDueNextTurn: boolean

  // Nonsense check
  nonsenseWarning: string | null

  // UI state
  playerInput: string
  expandedTrajectories: Record<number, boolean>
  showStoryPanel: boolean
  showMenu: boolean
  showKnobs: boolean
  scrollLocked: boolean
}

// --- Helpers ---

function defaultKnobValues(): Record<string, string> {
  return Object.fromEntries(SETTING_KNOBS.map((k) => [k.id, '']))
}

function defaultKnobLocks(): Record<string, boolean> {
  return Object.fromEntries(SETTING_KNOBS.map((k) => [k.id, false]))
}

// --- Store ---

const [state, setState] = createStore<AdventureState>({
  phase: 'setup',
  settingInput: '',
  protagonistInput: '',
  settingDescription: '',
  turns: [],
  compactions: {},
  directive: '',
  worldBible: '',

  isGenerating: false,
  streamingContent: '',
  pendingAction: null,
  lastFailedAction: undefined,
  error: null,

  isDirectorRunning: false,

  compactingKeys: {},

  isGeneratingSetting: false,
  settingGenFailed: false,
  knobValues: defaultKnobValues(),
  knobLocks: defaultKnobLocks(),

  worldMomentumEnabled: true,
  directorDueNextTurn: false,

  nonsenseWarning: null,

  playerInput: '',
  expandedTrajectories: {},
  showStoryPanel: false,
  showMenu: false,
  showKnobs: false,
  scrollLocked: true,
})

export const adventureStore = {
  // --- Getters ---

  get phase() {
    return state.phase
  },
  get settingInput() {
    return state.settingInput
  },
  get protagonistInput() {
    return state.protagonistInput
  },
  get settingDescription() {
    return state.settingDescription
  },
  get turns() {
    return state.turns
  },
  get compactions() {
    return state.compactions
  },
  get directive() {
    return state.directive
  },
  get worldBible() {
    return state.worldBible
  },

  get isGenerating() {
    return state.isGenerating
  },
  get streamingContent() {
    return state.streamingContent
  },
  get pendingAction() {
    return state.pendingAction
  },
  get lastFailedAction() {
    return state.lastFailedAction
  },
  get error() {
    return state.error
  },

  get isDirectorRunning() {
    return state.isDirectorRunning
  },

  get compactingKeys() {
    return state.compactingKeys
  },

  isCompacting(key: string): boolean {
    return !!state.compactingKeys[key]
  },

  get isGeneratingSetting() {
    return state.isGeneratingSetting
  },
  get settingGenFailed() {
    return state.settingGenFailed
  },
  get knobValues() {
    return state.knobValues
  },
  get knobLocks() {
    return state.knobLocks
  },

  get worldMomentumEnabled() {
    return state.worldMomentumEnabled
  },
  get directorDueNextTurn() {
    return state.directorDueNextTurn
  },
  get nonsenseWarning() {
    return state.nonsenseWarning
  },

  get playerInput() {
    return state.playerInput
  },
  get expandedTrajectories() {
    return state.expandedTrajectories
  },
  get showStoryPanel() {
    return state.showStoryPanel
  },
  get showMenu() {
    return state.showMenu
  },
  get showKnobs() {
    return state.showKnobs
  },
  get scrollLocked() {
    return state.scrollLocked
  },

  // --- Simple setters ---

  setPhase(phase: AdventurePhase) {
    setState('phase', phase)
  },
  setSettingInput(v: string) {
    setState('settingInput', v)
  },
  setProtagonistInput(v: string) {
    setState('protagonistInput', v)
  },
  setSettingDescription(v: string) {
    setState('settingDescription', v)
  },
  setCompaction(key: string, compaction: AdventureCompaction) {
    setState('compactions', key, compaction)
  },

  setDirective(v: string) {
    setState('directive', v)
  },
  setWorldBible(v: string) {
    setState('worldBible', v)
  },

  setIsGenerating(v: boolean) {
    setState('isGenerating', v)
  },
  setStreamingContent(v: string) {
    setState('streamingContent', v)
  },
  setPendingAction(v: string | null) {
    setState('pendingAction', v)
  },
  setLastFailedAction(v: string | null | undefined) {
    setState('lastFailedAction', v)
  },
  setError(v: string | null) {
    setState('error', v)
  },

  setIsDirectorRunning(v: boolean) {
    setState('isDirectorRunning', v)
  },

  setCompactingKey(key: string, v: boolean) {
    if (v) {
      setState('compactingKeys', key, true)
    } else {
      setState('compactingKeys', key, undefined as unknown as boolean)
    }
  },

  setIsGeneratingSetting(v: boolean) {
    setState('isGeneratingSetting', v)
  },
  setSettingGenFailed(v: boolean) {
    setState('settingGenFailed', v)
  },
  setKnobValues(v: Record<string, string>) {
    setState('knobValues', reconcile(v))
  },

  setWorldMomentumEnabled(v: boolean) {
    setState('worldMomentumEnabled', v)
    // When re-enabling momentum, force the director to run on the next turn
    if (v) {
      setState('directorDueNextTurn', true)
    }
  },
  setDirectorDueNextTurn(v: boolean) {
    setState('directorDueNextTurn', v)
  },
  setNonsenseWarning(v: string | null) {
    setState('nonsenseWarning', v)
  },

  setPlayerInput(v: string) {
    setState('playerInput', v)
  },
  setShowStoryPanel(v: boolean) {
    setState('showStoryPanel', v)
  },
  setShowMenu(v: boolean) {
    setState('showMenu', v)
  },
  setShowKnobs(v: boolean) {
    setState('showKnobs', v)
  },
  setScrollLocked(v: boolean) {
    setState('scrollLocked', v)
  },

  // --- Complex actions ---

  toggleTrajectory(index: number) {
    setState('expandedTrajectories', index, !state.expandedTrajectories[index])
  },

  isTrajectoryExpanded(index: number): boolean {
    return !!state.expandedTrajectories[index]
  },

  setKnobValue(knobId: string, value: string) {
    setState('knobValues', knobId, value)
    setState('knobLocks', knobId, true)
  },

  toggleKnobLock(knobId: string) {
    setState('knobLocks', knobId, !state.knobLocks[knobId])
  },

  /** Add a new turn to the story. */
  addTurn(turn: AdventureTurn) {
    setState('turns', state.turns.length, turn)
  },

  /** Replace the entire turns array. */
  setTurns(turns: AdventureTurn[]) {
    setState('turns', reconcile([...turns]))
  },

  /** Update the last turn (e.g. to attach director notes). */
  updateLastTurn(updates: Partial<AdventureTurn>) {
    const idx = state.turns.length - 1
    if (idx >= 0) {
      setState('turns', idx, (prev) => ({ ...prev, ...updates }))
    }
  },

  /** Rewind the story to a specific turn index (inclusive). */
  rewindTo(turnIndex: number) {
    const newCount = turnIndex + 1
    setState('turns', reconcile([...state.turns.slice(0, newCount)]))

    // Invalidate compactions that reference turns beyond the new count
    const cleaned: Record<string, AdventureCompaction> = {}
    for (const [key, comp] of Object.entries(state.compactions)) {
      const end = Number.parseInt(key.split('-')[1], 10)
      if (end < newCount) {
        cleaned[key] = comp
      }
    }
    setState('compactions', reconcile(cleaned))
  },

  /** Remove the last turn and return it. */
  removeLastTurn(): AdventureTurn | undefined {
    const currentTurns = state.turns
    if (currentTurns.length === 0) return undefined
    const removed = currentTurns[currentTurns.length - 1]
    setState('turns', reconcile([...currentTurns.slice(0, -1)]))
    return removed
  },

  /** Build a snapshot suitable for persistence. */
  buildSnapshot(): PersistedState {
    const action = state.pendingAction
    return {
      phase: state.phase,
      settingInput: state.settingInput,
      protagonistInput: state.protagonistInput,
      settingDescription: state.settingDescription,
      turns: [...state.turns],
      compactions: { ...state.compactions },
      directive: state.directive,
      worldBible: state.worldBible,
      worldMomentumEnabled: state.worldMomentumEnabled,
      ...(action ? { pendingAction: action } : {}),
    }
  },

  /**
   * Batch-finalize a generated turn: clear streaming state and add the turn
   * in a single render frame to avoid content flashing.
   */
  finalizeTurn(turn: AdventureTurn) {
    batch(() => {
      setState('streamingContent', '')
      setState('pendingAction', null)
      setState('isGenerating', false)
      setState('turns', state.turns.length, turn)
    })
  },

  /**
   * Batch-finalize an aborted generation with partial content.
   */
  finalizeAbort(turn: AdventureTurn) {
    batch(() => {
      setState('streamingContent', '')
      setState('pendingAction', null)
      setState('isGenerating', false)
      setState('turns', state.turns.length, turn)
    })
  },

  /** Initialize store from persisted state (or fresh for a new adventure). */
  initialize(saved: PersistedState | null) {
    batch(() => {
      setState({
        phase: saved?.phase ?? 'setup',
        settingInput: saved?.settingInput ?? '',
        protagonistInput: saved?.protagonistInput ?? '',
        settingDescription: saved?.settingDescription ?? '',
        directive: saved?.directive ?? '',
        worldBible: saved?.worldBible ?? '',

        isGenerating: false,
        streamingContent: '',
        pendingAction: saved?.pendingAction ?? null,
        lastFailedAction: saved?.pendingAction
          ? saved.pendingAction
          : undefined,
        error: null,

        isDirectorRunning: false,

        isGeneratingSetting: false,
        settingGenFailed: false,

        worldMomentumEnabled: saved?.worldMomentumEnabled ?? true,

        playerInput: '',
        showStoryPanel: false,
        showMenu: false,
        showKnobs: false,
        scrollLocked: true,
      })
      // Use reconcile for nested objects/arrays to ensure old keys are cleared
      setState('turns', reconcile(saved?.turns ?? []))
      setState('compactions', reconcile(saved?.compactions ?? {}))
      setState('compactingKeys', reconcile({}))
      setState('expandedTrajectories', reconcile({}))
      setState('knobValues', reconcile(defaultKnobValues()))
      setState('knobLocks', reconcile(defaultKnobLocks()))
    })
  },

  /** Full reset for starting a new adventure. */
  reset() {
    batch(() => {
      setState({
        phase: 'setup' as const,
        settingInput: '',
        protagonistInput: '',
        settingDescription: '',
        directive: '',
        worldBible: '',

        isGenerating: false,
        streamingContent: '',
        pendingAction: null,
        lastFailedAction: undefined,
        error: null,

        isDirectorRunning: false,

        isGeneratingSetting: false,
        settingGenFailed: false,

        worldMomentumEnabled: true,

        playerInput: '',
        showStoryPanel: false,
        showMenu: false,
        showKnobs: false,
        scrollLocked: true,
      })
      setState('turns', reconcile([]))
      setState('compactions', reconcile({}))
      setState('compactingKeys', reconcile({}))
      setState('expandedTrajectories', reconcile({}))
      setState('knobValues', reconcile(defaultKnobValues()))
      setState('knobLocks', reconcile(defaultKnobLocks()))
    })
  },
}
