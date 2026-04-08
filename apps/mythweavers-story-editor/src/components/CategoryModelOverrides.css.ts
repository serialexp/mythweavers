import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
})

export const description = style({
  fontSize: '0.875rem',
  color: tokens.color.text.secondary,
  lineHeight: 1.5,
  margin: 0,
})

export const categoryList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['3'],
})

export const categoryCard = style({
  padding: tokens.space['3'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const categoryHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: tokens.space['2'],
})

export const categoryInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['0.5'],
  flex: 1,
  minWidth: 0,
})

export const categoryLabel = style({
  fontSize: '0.875rem',
  fontWeight: 600,
  color: tokens.color.text.primary,
})

export const categoryDescription = style({
  fontSize: '0.75rem',
  color: tokens.color.text.muted,
})

export const currentModel = style({
  fontSize: '0.75rem',
  color: tokens.color.text.secondary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

export const overrideBadge = style({
  fontSize: '0.625rem',
  fontWeight: 600,
  color: tokens.color.accent.primary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
})

export const actions = style({
  display: 'flex',
  gap: tokens.space['2'],
  flexShrink: 0,
})

export const actionButton = style({
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.secondary,
  fontSize: '0.75rem',
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
    color: tokens.color.text.primary,
  },
})

export const clearButton = style({
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.semantic.error,
  fontSize: '0.75rem',
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: `color-mix(in srgb, ${tokens.color.semantic.error} 10%, transparent)`,
  },
})

export const overrideForm = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  paddingTop: tokens.space['2'],
  borderTop: `1px solid ${tokens.color.border.default}`,
})

export const formRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const formLabel = style({
  fontSize: '0.7rem',
  fontWeight: 600,
  color: tokens.color.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
})

export const select = style({
  width: '100%',
  padding: tokens.space['2'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: '0.875rem',
  cursor: 'pointer',

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },
})

export const warningText = style({
  fontSize: '0.75rem',
  color: tokens.color.semantic.warning,
  fontStyle: 'italic',
})
