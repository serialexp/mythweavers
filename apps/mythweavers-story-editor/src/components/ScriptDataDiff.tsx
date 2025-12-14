import { Component, Show, For } from 'solid-js'
import styles from './ScriptDataDiff.module.css'

type ScriptDataValue = string | number | boolean | null | undefined | ScriptDataObject | ScriptDataValue[]
type ScriptDataObject = { [key: string]: ScriptDataValue }

interface ScriptDataDiffProps {
  before: ScriptDataObject
  after: ScriptDataObject
  messageId: string
}

export const ScriptDataDiff: Component<ScriptDataDiffProps> = (props) => {
  // Convert objects to JSON strings for comparison
  const beforeStr = JSON.stringify(props.before, null, 2)
  const afterStr = JSON.stringify(props.after, null, 2)
  
  // If they're the same, don't show anything
  if (beforeStr === afterStr) return null
  
  
  // Create a simple representation of what changed
  const changes: string[] = []
  
  const findChanges = (obj1: ScriptDataValue, obj2: ScriptDataValue, path: string = '') => {
    // Handle null/undefined
    if (obj1 === null || obj1 === undefined || obj2 === null || obj2 === undefined) {
      if (obj1 !== obj2) {
        changes.push(`${path}: ${JSON.stringify(obj1)} → ${JSON.stringify(obj2)}`)
      }
      return
    }
    
    // Handle different types
    if (typeof obj1 !== typeof obj2) {
      changes.push(`${path}: ${JSON.stringify(obj1)} → ${JSON.stringify(obj2)}`)
      return
    }
    
    // Handle primitives
    if (typeof obj1 !== 'object') {
      if (obj1 !== obj2) {
        changes.push(`${path}: ${JSON.stringify(obj1)} → ${JSON.stringify(obj2)}`)
      }
      return
    }
    
    // Handle arrays
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      if (JSON.stringify(obj1) !== JSON.stringify(obj2)) {
        changes.push(`${path}: [${obj1.length} items] → [${obj2.length} items]`)
      }
      return
    }
    
    // Handle objects - at this point we know obj1 and obj2 are objects
    if (!Array.isArray(obj1) && !Array.isArray(obj2)) {
      const objKeys1 = Object.keys(obj1 as ScriptDataObject)
      const objKeys2 = Object.keys(obj2 as ScriptDataObject)
      const allKeys = new Set([...objKeys1, ...objKeys2])
      
      for (const key of allKeys) {
        const newPath = path ? `${path}.${key}` : key
        const val1 = (obj1 as ScriptDataObject)[key]
        const val2 = (obj2 as ScriptDataObject)[key]
        
        if (val2 === undefined) {
          changes.push(`${newPath}: ${JSON.stringify(val1)} → (removed)`)
        } else if (val1 === undefined) {
          changes.push(`${newPath}: (added) → ${JSON.stringify(val2)}`)
        } else {
          findChanges(val1, val2, newPath)
        }
      }
    }
  }
  
  findChanges(props.before, props.after)
  
  return (
    <Show when={changes.length > 0}>
      <div class={styles.container}>
        <div class={styles.header}>
          Script Data Changes:
        </div>
        <div class={styles.changes}>
          <For each={changes}>
            {(change) => (
              <div class={styles.change}>
                {change}
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}