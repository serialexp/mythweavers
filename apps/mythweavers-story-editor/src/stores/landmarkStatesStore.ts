import { batch } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import {
  getMyStoriesByStoryIdLandmarkStates,
  getMyStoriesByStoryIdLandmarkStatesAtByStoryTime,
} from '../client/config'
import { saveService } from '../services/saveService'

// Extract LandmarkState type from SDK response
export type LandmarkState = {
  id: string
  storyId: string
  mapId: string
  landmarkId: string
  storyTime: number | null
  field: string
  value: string
  createdAt: string
  updatedAt: string
}

interface LandmarkStatesStore {
  // All states for the current story
  states: LandmarkState[]
  // Accumulated states at current timeline position (key: "mapId:landmarkId:field")
  accumulatedStates: Record<string, LandmarkState>
  // Loading state
  isLoading: boolean
  // Current story time for timeline position
  currentStoryTime: number | null
}

const [statesStore, setStatesStore] = createStore<LandmarkStatesStore>({
  states: [],
  accumulatedStates: {},
  isLoading: false,
  currentStoryTime: null,
})

// Helper to build a state key
const buildStateKey = (mapId: string, landmarkId: string, field: string) => `${mapId}:${landmarkId}:${field}`

export const landmarkStatesStore = {
  // Getters
  get states() {
    return statesStore.states
  },
  get accumulatedStates() {
    return statesStore.accumulatedStates
  },
  get isLoading() {
    return statesStore.isLoading
  },
  get currentStoryTime() {
    return statesStore.currentStoryTime
  },

  // Get unique story times that have landmark states
  // Returns an array of storyTime values for timeline indicators
  get storyTimesWithStates(): number[] {
    const times = new Set<number>()
    for (const state of statesStore.states) {
      if (state.storyTime !== null && state.storyTime !== undefined) {
        times.add(state.storyTime)
      }
    }
    return Array.from(times).sort((a, b) => a - b)
  },

  // Get the current value for a specific landmark and field
  getLandmarkState(mapId: string, landmarkId: string, field: string): string | null {
    const key = buildStateKey(mapId, landmarkId, field)
    return statesStore.accumulatedStates[key]?.value || null
  },

  // Load all states for a story
  async loadStates(storyId: string) {
    if (!storyId) return

    setStatesStore('isLoading', true)
    try {
      const { data } = await getMyStoriesByStoryIdLandmarkStates({ path: { storyId } })
      if (data?.states) {
        setStatesStore('states', data.states as LandmarkState[])
      }
    } catch (error) {
      console.error('Failed to load landmark states:', error)
    } finally {
      setStatesStore('isLoading', false)
    }
  },

  // Load accumulated states at a specific story time (via backend API)
  async loadAccumulatedStates(storyId: string, storyTime: number) {
    if (!storyId || storyTime === null || storyTime === undefined) return

    setStatesStore('isLoading', true)
    try {
      const { data } = await getMyStoriesByStoryIdLandmarkStatesAtByStoryTime({
        path: { storyId, storyTime },
      })

      // Build accumulated states map
      const accumulated: Record<string, LandmarkState> = {}
      if (data?.states) {
        for (const state of data.states as LandmarkState[]) {
          const key = buildStateKey(state.mapId, state.landmarkId, state.field)
          accumulated[key] = state
        }
      }

      batch(() => {
        setStatesStore('accumulatedStates', reconcile(accumulated))
        setStatesStore('currentStoryTime', storyTime)
      })
    } catch (error) {
      console.error('Failed to load accumulated states:', error)
    } finally {
      setStatesStore('isLoading', false)
    }
  },

  // Set a landmark state (updates both local and server)
  async setLandmarkState(
    storyId: string,
    mapId: string,
    landmarkId: string,
    storyTime: number,
    field: string,
    value: string | null,
  ) {
    if (!storyId || storyTime === null || storyTime === undefined) return

    // Safety: Don't delete states if we haven't loaded them yet
    // This prevents accidental mass-deletion during initialization or HMR
    if (value === null && statesStore.states.length === 0 && !statesStore.isLoading) {
      console.warn('[LandmarkStatesStore] Attempted to delete state before states were loaded. Ignoring.')
      return
    }

    const key = buildStateKey(mapId, landmarkId, field)

    // Optimistically update local state
    if (value) {
      setStatesStore('accumulatedStates', key, {
        id: `optimistic-${Date.now()}`,
        storyId,
        mapId,
        landmarkId,
        storyTime,
        field,
        value,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    } else {
      // Remove state if value is null
      setStatesStore('accumulatedStates', (prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }

    try {
      // Update on server via save service (queued)
      saveService.saveLandmarkState(storyId, mapId, landmarkId, storyTime, field, value)

      // Also update the local states array optimistically
      if (value === null) {
        // Remove from states array
        setStatesStore('states', (prev) =>
          prev.filter(
            (s) => !(s.mapId === mapId && s.landmarkId === landmarkId && s.storyTime === storyTime && s.field === field),
          ),
        )
      } else {
        // Add or update in states array
        setStatesStore('states', (prev) => {
          const existingIdx = prev.findIndex(
            (s) => s.mapId === mapId && s.landmarkId === landmarkId && s.storyTime === storyTime && s.field === field,
          )

          const newState: LandmarkState = {
            id: `optimistic-${Date.now()}`,
            storyId,
            mapId,
            landmarkId,
            storyTime,
            field,
            value,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          if (existingIdx >= 0) {
            const next = [...prev]
            next[existingIdx] = newState
            return next
          }
          return [...prev, newState]
        })
      }
    } catch (error) {
      console.error('Failed to set landmark state:', error)

      // Revert optimistic update on error
      if (statesStore.currentStoryTime !== null) {
        await this.loadAccumulatedStates(storyId, statesStore.currentStoryTime)
      }
    }
  },

  // Clear all states
  clearStates() {
    batch(() => {
      setStatesStore('states', [])
      setStatesStore('accumulatedStates', {})
      setStatesStore('currentStoryTime', null)
    })
  },
}
