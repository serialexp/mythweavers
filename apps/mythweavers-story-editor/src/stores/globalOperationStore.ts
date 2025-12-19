import { createStore } from 'solid-js/store'

export type GlobalOperationType =
  | 'bulk-summarize'
  | 'migrate-instructions'
  | 'remove-user-messages'
  | 'cleanup-think-tags'
  | null

export interface GlobalOperation {
  type: GlobalOperationType
  current: number
  total: number
  message?: string
}

const [globalOperationState, setGlobalOperationState] = createStore<{
  operation: GlobalOperation | null
}>({
  operation: null,
})

export const globalOperationStore = {
  get operation() {
    return globalOperationState.operation
  },

  startOperation(type: GlobalOperationType, total: number, message?: string) {
    setGlobalOperationState('operation', {
      type,
      current: 0,
      total,
      message,
    })
  },

  updateProgress(current: number, message?: string) {
    if (globalOperationState.operation) {
      setGlobalOperationState('operation', 'current', current)
      if (message !== undefined) {
        setGlobalOperationState('operation', 'message', message)
      }
    }
  },

  completeOperation() {
    setGlobalOperationState('operation', null)
  },

  isOperationInProgress() {
    return globalOperationState.operation !== null
  },
}
