import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const checkboxLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  color: tokens.color.text.secondary,
  fontSize: '0.9em',
  cursor: 'pointer',
})

export const checkboxLabelDisabled = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  color: tokens.color.text.secondary,
  fontSize: '0.9em',
  opacity: 0.6,
  cursor: 'not-allowed',
})

export const optionsRow = style({
  marginTop: '10px',
  display: 'flex',
  gap: '15px',
  alignItems: 'center',
  flexWrap: 'wrap',
})

export const resultsHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingBottom: '10px',
  borderBottom: `1px solid ${tokens.color.border.default}`,
  color: tokens.color.text.secondary,
  fontSize: '0.9em',
})

export const resultsContainer = style({
  flex: 1,
  overflowY: 'auto',
  maxHeight: '50vh',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginTop: '8px',
})

export const resultHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '8px',
  fontSize: '0.9em',
})

export const resultTitle = style({
  color: tokens.color.text.primary,
  fontWeight: tokens.font.weight.medium,
})

export const snippetContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
})

export const sectionLabel = style({
  color: tokens.color.text.secondary,
  fontSize: '0.8em',
  fontWeight: tokens.font.weight.medium,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
})

export const snippetText = style({
  color: tokens.color.text.primary,
  lineHeight: tokens.font.lineHeight.normal,
  fontSize: '0.9em',
})

export const replacePreviewContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '8px',
  background: tokens.color.bg.elevated,
  borderRadius: tokens.radius.sm,
})

export const replacePreviewText = style({
  fontFamily: tokens.font.family.mono,
  fontSize: '0.9em',
  lineHeight: tokens.font.lineHeight.normal,
  color: tokens.color.text.primary,
})

export const deleteHighlight = style({
  background: 'rgba(255, 0, 0, 0.2)',
  color: '#ff4444',
  textDecoration: 'line-through',
  padding: '2px 4px',
  borderRadius: '2px',
})

export const insertHighlight = style({
  background: 'rgba(0, 255, 0, 0.2)',
  color: '#44ff44',
  padding: '2px 4px',
  borderRadius: '2px',
  fontWeight: tokens.font.weight.medium,
})

export const searchHighlight = style({
  background: tokens.color.semantic.warning,
  color: tokens.color.bg.base,
  padding: '1px 2px',
  borderRadius: '2px',
  fontWeight: tokens.font.weight.medium,
})

export const buttonRow = style({
  display: 'flex',
  gap: '8px',
  marginTop: '4px',
})

export const replaceAllDivider = style({
  marginTop: '8px',
  paddingTop: '8px',
  borderTop: `1px solid ${tokens.color.border.default}`,
})

export const showMoreRow = style({
  display: 'flex',
  justifyContent: 'center',
  padding: '10px 0',
  borderTop: `1px solid ${tokens.color.border.default}`,
})

export const footerActions = style({
  display: 'flex',
  gap: '10px',
  justifyContent: 'flex-end',
  paddingTop: '10px',
  borderTop: `1px solid ${tokens.color.border.default}`,
})
