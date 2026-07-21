import { Component, createSignal, onCleanup } from 'solid-js'
import { saveService } from '../../services/saveService'
import { nodeStore } from '../../stores/nodeStore'
import type { Node } from '../../types/core'
import { AutoResizeTextarea } from './AutoResizeTextarea'
import * as styles from './Snowflake.css'
import { summaryFieldForLevel } from './actions/helpers'
import { snowflakeStore } from './store'

interface SnowflakeInputProps {
  node: Node
  placeholder?: string
}

/**
 * The one-liner editor bound to a node's `summary`. Writes are debounced
 * through nodeStore (which persists via saveService). We keep a local draft so
 * typing stays responsive regardless of save timing, and re-sync it when the
 * node's summary changes underneath us (e.g. an accepted AI refinement).
 *
 * Honours the global detail-level zoom (`snowflakeStore.displayLevel`). Each
 * level is stored independently, so editing a one-liner never modifies the
 * paragraph or canonical full summary.
 */
export const SnowflakeInput: Component<SnowflakeInputProps> = (props) => {
  const level = () => snowflakeStore.displayLevel
  const field = () => summaryFieldForLevel(level())
  const value = () => props.node[field()] ?? ''

  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingField: ReturnType<typeof summaryFieldForLevel> | null = null
  const [draft, setDraft] = createSignal<string | null>(null)

  const flushDraft = () => {
    if (timer) clearTimeout(timer)
    timer = undefined

    const next = draft()
    if (pendingField && next !== null) {
      const targetField = pendingField
      pendingField = null
      setDraft(null)
      nodeStore.updateNode(props.node.id, { [targetField]: next })
      void saveService.flushPendingSaves()
    }
  }

  onCleanup(flushDraft)

  const handleInput = (next: string) => {
    const targetField = field()
    const previousDraft = draft()
    if (previousDraft !== null && pendingField && pendingField !== targetField) {
      if (timer) clearTimeout(timer)
      nodeStore.updateNode(props.node.id, { [pendingField]: previousDraft })
    }
    pendingField = targetField
    setDraft(next)
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      nodeStore.updateNode(props.node.id, { [targetField]: next })
      pendingField = null
      setDraft(null)
    }, 400)
  }

  return (
    <AutoResizeTextarea
      class={styles.textarea}
      value={draft() ?? value()}
      onValueInput={handleInput}
      placeholder={
        props.placeholder ??
        (level() === 1 ? 'Write a one-liner…' : level() === 2 ? 'Write a paragraph…' : 'Write the full summary…')
      }
    />
  )
}
