import { keyframes, style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  maxHeight: '100%',
})

export const messages = style({
  flex: 1,
  overflowY: 'auto',
  padding: tokens.space['3'],
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['3'],
})

export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  color: tokens.color.text.muted,
  fontSize: '0.9rem',
  textAlign: 'center',
  gap: tokens.space['2'],
  padding: tokens.space['4'],
})

export const emptyStateIcon = style({
  fontSize: '2rem',
  opacity: 0.5,
})

export const messageBubble = style({
  maxWidth: '85%',
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  borderRadius: tokens.radius.md,
  fontSize: '0.9rem',
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
})

export const userBubble = style([
  messageBubble,
  {
    alignSelf: 'flex-end',
    backgroundColor: tokens.color.accent.primary,
    color: '#fff',
  },
])

export const assistantBubble = style([
  messageBubble,
  {
    alignSelf: 'flex-start',
    backgroundColor: tokens.color.bg.raised,
    border: `1px solid ${tokens.color.border.default}`,
    color: tokens.color.text.primary,
  },
])

const pulse = keyframes({
  '0%, 100%': { opacity: 0.3 },
  '50%': { opacity: 1 },
})

export const streamingDots = style({
  display: 'inline-flex',
  gap: '4px',
  alignItems: 'center',
  padding: `${tokens.space['1']} 0`,
})

export const streamingDot = style({
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  backgroundColor: tokens.color.text.muted,
  animation: `${pulse} 1.2s ease-in-out infinite`,
  selectors: {
    '&:nth-child(2)': {
      animationDelay: '0.2s',
    },
    '&:nth-child(3)': {
      animationDelay: '0.4s',
    },
  },
})

export const inputArea = style({
  flexShrink: 0,
  padding: tokens.space['3'],
  borderTop: `1px solid ${tokens.color.border.default}`,
  display: 'flex',
  gap: tokens.space['2'],
  alignItems: 'flex-end',
})

export const textInput = style({
  flex: 1,
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  color: tokens.color.text.primary,
  fontFamily: 'inherit',
  fontSize: '0.9rem',
  resize: 'none',
  minHeight: '40px',
  maxHeight: '120px',
  lineHeight: 1.5,

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },

  '::placeholder': {
    color: tokens.color.text.muted,
  },

  ':disabled': {
    opacity: 0.5,
  },
})

export const footerRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `0 ${tokens.space['3']} ${tokens.space['2']}`,
})

export const clearButton = style({
  fontSize: '0.75rem',
  color: tokens.color.text.muted,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  borderRadius: tokens.radius.sm,

  ':hover': {
    color: tokens.color.text.secondary,
    backgroundColor: tokens.color.surface.hover,
  },
})

export const modelLabel = style({
  fontSize: '0.7rem',
  color: tokens.color.text.muted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '200px',
})
