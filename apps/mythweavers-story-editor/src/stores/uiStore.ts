import { createStore } from 'solid-js/store'

export type SummaryViewMode = 'auto' | 'sentence' | 'paragraph' | 'full'

interface UIState {
  cutMessageIds: Set<string>
  targetingMode: {
    active: boolean
    branchMessageId: string | null // The branch message being edited
    optionId: string | null // The option being targeted
  }
  summaryView: SummaryViewMode
}

const [uiState, setUIState] = createStore<UIState>({
  cutMessageIds: new Set(),
  targetingMode: {
    active: false,
    branchMessageId: null,
    optionId: null,
  },
  summaryView: 'auto',
})

export const uiStore = {
  // Legacy getter for compatibility
  get cutMessageId() {
    const ids = Array.from(uiState.cutMessageIds)
    return ids.length > 0 ? ids[0] : null
  },

  get cutMessageIds() {
    return uiState.cutMessageIds
  },

  setCutMessage(messageId: string | null) {
    if (messageId === null) {
      setUIState('cutMessageIds', new Set())
    } else {
      setUIState('cutMessageIds', new Set([messageId]))
    }
  },

  addCutMessage(messageId: string) {
    const newSet = new Set(uiState.cutMessageIds)
    newSet.add(messageId)
    setUIState('cutMessageIds', newSet)
  },

  removeCutMessage(messageId: string) {
    const newSet = new Set(uiState.cutMessageIds)
    newSet.delete(messageId)
    setUIState('cutMessageIds', newSet)
  },

  toggleCutMessage(messageId: string) {
    const newSet = new Set(uiState.cutMessageIds)
    if (newSet.has(messageId)) {
      newSet.delete(messageId)
    } else {
      newSet.add(messageId)
    }
    setUIState('cutMessageIds', newSet)
  },

  isCut(messageId: string) {
    return uiState.cutMessageIds.has(messageId)
  },

  hasCutMessage() {
    return uiState.cutMessageIds.size > 0
  },

  clearCut() {
    setUIState('cutMessageIds', new Set())
  },

  getCutMessageCount() {
    return uiState.cutMessageIds.size
  },

  // Targeting mode for setting branch targets
  get targetingMode() {
    return uiState.targetingMode
  },

  startTargeting(branchMessageId: string, optionId: string) {
    setUIState('targetingMode', {
      active: true,
      branchMessageId,
      optionId,
    })
  },

  cancelTargeting() {
    setUIState('targetingMode', {
      active: false,
      branchMessageId: null,
      optionId: null,
    })
  },

  isTargeting() {
    return uiState.targetingMode.active
  },

  get summaryView() {
    return uiState.summaryView
  },

  setSummaryView(mode: SummaryViewMode) {
    setUIState('summaryView', mode)
  },
}
