import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  width: '100%',
  padding: '0.5rem',
  background: tokens.color.bg.raised,
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 600,
  color: tokens.color.text.primary,
  fontSize: '0.9rem',
})

export const codeBlock = style({
  display: 'block',
  background: tokens.color.bg.elevated,
  padding: '0.5rem',
  borderRadius: '4px',
  fontFamily: 'monospace',
  fontSize: '0.85rem',
  whiteSpace: 'pre-wrap',
  color: tokens.color.text.primary,
})

export const codeBlockMargin = style([codeBlock, {
  marginTop: '0.25rem',
}])

export const sectionContent = style({
  padding: '0.75rem',
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
})

export const paragraph = style({
  margin: '0 0 0.5rem 0',
})

export const tipText = style({
  margin: 0,
  color: tokens.color.text.muted,
  fontStyle: 'italic',
})

export const subheading = style({
  marginBottom: '0.25rem',
  fontWeight: 500,
})

export const exampleHeading = style({
  marginTop: '0.5rem',
  marginBottom: '0.25rem',
  fontWeight: 500,
})
