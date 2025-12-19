import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  flex: 1,
})

export const modelDisplay = style({
  flex: 1,
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.elevated,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  color: tokens.color.text.primary,
  fontSize: tokens.font.size.sm,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

export const table = style({
  width: '100%',
  borderCollapse: 'collapse',
})

export const tableHeader = style({
  display: 'grid',
  gridTemplateColumns: '1fr 100px 100px 120px 80px',
  gap: tokens.space['2'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.base,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  fontWeight: tokens.font.weight.semibold,
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const tableBody = style({
  maxHeight: '400px',
  overflowY: 'auto',
})

export const tableRow = style({
  display: 'grid',
  gridTemplateColumns: '1fr 100px 100px 120px 80px',
  gap: tokens.space['2'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  borderBottom: `1px solid ${tokens.color.border.subtle}`,
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.primary,
  cursor: 'pointer',
  transition: `background-color ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },
})

export const tableRowSelected = style({
  backgroundColor: tokens.color.surface.selected,

  ':hover': {
    backgroundColor: tokens.color.surface.selected,
  },
})

export const colModel = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

export const colPrice = style({
  textAlign: 'right',
  fontFamily: tokens.font.family.mono,
})

export const colComparison = style({
  textAlign: 'right',
  color: tokens.color.text.muted,
  fontSize: tokens.font.size.xs,
})

export const colContext = style({
  textAlign: 'right',
  fontFamily: tokens.font.family.mono,
})

export const loadingMessage = style({
  padding: tokens.space['8'],
  textAlign: 'center',
  color: tokens.color.text.muted,
})

// Mobile responsive styles
export const mobileComparison = style({
  display: 'none',
  '@media': {
    '(max-width: 768px)': {
      display: 'block',
    },
  },
})

export const desktopComparison = style({
  '@media': {
    '(max-width: 768px)': {
      display: 'none',
    },
  },
})
