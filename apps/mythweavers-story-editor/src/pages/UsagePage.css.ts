import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

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
})

export const summaryCards = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: tokens.space['3'],
  marginBottom: tokens.space['6'],
})

export const summaryCard = style({
  padding: tokens.space['3'],
  backgroundColor: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
})

export const summaryLabel = style({
  fontSize: '0.7rem',
  fontWeight: 600,
  color: tokens.color.text.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: tokens.space['1'],
})

export const summaryValue = style({
  fontSize: '1.25rem',
  fontWeight: 700,
  color: tokens.color.text.primary,
  fontFamily: tokens.font.family.mono,
})

export const filterRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  marginBottom: tokens.space['4'],
})

export const filterSelect = style({
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: '0.8125rem',
  cursor: 'pointer',

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },
})

export const filterLabel = style({
  fontSize: '0.8125rem',
  color: tokens.color.text.secondary,
})

export const table = style({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.8125rem',
})

export const tableHeader = style({
  textAlign: 'left',
  padding: `${tokens.space['2']} ${tokens.space['2']}`,
  borderBottom: `2px solid ${tokens.color.border.default}`,
  color: tokens.color.text.muted,
  fontWeight: 600,
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap',
})

export const tableRow = style({
  borderBottom: `1px solid ${tokens.color.border.subtle}`,
  transition: `background-color ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },
})

export const tableCell = style({
  padding: `${tokens.space['2']} ${tokens.space['2']}`,
  verticalAlign: 'top',
})

export const tableCellMono = style({
  padding: `${tokens.space['2']} ${tokens.space['2']}`,
  verticalAlign: 'top',
  fontFamily: tokens.font.family.mono,
  fontSize: '0.75rem',
})

export const amountPositive = style({
  color: tokens.color.semantic.success,
  fontWeight: 600,
})

export const amountNegative = style({
  color: tokens.color.semantic.error,
  fontWeight: 600,
})

export const badge = style({
  display: 'inline-block',
  padding: `1px ${tokens.space['2']}`,
  borderRadius: tokens.radius.sm,
  fontSize: '0.6875rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
})

export const badgeLlm = style([badge, {
  backgroundColor: 'rgba(139, 92, 246, 0.15)',
  color: 'rgb(167, 139, 250)',
}])

export const badgeTopup = style([badge, {
  backgroundColor: 'rgba(34, 197, 94, 0.15)',
  color: 'rgb(74, 222, 128)',
}])

export const badgeCredit = style([badge, {
  backgroundColor: 'rgba(59, 130, 246, 0.15)',
  color: 'rgb(96, 165, 250)',
}])

export const badgeAdjustment = style([badge, {
  backgroundColor: 'rgba(234, 179, 8, 0.15)',
  color: 'rgb(250, 204, 21)',
}])

export const detailsRow = style({
  display: 'flex',
  gap: tokens.space['4'],
  flexWrap: 'wrap',
  marginTop: tokens.space['1'],
})

export const detailItem = style({
  fontSize: '0.7rem',
  color: tokens.color.text.muted,
})

export const detailLabel = style({
  marginRight: tokens.space['1'],
})

export const detailValue = style({
  fontFamily: tokens.font.family.mono,
  color: tokens.color.text.secondary,
})

export const pagination = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['4']} 0`,
})

export const pageInfo = style({
  fontSize: '0.8125rem',
  color: tokens.color.text.muted,
})

export const emptyState = style({
  textAlign: 'center',
  padding: `${tokens.space['8']} 0`,
  color: tokens.color.text.muted,
  fontSize: '0.875rem',
})

export const loadingState = style({
  display: 'flex',
  justifyContent: 'center',
  padding: `${tokens.space['8']} 0`,
})

export const modelName = style({
  fontWeight: 500,
  color: tokens.color.text.primary,
})

export const description = style({
  color: tokens.color.text.secondary,
})

export const timeRangeButtons = style({
  display: 'flex',
  gap: '1px',
})

const timeRangeButtonBase = style({
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  border: `1px solid ${tokens.color.border.default}`,
  borderLeft: 'none',
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.secondary,
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  selectors: {
    '&:first-child': {
      borderLeft: `1px solid ${tokens.color.border.default}`,
      borderRadius: `${tokens.radius.sm} 0 0 ${tokens.radius.sm}`,
    },
    '&:last-child': {
      borderRadius: `0 ${tokens.radius.sm} ${tokens.radius.sm} 0`,
    },
  },

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
    color: tokens.color.text.primary,
  },
})

export const timeRangeButton = timeRangeButtonBase

export const timeRangeButtonActive = style([timeRangeButtonBase, {
  backgroundColor: 'rgba(139, 92, 246, 0.2)',
  color: 'rgb(167, 139, 250)',
  borderColor: 'rgba(139, 92, 246, 0.4)',
}])
