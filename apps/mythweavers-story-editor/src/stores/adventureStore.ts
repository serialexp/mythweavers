import { batch } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import type {
  AdventureTurn,
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
  directive: string

  // Generation state
  isGenerating: boolean
  streamingContent: string
  pendingAction: string | null
  lastFailedAction: string | null | undefined
  error: string | null

  // Director agent
  isDirectorRunning: boolean

  // Setting generator
  isGeneratingSetting: boolean
  settingGenFailed: boolean
  knobValues: Record<string, string>
  knobLocks: Record<string, boolean>

  // UI state
  playerInput: string
  expandedTrajectories: Record<number, boolean>
  showDirectorNotes: boolean
  showMenu: boolean
  showDirective: boolean
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
  directive: '',

  isGenerating: false,
  streamingContent: '',
  pendingAction: null,
  lastFailedAction: undefined,
  error: null,

  isDirectorRunning: false,

  isGeneratingSetting: false,
  settingGenFailed: false,
  knobValues: defaultKnobValues(),
  knobLocks: defaultKnobLocks(),

  playerInput: '',
  expandedTrajectories: {},
  showDirectorNotes: false,
  showMenu: false,
  showDirective: false,
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
  get directive() {
    return state.directive
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

  get playerInput() {
    return state.playerInput
  },
  get expandedTrajectories() {
    return state.expandedTrajectories
  },
  get showDirectorNotes() {
    return state.showDirectorNotes
  },
  get showMenu() {
    return state.showMenu
  },
  get showDirective() {
    return state.showDirective
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
  setDirective(v: string) {
    setState('directive', v)
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

  setIsGeneratingSetting(v: boolean) {
    setState('isGeneratingSetting', v)
  },
  setSettingGenFailed(v: boolean) {
    setState('settingGenFailed', v)
  },
  setKnobValues(v: Record<string, string>) {
    setState('knobValues', reconcile(v))
  },

  setPlayerInput(v: string) {
    setState('playerInput', v)
  },
  setShowDirectorNotes(v: boolean) {
    setState('showDirectorNotes', v)
  },
  setShowMenu(v: boolean) {
    setState('showMenu', v)
  },
  setShowDirective(v: boolean) {
    setState('showDirective', v)
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

  /** Update the last turn (e.g. to attach director notes). */
  updateLastTurn(updates: Partial<AdventureTurn>) {
    const idx = state.turns.length - 1
    if (idx >= 0) {
      setState('turns', idx, (prev) => ({ ...prev, ...updates }))
    }
  },

  /** Rewind the story to a specific turn index (inclusive). */
  rewindTo(turnIndex: number) {
    setState('turns', reconcile([...state.turns.slice(0, turnIndex + 1)]))
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
      directive: state.directive,
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

        playerInput: '',
        showDirectorNotes: false,
        showMenu: false,
        showDirective: false,
        showKnobs: false,
        scrollLocked: true,
      })
      // Use reconcile for nested objects/arrays to ensure old keys are cleared
      setState('turns', reconcile(saved?.turns ?? []))
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

        isGenerating: false,
        streamingContent: '',
        pendingAction: null,
        lastFailedAction: undefined,
        error: null,

        isDirectorRunning: false,

        isGeneratingSetting: false,
        settingGenFailed: false,

        playerInput: '',
        showDirectorNotes: false,
        showMenu: false,
        showDirective: false,
        showKnobs: false,
        scrollLocked: true,
      })
      setState('turns', reconcile([]))
      setState('expandedTrajectories', reconcile({}))
      setState('knobValues', reconcile(defaultKnobValues()))
      setState('knobLocks', reconcile(defaultKnobLocks()))
    })
  },
}
