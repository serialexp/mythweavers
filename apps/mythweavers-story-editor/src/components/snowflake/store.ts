// Local, UI-only state for the snowflake outliner. Domain data (nodes, the
// story summary) lives in nodeStore / currentStoryStore — this store only holds
// transient view state: which node is busy, and any pending AI refinement
// awaiting accept/reject.

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
}

const [state, setState] = createStore<SnowflakeUIState>({
  loadingStates: {},
  refinementPreviews: {},
})

export const snowflakeStore = {
  get state() {
    return state
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
