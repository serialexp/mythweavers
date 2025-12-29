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

export const nodeHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
})

export const nodeMetaContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  flexWrap: 'wrap',
})

export const nodeMeta = style({
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
})

export const nodeTypeIcon = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
})
