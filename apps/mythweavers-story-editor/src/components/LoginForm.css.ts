import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
})

export const title = style({
  textAlign: 'center',
  marginBottom: '0.5rem',
  color: tokens.color.text.primary,
  fontSize: '1.5rem',
})

export const form = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
})

export const switchModeText = style({
  textAlign: 'center',
  marginTop: '1rem',
  color: tokens.color.text.secondary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.25rem',
})

export const dividerContainer = style({
  position: 'relative',
  textAlign: 'center',
  margin: '1.5rem 0',
})

export const dividerLine = style({
  position: 'absolute',
  top: '50%',
  left: 0,
  right: 0,
  height: '1px',
  background: tokens.color.border.default,
})

export const dividerText = style({
  background: tokens.color.bg.base,
  padding: '0 1rem',
  position: 'relative',
  color: tokens.color.text.muted,
  fontSize: '0.875rem',
})
