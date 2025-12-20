import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const warningIconContainer = style({
  display: 'flex',
  justifyContent: 'center',
})

export const message = style({
  margin: 0,
  color: tokens.color.text.secondary,
  lineHeight: 1.5,
  textAlign: 'center',
})

export const storageBar = style({
  position: 'relative',
  height: '24px',
  background: tokens.color.bg.elevated,
  borderRadius: '12px',
  overflow: 'hidden',
})

export const storageBarFill = style({
  position: 'absolute',
  top: 0,
  left: 0,
  height: '100%',
  background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
  transition: 'width 0.3s ease',
})

export const storageBarLabel = style({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: tokens.color.text.primary,
  zIndex: 1,
})

export const sectionHeader = style({
  margin: '0 0 12px 0',
  fontSize: '1.125rem',
  color: tokens.color.text.primary,
})

export const storyListContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  maxHeight: '300px',
  overflowY: 'auto',
  padding: '4px',
})

export const storyItem = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px',
  background: tokens.color.bg.raised,
  borderRadius: '8px',
  border: `1px solid ${tokens.color.border.default}`,
})

export const storyItemContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  minWidth: 0,
})

export const storyName = style({
  fontWeight: 500,
  color: tokens.color.text.primary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

export const storyMeta = style({
  fontSize: '0.75rem',
  color: tokens.color.text.secondary,
})

export const emptyMessage = style({
  textAlign: 'center',
  color: tokens.color.text.secondary,
  padding: '20px',
})

export const otherDataButtons = style({
  display: 'flex',
  gap: '12px',
})
