import { tokens } from '@mythweavers/ui/tokens'
import { style } from '@vanilla-extract/css'

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
})

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  backgroundColor: tokens.color.bg.raised,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  flexShrink: 0,
})

export const headerLeft = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['3'],
})

export const backButton = style({
  background: 'none',
  border: 'none',
  color: tokens.color.text.secondary,
  cursor: 'pointer',
  padding: tokens.space['1'],
  fontSize: '1.2rem',
  lineHeight: 1,

  ':hover': {
    color: tokens.color.text.primary,
  },
})

export const title = style({
  fontSize: '1rem',
  fontWeight: 600,
  color: tokens.color.text.primary,
})

export const content = style({
  flex: 1,
  overflow: 'auto',
  padding: tokens.space['4'],
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
  maxWidth: '52rem',
  width: '100%',
  margin: '0 auto',
})

export const intro = style({
  margin: 0,
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size.sm,
  lineHeight: tokens.font.lineHeight.normal,
})

export const list = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['3'],
})

export const item = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: tokens.space['4'],
  padding: tokens.space['4'],
  backgroundColor: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.subtle}`,
  borderRadius: tokens.radius.lg,
})

export const itemMain = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  minWidth: 0,
})

export const itemHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  flexWrap: 'wrap',
})

export const itemName = style({
  fontWeight: 600,
  color: tokens.color.text.primary,
  overflowWrap: 'anywhere',
})

export const kindBadge = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  border: `1px solid ${tokens.color.border.subtle}`,
  borderRadius: tokens.radius.full,
  padding: `${tokens.space['0.5']} ${tokens.space['2']}`,
  whiteSpace: 'nowrap',
})

export const itemMeta = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space['3'],
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.muted,
})

export const scopes = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space['2'],
})

export const scope = style({
  fontFamily: tokens.font.family.mono,
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.secondary,
  backgroundColor: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.subtle}`,
  borderRadius: tokens.radius.sm,
  padding: `${tokens.space['0.5']} ${tokens.space['1.5']}`,
})

export const empty = style({
  margin: 0,
  padding: tokens.space['8'],
  textAlign: 'center',
  color: tokens.color.text.muted,
})

export const loading = style({
  display: 'flex',
  justifyContent: 'center',
  padding: tokens.space['8'],
})
