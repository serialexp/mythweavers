import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
})

export const dropZone = style({
  border: `2px dashed ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  padding: '2rem',
  textAlign: 'center',
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
  ':hover': {
    borderColor: tokens.color.accent.primary,
    backgroundColor: tokens.color.surface.hover,
  },
})

export const dropZoneActive = style({
  borderColor: tokens.color.accent.primary,
  backgroundColor: tokens.color.surface.hover,
})

export const dropZoneIcon = style({
  fontSize: '2rem',
  marginBottom: '0.5rem',
  color: tokens.color.text.secondary,
})

export const dropZoneText = style({
  color: tokens.color.text.secondary,
  marginBottom: '0.25rem',
})

export const dropZoneSubtext = style({
  color: tokens.color.text.muted,
  fontSize: '0.875rem',
})

export const contentContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  flex: 1,
  minHeight: 0,
})

export const conversationList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  maxHeight: '200px',
  overflowY: 'auto',
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  padding: '0.5rem',
})

export const conversationItem = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.75rem',
  borderRadius: tokens.radius.sm,
  cursor: 'pointer',
  transition: `background-color ${tokens.duration.fast} ${tokens.easing.default}`,
  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },
})

export const conversationItemSelected = style({
  backgroundColor: tokens.color.surface.selected,
  borderLeft: `3px solid ${tokens.color.accent.primary}`,
})

export const conversationName = style({
  fontWeight: 500,
  color: tokens.color.text.primary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '300px',
})

export const conversationMeta = style({
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  color: tokens.color.text.secondary,
  fontSize: '0.875rem',
})

export const previewSection = style({
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  padding: '1rem',
  flex: 1,
  minHeight: '200px',
  maxHeight: '300px',
  overflowY: 'auto',
  backgroundColor: tokens.color.surface.hover,
})

export const previewTitle = style({
  fontWeight: 600,
  marginBottom: '0.75rem',
  color: tokens.color.text.primary,
})

export const previewMessage = style({
  marginBottom: '1rem',
  padding: '0.75rem',
  backgroundColor: tokens.color.bg.base,
  borderRadius: tokens.radius.sm,
  ':last-child': {
    marginBottom: 0,
  },
})

export const previewMessageHuman = style({
  borderLeft: `3px solid ${tokens.color.accent.primary}`,
})

export const previewMessageAssistant = style({
  borderLeft: `3px solid ${tokens.color.semantic.success}`,
})

export const previewMessageRole = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  color: tokens.color.text.secondary,
  marginBottom: '0.25rem',
})

export const previewMessageContent = style({
  color: tokens.color.text.primary,
  fontSize: '0.875rem',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
})

export const previewEmpty = style({
  textAlign: 'center',
  color: tokens.color.text.muted,
  padding: '2rem',
})

export const importOptions = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '1rem',
  backgroundColor: tokens.color.surface.hover,
  borderRadius: tokens.radius.md,
})

export const importOption = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.5rem',
  cursor: 'pointer',
  borderRadius: tokens.radius.sm,
  ':hover': {
    backgroundColor: tokens.color.surface.active,
  },
})

export const importOptionDisabled = style({
  opacity: 0.5,
  cursor: 'not-allowed',
  pointerEvents: 'none',
})

export const footer = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem',
  marginTop: '1rem',
  paddingTop: '1rem',
  borderTop: `1px solid ${tokens.color.border.default}`,
})

export const errorText = style({
  color: tokens.color.semantic.error,
  fontSize: '0.875rem',
  marginTop: '0.5rem',
})

export const apiFetchRequired = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  color: tokens.color.text.secondary,
  fontSize: '0.875rem',
  lineHeight: 1.6,
})

export const apiLink = style({
  display: 'block',
  padding: '0.75rem',
  backgroundColor: tokens.color.bg.base,
  borderRadius: tokens.radius.sm,
  color: tokens.color.accent.primary,
  fontSize: '0.75rem',
  fontFamily: 'monospace',
  wordBreak: 'break-all',
  textDecoration: 'none',
  ':hover': {
    textDecoration: 'underline',
  },
})

export const apiLinkHint = style({
  color: tokens.color.text.muted,
  fontSize: '0.8rem',
  fontStyle: 'italic',
})

export const stepSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
})

export const stepLabel = style({
  fontWeight: 500,
  color: tokens.color.text.primary,
})

export const orgIdInput = style({
  padding: '0.5rem 0.75rem',
  borderRadius: tokens.radius.sm,
  border: `1px solid ${tokens.color.border.default}`,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: '0.875rem',
  fontFamily: 'monospace',
  width: '100%',
  ':focus': {
    outline: 'none',
    borderColor: tokens.color.accent.primary,
  },
  '::placeholder': {
    color: tokens.color.text.muted,
  },
})
