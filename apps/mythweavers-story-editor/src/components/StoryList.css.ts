import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
})

export const loadingOverlay = style({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  backdropFilter: 'blur(2px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1rem',
  borderRadius: '8px',
  zIndex: 10,
  color: tokens.color.text.primary,
})

export const headerRow = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.5rem',
})

export const storyName = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontWeight: 500,
  fontSize: '1.1rem',
  color: tokens.color.text.primary,
})

export const storyTypeIcon = style({
  width: '16px',
  height: '16px',
  color: tokens.color.text.secondary,
})

export const warningIcon = style({
  width: '16px',
  height: '16px',
  color: tokens.color.semantic.warning,
})

export const actionButtons = style({
  display: 'flex',
  gap: '0.25rem',
})

export const metaRow = style({
  display: 'flex',
  gap: '1rem',
  fontSize: '0.9rem',
  color: tokens.color.text.secondary,
  flexWrap: 'wrap',
})

export const metaDate = style({
  marginLeft: 'auto',
})

export const storySetting = style({
  fontSize: '0.9rem',
  color: tokens.color.text.secondary,
  fontStyle: 'italic',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

export const currentStoryBorder = style({
  borderColor: tokens.color.accent.primary,
})
