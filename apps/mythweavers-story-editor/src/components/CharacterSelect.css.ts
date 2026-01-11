import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const trigger = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['1.5']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.base,
  border: `${tokens.borderWidth.thin} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.primary,
  minWidth: '150px',
  transition: 'all 0.15s ease',
  ':hover': {
    borderColor: tokens.color.border.strong,
    backgroundColor: tokens.color.surface.hover,
  },
  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
    boxShadow: `0 0 0 2px ${tokens.color.accent.primary}20`,
  },
})

export const triggerSmall = style({
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  minWidth: '120px',
})

export const triggerContent = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  flex: 1,
  overflow: 'hidden',
})

export const triggerPlaceholder = style({
  color: tokens.color.text.muted,
  fontStyle: 'italic',
})

export const triggerChevron = style({
  color: tokens.color.text.muted,
  flexShrink: 0,
  marginLeft: 'auto',
})

export const avatar = style({
  width: '24px',
  height: '24px',
  borderRadius: tokens.radius.full,
  objectFit: 'cover',
  flexShrink: 0,
})

export const avatarSmall = style({
  width: '20px',
  height: '20px',
})

export const avatarPlaceholder = style({
  width: '24px',
  height: '24px',
  borderRadius: tokens.radius.full,
  backgroundColor: tokens.color.bg.elevated,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: tokens.font.size.xs,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.muted,
  flexShrink: 0,
})

export const avatarPlaceholderSmall = style({
  width: '20px',
  height: '20px',
  fontSize: '10px',
})

export const characterName = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

export const protagonistStar = style({
  color: tokens.color.semantic.warning,
  flexShrink: 0,
  fontSize: tokens.font.size.sm,
})

export const menuItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  width: '100%',
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.primary,
  textAlign: 'left',
  transition: 'background-color 0.1s ease',
  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
})

export const menuItemActive = style({
  backgroundColor: `${tokens.color.accent.primary}15`,
})

export const menuItemContent = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  flex: 1,
  overflow: 'hidden',
})

export const menuDivider = style({
  height: '1px',
  backgroundColor: tokens.color.border.default,
  margin: `${tokens.space['1']} 0`,
})

export const clearOption = style({
  color: tokens.color.text.muted,
  fontStyle: 'italic',
})
