import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const modalContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
  maxHeight: '80vh',
  overflowY: 'auto',
})

export const contextNodesInfo = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: tokens.space['1'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const contextLabel = style({
  color: tokens.color.text.muted,
  flexShrink: 0,
})

export const nodeList = style({
  color: tokens.color.text.primary,
  fontWeight: tokens.font.weight.medium,
})

export const noContextWarning = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  fontSize: tokens.font.size.sm,
  color: tokens.color.accent.primary,
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const formSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const label = style({
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.medium,
  color: tokens.color.text.secondary,
})

export const textarea = style({
  width: '100%',
  minHeight: '80px',
  padding: tokens.space['2'],
  fontSize: '1rem',
  fontFamily: 'inherit',
  color: tokens.color.text.primary,
  backgroundColor: tokens.color.bg.base,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  resize: 'vertical',
  transition: `border-color ${tokens.duration.fast} ${tokens.easing.default}`,

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },
})

export const select = style({
  width: '100%',
  padding: tokens.space['2'],
  fontSize: '1rem',
  color: tokens.color.text.primary,
  backgroundColor: tokens.color.bg.base,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },
})

export const diffContainer = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: tokens.space['4'],
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
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.secondary,
  paddingBottom: tokens.space['1'],
  borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const diffContent = style({
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: tokens.font.size.sm,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  padding: tokens.space['3'],
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  maxHeight: '300px',
  overflowY: 'auto',
  lineHeight: 1.6,
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

export const actions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: tokens.space['2'],
  paddingTop: tokens.space['2'],
  borderTop: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const loadingContainer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: tokens.space['8'],
  gap: tokens.space['2'],
  color: tokens.color.text.secondary,
})

export const tokenEstimate = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
})

export const tokenEstimateWarning = style({
  color: '#f59e0b', // amber warning color
})

export const tokenEstimateError = style({
  color: '#ef4444', // red error color
})
