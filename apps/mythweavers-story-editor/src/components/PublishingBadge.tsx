import { Component, Show, createMemo } from 'solid-js'
import * as styles from './PublishingBadge.css'

export type PublishingState = 'draft' | 'scheduled' | 'live'

export function classifyPublishing(
  publishedAt: string | null | undefined,
  now: number = Date.now(),
): PublishingState {
  if (!publishedAt) return 'draft'
  const t = Date.parse(publishedAt)
  if (!Number.isFinite(t)) return 'draft'
  return t <= now ? 'live' : 'scheduled'
}

/**
 * Small status dot shown next to a chapter title in the tree.
 *
 * Re-classifies on every render (cheap — it's just a timestamp compare),
 * so any store update nearby re-checks whether a scheduled chapter has
 * flipped to live. We keep the dot tiny (no text) so the tree rows stay
 * dense; hover tooltip shows the human-readable state.
 *
 * If you need true wall-clock reactivity (e.g. modal showing a countdown
 * without nearby state changes), wrap the consumer in a createSignal +
 * setInterval ticker rather than building it here — most consumers don't
 * need it.
 */
interface PublishingBadgeProps {
  publishedAt: string | null | undefined
  /** Override current time (testing). */
  now?: number
  /** Size variant. "dot" is the tree default; "pill" is used inside modals. */
  variant?: 'dot' | 'pill'
}

export const PublishingBadge: Component<PublishingBadgeProps> = (props) => {
  const state = createMemo<PublishingState>(() =>
    classifyPublishing(props.publishedAt, props.now ?? Date.now()),
  )

  const label = createMemo(() => {
    const s = state()
    if (s === 'draft') return 'Draft'
    if (s === 'scheduled') {
      const t = props.publishedAt
        ? new Date(props.publishedAt).toLocaleString()
        : '?'
      return `Scheduled for ${t}`
    }
    // live
    const t = props.publishedAt ? new Date(props.publishedAt).toLocaleString() : ''
    return t ? `Live since ${t}` : 'Live'
  })

  const variantClass = () => (props.variant === 'pill' ? styles.pill : styles.dot)
  const stateClass = () => styles[state()]

  return (
    <span
      class={`${variantClass()} ${stateClass()}`}
      title={label()}
      aria-label={label()}
    >
      <Show when={props.variant === 'pill'}>
        <span class={styles.pillText}>{state() === 'draft' ? 'Draft' : state() === 'scheduled' ? 'Scheduled' : 'Live'}</span>
      </Show>
    </span>
  )
}
