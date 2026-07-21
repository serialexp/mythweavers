// Local, UI-only state for the snowflake outliner. Domain data (nodes, the
// story summary) lives in nodeStore / currentStoryStore — this store only holds
// transient view state: which node is busy, any pending AI refinement awaiting
// accept/reject, and the global summary detail-level zoom.

import { createStore } from 'solid-js/store'
import type { RefinementLevel } from './constants'

/** A pending AI suggestion the user can accept or reject. */
export interface RefinementPreview {
  /** The text before refinement (left column). */
  original: string
  /** The AI-proposed text (right column). */
  refined: string
  /** Detail level this refinement targeted, if applicable. */
  level?: RefinementLevel
  /** Apply the refinement (writes to the store) and clear the preview. */
  onAccept: () => void
  /** Discard the refinement and clear the preview. */
  onReject: () => void
}

interface SnowflakeUIState {
  /** Busy flags keyed by `${key}` or `${key}:${op}`; key is a nodeId or 'story'. */
  loadingStates: Record<string, boolean>
  /** Pending refinements keyed by nodeId, or 'story' for the story concept. */
  refinementPreviews: Record<string, RefinementPreview | undefined>
  /**
   * Max detail level shown for every node summary (a global "zoom"). 3 shows the
   * full summary; 2/1 clamp the display to the first paragraph / first sentence.
   * Editing while zoomed below a node's real level only touches the visible
   * portion — the hidden tail is preserved on save.
   */
  displayLevel: RefinementLevel
}

const [state, setState] = createStore<SnowflakeUIState>({
  loadingStates: {},
  refinementPreviews: {},
  displayLevel: 3,
})

export const snowflakeStore = {
  get state() {
    return state
  },

  get displayLevel(): RefinementLevel {
    return state.displayLevel
  },

  setDisplayLevel(level: RefinementLevel) {
    setState('displayLevel', level)
  },

  isLoading(key: string): boolean {
    return state.loadingStates[key] === true
  },

  setLoading(key: string, loading: boolean) {
    setState('loadingStates', key, loading)
  },

  getPreview(key: string): RefinementPreview | undefined {
    return state.refinementPreviews[key]
  },

  setPreview(key: string, preview: RefinementPreview) {
    setState('refinementPreviews', key, preview)
  },

  clearPreview(key: string) {
    setState('refinementPreviews', key, undefined)
  },
}
