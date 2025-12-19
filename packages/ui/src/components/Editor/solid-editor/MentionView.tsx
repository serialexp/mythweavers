import { type NodeViewProps, setPosInfo } from '@writer/solid-editor'
import type { JSX } from 'solid-js'
import type { MentionType } from './schema'

/**
 * Color mapping for different mention types
 */
const mentionTypeColors: Record<MentionType, { bg: string; text: string; border: string }> = {
  character: { bg: '#e3f2fd', text: '#1565c0', border: '#90caf9' },
  location: { bg: '#e8f5e9', text: '#2e7d32', border: '#a5d6a7' },
  item: { bg: '#fff3e0', text: '#ef6c00', border: '#ffcc80' },
  event: { bg: '#f3e5f5', text: '#7b1fa2', border: '#ce93d8' },
  custom: { bg: '#fafafa', text: '#616161', border: '#bdbdbd' },
}

/**
 * Icon mapping for different mention types (using simple unicode/text)
 */
const mentionTypeIcons: Record<MentionType, string> = {
  character: '@',
  location: '📍',
  item: '📦',
  event: '📅',
  custom: '#',
}

/**
 * Custom node view for rendering mention nodes.
 * Displays mentions as styled chips/tags with type-specific colors.
 */
export function MentionView(props: NodeViewProps): JSX.Element {
  const mentionType = () => (props.node.attrs.mentionType as MentionType) || 'character'
  const label = () => (props.node.attrs.label as string) || ''
  const id = () => props.node.attrs.id as string | null

  const colors = () => mentionTypeColors[mentionType()] || mentionTypeColors.custom
  const icon = () => mentionTypeIcons[mentionType()] || '@'

  // Selected styling - darker/highlighted when selected
  const selectedStyle = () =>
    props.selected
      ? {
          'box-shadow': '0 0 0 2px #1976d2',
          filter: 'brightness(0.9)',
        }
      : {}

  return (
    <span
      class={`solid-editor-mention ${props.selected ? 'selected' : ''}`}
      data-mention-type={mentionType()}
      data-mention-id={id()}
      contentEditable={false}
      ref={(el) => setPosInfo(el, { pos: props.pos, node: props.node })}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        gap: '2px',
        padding: '1px 6px',
        'border-radius': '4px',
        'font-size': '0.9em',
        'font-weight': '500',
        'white-space': 'nowrap',
        cursor: 'pointer',
        'user-select': 'none',
        '-webkit-user-select': 'none',
        'background-color': colors().bg,
        color: colors().text,
        border: `1px solid ${colors().border}`,
        transition: 'filter 0.15s ease, box-shadow 0.15s ease',
        ...selectedStyle(),
      }}
      // Prevent text selection inside the mention
      onMouseDown={(_e) => {
        // Don't prevent default here - we want the click to work
        // but stop propagation to prevent text selection drag
      }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        props.onSelect?.()
      }}
      onMouseEnter={(e) => {
        if (!props.selected) {
          e.currentTarget.style.filter = 'brightness(0.95)'
        }
      }}
      onMouseLeave={(e) => {
        if (!props.selected) {
          e.currentTarget.style.filter = 'none'
        }
      }}
      title={`${mentionType()}: ${label()}`}
    >
      <span class="mention-icon" style={{ opacity: '0.7' }}>
        {icon()}
      </span>
      <span class="mention-label">{label()}</span>
    </span>
  )
}

export default MentionView
