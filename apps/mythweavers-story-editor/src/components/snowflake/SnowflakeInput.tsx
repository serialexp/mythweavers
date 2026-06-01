import { Component, createSignal, onCleanup } from 'solid-js'
import { nodeStore } from '../../stores/nodeStore'
import type { Node } from '../../types/core'
import { AutoResizeTextarea } from './AutoResizeTextarea'
import * as styles from './Snowflake.css'

interface SnowflakeInputProps {
  node: Node
  placeholder?: string
}

/**
 * The one-liner editor bound to a node's `summary`. Writes are debounced
 * through nodeStore (which persists via saveService). We keep a local draft so
 * typing stays responsive regardless of save timing, and re-sync it when the
 * node's summary changes underneath us (e.g. an accepted AI refinement).
 */
export const SnowflakeInput: Component<SnowflakeInputProps> = (props) => {
  // Derived value: prefer the live store value so AI writes show up.
  const value = () => props.node.summary ?? ''

  let timer: ReturnType<typeof setTimeout> | undefined
  const [draft, setDraft] = createSignal<string | null>(null)

  onCleanup(() => {
    if (timer) clearTimeout(timer)
  })

  const handleInput = (next: string) => {
    setDraft(next)
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      nodeStore.updateNode(props.node.id, { summary: next })
      setDraft(null)
    }, 400)
  }

  return (
    <AutoResizeTextarea
      class={styles.textarea}
      value={draft() ?? value()}
      onValueInput={handleInput}
      placeholder={props.placeholder ?? 'Write a one-liner…'}
    />
  )
}
