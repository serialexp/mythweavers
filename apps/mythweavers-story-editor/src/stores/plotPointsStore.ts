import { createStore } from 'solid-js/store'
import { saveService } from '../services/saveService'
import type { PlotPointDefinition, PlotPointState } from '../types/core'
import { currentStoryStore } from './currentStoryStore'

interface PlotPointsState {
  // Definitions (from story settings)
  definitions: PlotPointDefinition[]
  // States (message-level overrides)
  states: PlotPointState[]
}

const [plotPointsState, setPlotPointsState] = createStore<PlotPointsState>({
  definitions: [],
  states: [],
})

export const plotPointsStore = {
  // Getters
  get definitions() {
    return plotPointsState.definitions
  },
  get states() {
    return plotPointsState.states
  },

  // Initialize from story data
  setDefinitions: (definitions: PlotPointDefinition[]) => {
    setPlotPointsState('definitions', definitions || [])
  },

  setStates: (states: PlotPointState[]) => {
    setPlotPointsState('states', states || [])
  },

  // Definition management
  addDefinition: (definition: PlotPointDefinition) => {
    setPlotPointsState('definitions', (prev) => [...prev, definition])
    saveService.savePlotPointDefaults(currentStoryStore.id!, plotPointsState.definitions)
  },

  updateDefinition: (key: string, updates: Partial<PlotPointDefinition>) => {
    setPlotPointsState(
      'definitions',
      (def) => def.key === key,
      (def) => ({ ...def, ...updates }),
    )
    saveService.savePlotPointDefaults(currentStoryStore.id!, plotPointsState.definitions)
  },

  removeDefinition: (key: string) => {
    setPlotPointsState('definitions', (prev) => prev.filter((def) => def.key !== key))
    // Also remove any states for this key
    setPlotPointsState('states', (prev) => prev.filter((state) => state.key !== key))
    saveService.savePlotPointDefaults(currentStoryStore.id!, plotPointsState.definitions)
  },

  // State management (message-level overrides)
  setStateAtMessage: (messageId: string, key: string, value: string) => {
    const storyId = currentStoryStore.id!
    const existingIndex = plotPointsState.states.findIndex(
      (s) => s.messageId === messageId && s.key === key,
    )

    if (existingIndex >= 0) {
      // Update existing state
      setPlotPointsState('states', existingIndex, 'value', value)
    } else {
      // Add new state
      setPlotPointsState('states', (prev) => [
        ...prev,
        { storyId, messageId, key, value },
      ])
    }

    saveService.savePlotPointState(storyId, messageId, key, value)
  },

  removeStateAtMessage: (messageId: string, key: string) => {
    setPlotPointsState('states', (prev) =>
      prev.filter((s) => !(s.messageId === messageId && s.key === key)),
    )
    saveService.deletePlotPointState(messageId, key)
  },

  // Get states for a specific message
  getStatesForMessage: (messageId: string): PlotPointState[] => {
    return plotPointsState.states.filter((s) => s.messageId === messageId)
  },

  // Get accumulated plot point values up to (and including) a message
  // This is used by scriptDataStore to build data.plotPoints
  getAccumulatedValues: (
    messageIdsInOrder: string[],
    upToMessageId: string,
  ): Record<string, string | number | boolean> => {
    const result: Record<string, string | number | boolean> = {}

    // Start with defaults
    for (const def of plotPointsState.definitions) {
      result[def.key] = def.default
    }

    // Apply overrides in message order up to the target
    for (const msgId of messageIdsInOrder) {
      const statesForMsg = plotPointsState.states.filter((s) => s.messageId === msgId)
      for (const state of statesForMsg) {
        const def = plotPointsState.definitions.find((d) => d.key === state.key)
        if (def) {
          if (def.type === 'number') {
            result[state.key] = Number(state.value)
          } else if (def.type === 'boolean') {
            result[state.key] = state.value === 'true'
          } else {
            result[state.key] = state.value
          }
        }
      }
      if (msgId === upToMessageId) break
    }

    return result
  },

  // Check if a state is set at this specific message (vs inherited)
  isStateSetAtMessage: (messageId: string, key: string): boolean => {
    return plotPointsState.states.some((s) => s.messageId === messageId && s.key === key)
  },

  // Clear all data (when switching stories)
  clear: () => {
    setPlotPointsState({
      definitions: [],
      states: [],
    })
  },
}
