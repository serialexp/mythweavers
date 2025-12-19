/**
 * Synchronize state between Histoire's state object and Solid's reactive state
 */
export function syncState(histoireState: any, onUpdate: (value: any) => void) {
  let stopped = false

  // Watch for changes to the Histoire state
  const checkState = () => {
    if (stopped) return
    onUpdate(histoireState)
  }

  // Initial sync
  checkState()

  return {
    stop: () => {
      stopped = true
    },
  }
}
