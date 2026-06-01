import { Component, For, Show } from 'solid-js'
import { PhCaretDownIcon, PhCaretRightIcon } from 'solidjs-phosphor'
import { nodeStore } from '../../stores/nodeStore'
import type { Node } from '../../types/core'
import { RefinementPreview } from './RefinementPreview'
import * as styles from './Snowflake.css'
import { SnowflakeInput } from './SnowflakeInput'
import { SnowflakeItemActions } from './SnowflakeItemActions'
import { childrenOf, determineRefinementLevel, summaryOf } from './actions/helpers'

interface SnowflakeItemProps {
  node: Node
}

/** One node card in the outline tree; recurses into its children. */
export const SnowflakeItem: Component<SnowflakeItemProps> = (props) => {
  const children = () => childrenOf(props.node.id)
  const hasChildren = () => children().length > 0
  const expanded = () => nodeStore.isExpanded(props.node.id)
  const level = () => determineRefinementLevel(summaryOf(props.node))

  return (
    <div class={styles.card[props.node.type]}>
      <div class={styles.cardHeader}>
        <Show when={hasChildren()} fallback={<span style={{ width: '1.25rem' }} />}>
          <button
            class={styles.expandToggle}
            onClick={() => nodeStore.toggleExpanded(props.node.id)}
            title={expanded() ? 'Collapse' : 'Expand'}
          >
            <Show when={expanded()} fallback={<PhCaretRightIcon />}>
              <PhCaretDownIcon />
            </Show>
          </button>
        </Show>

        <span class={styles.typeBadge}>{props.node.type}</span>

        <input
          class={styles.titleInput}
          value={props.node.title}
          onInput={(e) => nodeStore.updateNode(props.node.id, { title: e.currentTarget.value })}
          placeholder="Untitled"
        />

        <Show when={summaryOf(props.node).trim().length > 0}>
          <span class={styles.levelBadge} title="Detail level (sentence / paragraph / page)">
            {`L${level()}`}
          </span>
        </Show>

        <SnowflakeItemActions node={props.node} hasChildren={hasChildren()} />
      </div>

      <SnowflakeInput node={props.node} />

      <RefinementPreview previewKey={props.node.id} />

      <Show when={expanded() && hasChildren()}>
        <div class={styles.childrenContainer}>
          <For each={children()}>{(child) => <SnowflakeItem node={child} />}</For>
        </div>
      </Show>
    </div>
  )
}
