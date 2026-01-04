import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const label = style({
  display: 'block',
  marginBottom: '0.25rem',
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
})

export const selectionInfo = style({
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
})

export const messageListContainer = style({
  maxHeight: '300px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
})

export const messageCardSelected = style({
  cursor: 'pointer',
  border: `2px solid ${tokens.color.accent.primary}`,
  background: tokens.color.surface.selected,
})

export const messageCardUnselected = style({
  cursor: 'pointer',
  border: `1px solid ${tokens.color.border.default}`,
  background: tokens.color.bg.base,
})

export const messageContent = style({
  color: tokens.color.text.primary,
  fontSize: '0.9rem',
  lineHeight: 1.4,
})

export const footer = style({
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'flex-end',
  padding: '1rem',
  borderTop: `1px solid ${tokens.color.border.default}`,
})

// Results preview styles
export const resultsContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
  maxHeight: '60vh',
  overflowY: 'auto',
})

export const resultCard = style({
  padding: tokens.space['3'],
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  transition: `opacity ${tokens.duration.fast} ${tokens.easing.default}`,
})

export const resultCardAccepted = style({
  opacity: 0.6,
  borderColor: '#22c55e',
})

export const resultHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  marginBottom: tokens.space['2'],
})

export const resultTitle = style({
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  flex: 1,
  fontSize: tokens.font.size.sm,
})

export const resultActions = style({
  display: 'flex',
  gap: tokens.space['1'],
})

export const acceptButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  padding: 0,
  backgroundColor: 'rgba(34, 197, 94, 0.15)',
  color: '#22c55e',
  border: 'none',
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  transition: `background-color ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
  },
})

export const rejectButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  padding: 0,
  backgroundColor: 'rgba(239, 68, 68, 0.15)',
  color: '#ef4444',
  border: 'none',
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  transition: `background-color ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
})

export const acceptedBadge = style({
  fontSize: tokens.font.size.xs,
  fontWeight: tokens.font.weight.medium,
  color: '#22c55e',
  padding: `${tokens.space['0.5']} ${tokens.space['2']}`,
  backgroundColor: 'rgba(34, 197, 94, 0.15)',
  borderRadius: tokens.radius.default,
})

export const errorBadge = style({
  fontSize: tokens.font.size.xs,
  fontWeight: tokens.font.weight.medium,
  color: '#ef4444',
  padding: `${tokens.space['0.5']} ${tokens.space['2']}`,
  backgroundColor: 'rgba(239, 68, 68, 0.15)',
  borderRadius: tokens.radius.default,
})

export const diffContainer = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: tokens.space['3'],
  marginTop: tokens.space['2'],

  '@media': {
    '(max-width: 768px)': {
      gridTemplateColumns: '1fr',
    },
  },
})

export const diffPane = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const diffHeader = style({
  fontSize: tokens.font.size.xs,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.secondary,
  paddingBottom: tokens.space['1'],
  borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const diffContent = style({
  fontFamily: 'inherit',
  fontSize: tokens.font.size.xs,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  padding: tokens.space['2'],
  backgroundColor: tokens.color.bg.base,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  maxHeight: '200px',
  overflowY: 'auto',
  lineHeight: 1.5,
})

export const diffLine = style({
  display: 'block',
  padding: `${tokens.space['0.5']} 0`,
})

export const diffLineAdded = style({
  backgroundColor: 'rgba(34, 197, 94, 0.15)',
  color: '#22c55e',
})

export const diffLineRemoved = style({
  backgroundColor: 'rgba(239, 68, 68, 0.15)',
  color: '#ef4444',
  textDecoration: 'line-through',
})

export const loadingContainer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: tokens.space['6'],
  gap: tokens.space['2'],
  color: tokens.color.text.secondary,
})
