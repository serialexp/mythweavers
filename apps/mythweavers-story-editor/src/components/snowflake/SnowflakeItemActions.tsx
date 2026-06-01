import { Dropdown, DropdownDivider, DropdownItem } from '@mythweavers/ui'
import { Component, Show } from 'solid-js'
import {
  PhArrowUpIcon,
  PhDotsThreeIcon,
  PhPencilSimpleIcon,
  PhPlusCircleIcon,
  PhTrashIcon,
  PhTreeStructureIcon,
} from 'solidjs-phosphor'
import { nodeStore } from '../../stores/nodeStore'
import type { Node, NodeType } from '../../types/core'
import * as styles from './Snowflake.css'
import { expandArc } from './actions/expandArc'
import { expandBook } from './actions/expandBook'
import { expandChapter } from './actions/expandChapter'
import { generateParentSummary } from './actions/generateParentSummary'
import { refineSummary } from './actions/refineSummary'
import { CHAPTER_COUNT_OPTIONS, type RefinementLevel } from './constants'
import { snowflakeStore } from './store'

const REFINE_LEVELS: RefinementLevel[] = [1, 2, 3]

/** The node type one level down, or null for scenes (leaves). */
function childTypeOf(type: NodeType): NodeType | null {
  switch (type) {
    case 'book':
      return 'arc'
    case 'arc':
      return 'chapter'
    case 'chapter':
      return 'scene'
    case 'scene':
      return null
  }
}

interface SnowflakeItemActionsProps {
  node: Node
  hasChildren: boolean
}

export const SnowflakeItemActions: Component<SnowflakeItemActionsProps> = (props) => {
  const busy = () =>
    snowflakeStore.isLoading(props.node.id) ||
    snowflakeStore.isLoading(`${props.node.id}:refine`) ||
    snowflakeStore.isLoading(`${props.node.id}:summarize`)

  const childType = () => childTypeOf(props.node.type)

  const handleExpand = () => {
    const node = props.node
    if (node.type === 'book') void expandBook(node)
    else if (node.type === 'chapter') void expandChapter(node)
  }

  return (
    <div class={styles.actions}>
      <Show when={busy()}>
        <span class={styles.spinner} aria-label="Working…" />
      </Show>

      {/* Refine to a target detail level */}
      <Dropdown
        trigger={
          <button class={styles.actionButton} disabled={busy()} title="Refine the one-liner to a detail level">
            <PhPencilSimpleIcon />
            Refine
          </button>
        }
      >
        {REFINE_LEVELS.map((level) => (
          <DropdownItem onClick={() => void refineSummary(props.node, level)}>{`Level ${level}`}</DropdownItem>
        ))}
      </Dropdown>

      {/* Expand into children */}
      <Show when={props.node.type === 'arc'}>
        <Dropdown
          trigger={
            <button class={styles.actionButton} disabled={busy()} title="Expand into chapters">
              <PhTreeStructureIcon />
              Expand
            </button>
          }
        >
          {Object.entries(CHAPTER_COUNT_OPTIONS).map(([label, count]) => (
            <DropdownItem onClick={() => void expandArc(props.node, count)}>{`${label} (${count})`}</DropdownItem>
          ))}
        </Dropdown>
      </Show>
      <Show when={props.node.type === 'book' || props.node.type === 'chapter'}>
        <button class={styles.actionButton} disabled={busy()} onClick={handleExpand} title="Expand into children">
          <PhTreeStructureIcon />
          Expand
        </button>
      </Show>

      {/* Bottom-up summary from children */}
      <Show when={props.hasChildren}>
        <button
          class={styles.actionButton}
          disabled={busy()}
          onClick={() => void generateParentSummary(props.node)}
          title="Summarize this node from its children"
        >
          <PhArrowUpIcon />
          Summarize
        </button>
      </Show>

      {/* Structural edits */}
      <Dropdown
        alignRight
        trigger={
          <button class={styles.actionButton} title="More">
            <PhDotsThreeIcon />
          </button>
        }
      >
        <Show when={childType()}>
          {(type) => (
            <DropdownItem icon={<PhPlusCircleIcon />} onClick={() => nodeStore.addNode(props.node.id, type())}>
              {`Add ${type()}`}
            </DropdownItem>
          )}
        </Show>
        <DropdownItem
          icon={<PhPlusCircleIcon />}
          onClick={() => nodeStore.insertNodeBefore(props.node.id, props.node.type)}
        >
          {`Insert ${props.node.type} before`}
        </DropdownItem>
        <DropdownDivider />
        <DropdownItem
          icon={<PhTrashIcon />}
          onClick={() => {
            if (window.confirm(`Delete this ${props.node.type} and everything under it?`)) {
              nodeStore.deleteNode(props.node.id)
            }
          }}
        >
          Delete
        </DropdownItem>
      </Dropdown>
    </div>
  )
}
