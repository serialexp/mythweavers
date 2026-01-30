import { keyframes, style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
})

export const container = style({
  position: 'relative',
  display: 'inline-block',
})

export const trigger = style({
  cursor: 'pointer',
  padding: tokens.space['1'],
  borderRadius: tokens.radius.sm,
  transition: `background-color ${tokens.duration.fast} ${tokens.easing.default}`,
  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },
})

export const popup = style({
  position: 'fixed',
  top: 'auto',
  right: tokens.space['2'],
  bottom: tokens.space['2'],
  width: `calc(100vw - ${tokens.space['4']})`,
  maxWidth: '360px',
  maxHeight: `calc(100vh - ${tokens.space['8']})`,
  backgroundColor: tokens.color.bg.elevated,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.lg,
  boxShadow: tokens.shadow.xl,
  zIndex: tokens.zIndex.popover,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  '@media': {
    '(min-width: 640px)': {
      position: 'absolute',
      top: '100%',
      right: 0,
      bottom: 'auto',
      marginTop: tokens.space['1'],
      width: 'auto',
      minWidth: '300px',
      maxHeight: '400px',
    },
  },
})

export const header = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.raised,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  flexShrink: 0,
})

export const title = style({
  fontWeight: tokens.font.weight.semibold,
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.primary,
})

export const headerLeft = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const queueBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '20px',
  height: '20px',
  padding: `0 ${tokens.space['1']}`,
  fontSize: tokens.font.size.xs,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.inverse,
  backgroundColor: tokens.color.accent.primary,
  borderRadius: tokens.radius.full,
})

export const content = style({
  padding: tokens.space['3'],
  overflowY: 'auto',
  flex: 1,
  minHeight: 0,
})

export const section = style({
  marginBottom: tokens.space['3'],
  selectors: {
    '&:last-child': {
      marginBottom: 0,
    },
  },
})

export const sectionTitle = style({
  fontSize: tokens.font.size.xs,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.muted,
  textTransform: 'uppercase',
  letterSpacing: tokens.font.letterSpacing.wide,
  marginBottom: tokens.space['1'],
})

export const operationItem = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: tokens.space['2'],
  padding: tokens.space['2'],
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  marginBottom: tokens.space['1'],
  selectors: {
    '&:last-child': {
      marginBottom: 0,
    },
  },
})

export const operationIcon = style({
  flexShrink: 0,
  width: '16px',
  height: '16px',
  color: tokens.color.accent.primary,
})

export const operationIconSpinning = style([
  operationIcon,
  {
    animation: `${spin} 1s linear infinite`,
  },
])

export const operationDetails = style({
  flex: 1,
  minWidth: 0,
})

export const operationType = style({
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.medium,
  color: tokens.color.text.primary,
})

export const operationEntity = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})

export const emptyState = style({
  textAlign: 'center',
  padding: tokens.space['3'],
  color: tokens.color.text.muted,
  fontSize: tokens.font.size.sm,
})

export const backdrop = style({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: tokens.zIndex.dropdown,
})
