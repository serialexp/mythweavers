import { style, keyframes } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
})

export const nodeHeader = style({
  padding: tokens.space['4'],
  backgroundColor: tokens.color.bg.raised,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: tokens.space['4'],
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,
})

export const nodeHeaderLeft = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
  minWidth: 0,
})

export const nodeTitleSection = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const nodeTitle = style({
  fontSize: '1.125rem',
  fontWeight: 600,
  color: tokens.color.text.primary,
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

export const editInput = style({
  flex: 1,
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: '1.125rem',
  fontWeight: 600,
  outline: 'none',
})

export const statusBadge = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  flexShrink: 0,
})

export const nodeMetadata = style({
  display: 'flex',
  gap: tokens.space['4'],
  fontSize: '0.875rem',
  color: tokens.color.text.secondary,
})

export const metaItem = style({
  whiteSpace: 'nowrap',
})

export const activeContext = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
  marginTop: tokens.space['1'],
  padding: tokens.space['2'],
  backgroundColor: tokens.color.bg.elevated,
  borderRadius: tokens.radius.sm,
  fontSize: '0.875rem',
})

export const activeContextSection = style({
  display: 'flex',
  gap: tokens.space['1'],
  alignItems: 'flex-start',
})

export const contextLabel = style({
  color: tokens.color.text.secondary,
  fontWeight: 500,
  flexShrink: 0,
})

export const contextList = style({
  color: tokens.color.text.primary,
  flex: 1,
})

export const nodeActions = style({
  display: 'flex',
  gap: tokens.space['1'],
  alignItems: 'center',
})

export const actionButton = style({
  padding: tokens.space['1'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.secondary,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },

  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
})

export const dropdown = style({
  backgroundColor: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  boxShadow: tokens.shadow.lg,
  minWidth: '200px',
  padding: tokens.space['1'],
  display: 'flex',
  flexDirection: 'column',
})

export const dropdownButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  width: '100%',
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  border: 'none',
  background: 'none',
  color: tokens.color.text.primary,
  fontSize: '0.875rem',
  textAlign: 'left',
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
  borderRadius: tokens.radius.sm,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },

  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
})

export const dropdownDivider = style({
  height: '1px',
  backgroundColor: tokens.color.border.default,
  margin: `${tokens.space['1']} 0`,
})

export const deleteButton = style({
  color: tokens.color.semantic.error,
})

export const viewpointSelector = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
  padding: tokens.space['2'],
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.sm,
  margin: `${tokens.space['1']} 0`,
})

export const viewpointHeader = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  color: tokens.color.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: `0 ${tokens.space['2']}`,
  marginBottom: tokens.space['1'],
})

export const viewpointOption = style({
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  cursor: 'pointer',

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },
})

export const viewpointCancel = style({
  marginTop: tokens.space['1'],
  color: tokens.color.text.secondary,
  fontSize: '0.875rem',
})

export const summarySection = style({
  padding: `0 ${tokens.space['4']}`,
  marginTop: `calc(-1 * ${tokens.space['1']})`,
  marginBottom: tokens.space['2'],
})

export const summaryText = style({
  fontSize: '0.875rem',
  color: tokens.color.text.secondary,
  lineHeight: 1.5,
  padding: tokens.space['2'],
  backgroundColor: tokens.color.bg.elevated,
  borderRadius: tokens.radius.sm,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },
})

export const summaryTextCollapsed = style({
  maxHeight: '3.5rem',
  overflow: 'hidden',
})

export const goalSection = style({
  padding: `0 ${tokens.space['4']}`,
  marginTop: `calc(-1 * ${tokens.space['1']})`,
  marginBottom: tokens.space['2'],
})

export const goalLabel = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  color: tokens.color.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: tokens.space['1'],
})

export const goalText = style({
  fontSize: '0.875rem',
  color: tokens.color.text.primary,
  lineHeight: 1.5,
  padding: tokens.space['2'],
  backgroundColor: tokens.color.bg.elevated,
  borderRadius: tokens.radius.sm,
  fontStyle: 'italic',
})

export const goalInput = style({
  width: '100%',
  padding: tokens.space['2'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  lineHeight: 1.5,
  resize: 'vertical',
  outline: 'none',

  ':focus': {
    borderColor: tokens.color.border.focus,
  },
})

export const spinner = style({
  display: 'inline-block',
  animation: `${spin} 1s linear infinite`,
})
