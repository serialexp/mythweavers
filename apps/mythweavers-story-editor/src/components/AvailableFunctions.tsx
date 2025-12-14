import { Component, createMemo, createSignal, Show } from 'solid-js'
import { BsCodeSlash } from 'solid-icons/bs'
import { currentStoryStore } from '../stores/currentStoryStore'
import { useContextMessage } from '../hooks/useContextMessage'
import styles from './AvailableFunctions.module.css'

export const AvailableFunctions: Component = () => {
  const [showFunctions, setShowFunctions] = createSignal(false)
  const contextMessageId = useContextMessage()
  
  const availableFunctions = createMemo(() => {
    const messageId = contextMessageId()
    if (!messageId) {
      return []
    }
    
    // Execute scripts to get the current data and functions
    let functions: Record<string, Function> = {}
    
    // Execute global script first to get functions
    if (currentStoryStore.globalScript) {
      try {
        const scriptFunction = eval(`(${currentStoryStore.globalScript})`)
        if (typeof scriptFunction === 'function') {
          // Create a draft data object for the global script
          const data = {}
          const result = scriptFunction(data, {})
          
          // Check if it returns functions
          if (result && typeof result === 'object' && 'functions' in result) {
            functions = result.functions || {}
          }
        }
      } catch (error) {
        console.error('Error evaluating global script for functions:', error)
      }
    }
    
    // Extract function signatures
    return Object.entries(functions).map(([name, func]) => {
      // Try to extract parameter names from function
      const funcStr = func.toString()
      const match = funcStr.match(/^(?:function\s*)?(?:\w+\s*)?\(([^)]*)\)/)
      const params = match ? match[1].split(',').map(p => p.trim()).filter(Boolean) : []
      
      return {
        name,
        params,
        signature: `${name}(${params.join(', ')})`
      }
    })
  })
  
  return (
    <div class={styles.container}>
      <button
        type="button"
        class={styles.toggleButton}
        onClick={() => setShowFunctions(!showFunctions())}
        title="Toggle available functions"
      >
        <BsCodeSlash />
        Available Functions
        <Show when={availableFunctions().length > 0}>
          <span class={styles.count}>({availableFunctions().length})</span>
        </Show>
      </button>

      <Show when={showFunctions() && availableFunctions().length > 0}>
        <div class={styles.functionList}>
          <div class={styles.functionsHeader}>
            Functions from Global Script:
          </div>
          {availableFunctions().map(func => (
            <div class={styles.function}>
              <code class={styles.signature}>
                functions.{func.signature}
              </code>
            </div>
          ))}
          <div class={styles.hint}>
            💡 Use these in EJS templates like: <code>&lt;%= functions.{availableFunctions()[0]?.name || 'functionName'}(...) %&gt;</code>
          </div>
        </div>
      </Show>
      
      <Show when={showFunctions() && availableFunctions().length === 0}>
        <div class={styles.noFunctions}>
          No functions available. Define functions in your Global Script to use them in templates.
        </div>
      </Show>
    </div>
  )
}