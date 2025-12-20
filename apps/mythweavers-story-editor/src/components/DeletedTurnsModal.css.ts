import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const loadingContainer = style({
  textAlign: 'center',
  padding: '2rem',
})

export const loadingText = style({
  color: tokens.color.text.secondary,
  marginTop: '0.5rem',
})

export const emptyMessage = style({
  textAlign: 'center',
  padding: '3rem 2rem',
  color: tokens.color.text.secondary,
  fontSize: '1.1rem',
})

export const messageHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.75rem',
})

export const messageMetaContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  flexWrap: 'wrap',
})

export const messageMeta = style({
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
})

export const messageTokens = style({
  color: tokens.color.text.secondary,
  fontSize: '0.85rem',
})

export const messageInstruction = style({
  marginBottom: '0.5rem',
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
  fontStyle: 'italic',
})

export const messageContent = style({
  lineHeight: 1.6,
  color: tokens.color.text.primary,
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
})
