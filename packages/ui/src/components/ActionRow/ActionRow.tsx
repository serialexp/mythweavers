import { type JSX, Show, splitProps } from 'solid-js'
import * as styles from './ActionRow.css'

export interface ActionRowProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Primary text */
  title: JSX.Element
  /** Secondary text below the title */
  description?: JSX.Element
  /** Trailing actions (buttons, icons, etc.) */
  actions?: JSX.Element
  /** Makes the row clickable with hover effects */
  interactive?: boolean
}

export function ActionRow(props: ActionRowProps) {
  const [local, rest] = splitProps(props, [
    'title',
    'description',
    'actions',
    'interactive',
    'class',
    'children',
  ])

  return (
    <div
      class={`${styles.row({ interactive: local.interactive ?? !!rest.onClick })} ${local.class ?? ''}`}
      {...rest}
    >
      <div class={styles.content}>
        <div class={styles.title}>{local.title}</div>
        <Show when={local.description}>
          <div class={styles.description}>{local.description}</div>
        </Show>
      </div>
      <Show when={local.actions}>
        <div class={styles.actions}>{local.actions}</div>
      </Show>
    </div>
  )
}
