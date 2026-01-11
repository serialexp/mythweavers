import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const itemLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem',
  borderRadius: tokens.radius.sm,
  cursor: 'pointer',
  transition: `background ${tokens.duration.fast}`,
})

export const sectionHeader = style({
  margin: '0 0 0.5rem 0',
  color: tokens.color.text.primary,
})

export const listContainer = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '0.5rem',
})

export const itemText = style({
  color: tokens.color.text.primary,
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
})

export const emptyMessage = style({
  color: tokens.color.text.muted,
  fontStyle: 'italic',
  margin: 0,
})

export const globalNote = style({
  marginTop: '0.5rem',
  fontSize: '0.85rem',
  color: tokens.color.text.muted,
  fontStyle: 'italic',
})

export const avatar = style({
  width: '48px',
  height: '48px',
  borderRadius: tokens.radius.full,
  objectFit: 'cover',
  flexShrink: 0,
  border: `1px solid ${tokens.color.border.default}`,
})

export const avatarPlaceholder = style({
  width: '48px',
  height: '48px',
  borderRadius: tokens.radius.full,
  backgroundColor: tokens.color.bg.elevated,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  fontWeight: 600,
  color: tokens.color.text.muted,
  flexShrink: 0,
  border: `1px solid ${tokens.color.border.default}`,
})
