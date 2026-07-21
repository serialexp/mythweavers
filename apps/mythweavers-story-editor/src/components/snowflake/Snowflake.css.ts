import { tokens } from '@mythweavers/ui/tokens'
import { keyframes, style, styleVariants } from '@vanilla-extract/css'

const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
})

// ---- Page layout ----

export const page = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  background: tokens.color.bg.base,
})

export const toolbar = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: tokens.space['2'],
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  background: tokens.color.bg.raised,
  '@media': {
    'screen and (max-width: 640px)': {
      padding: `${tokens.space['1.5']} ${tokens.space['2']}`,
    },
  },
})

export const toolbarLeft = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['3'],
  flexWrap: 'wrap',
  minWidth: 0,
})

export const levelControl = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0,
  borderRadius: tokens.radius.sm,
  border: `1px solid ${tokens.color.border.default}`,
  overflow: 'hidden',
})

export const toolbarTitle = style({
  fontSize: tokens.font.size.lg,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
})

export const scrollArea = style({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: tokens.space['4'],
  minHeight: 0,
  '@media': {
    'screen and (max-width: 640px)': {
      padding: tokens.space['2'],
    },
  },
})

export const content = style({
  maxWidth: '900px',
  width: '100%',
  margin: '0 auto',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
  '@media': {
    'screen and (max-width: 640px)': {
      gap: tokens.space['2'],
    },
  },
})

// ---- Story concept block ----

export const conceptBlock = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  padding: tokens.space['4'],
  borderRadius: tokens.radius.lg,
  border: `1px solid ${tokens.color.border.default}`,
  background: tokens.color.bg.raised,
  minWidth: 0,
  '@media': {
    'screen and (max-width: 640px)': {
      padding: tokens.space['2.5'],
    },
  },
})

export const sectionLabel = style({
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: tokens.font.letterSpacing.wide,
})

export const conceptControls = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  flexWrap: 'wrap',
})

// ---- Node cards (nested) ----

const cardBase = style({
  borderRadius: tokens.radius.md,
  border: `1px solid ${tokens.color.border.subtle}`,
  padding: tokens.space['3'],
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  minWidth: 0,
  '@media': {
    'screen and (max-width: 640px)': {
      padding: tokens.space['2'],
    },
  },
})

// Outer -> inner shading, mirroring the legacy snowflake nesting.
export const card = styleVariants({
  book: [cardBase, { background: tokens.color.bg.raised }],
  arc: [cardBase, { background: tokens.color.surface.default }],
  chapter: [cardBase, { background: tokens.color.surface.hover }],
  scene: [cardBase, { background: tokens.color.surface.active }],
})

export const cardHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  flexWrap: 'wrap',
  minWidth: 0,
})

export const expandToggle = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: tokens.color.text.secondary,
  padding: tokens.space['0.5'],
  borderRadius: tokens.radius.sm,
  selectors: {
    '&:hover': { color: tokens.color.text.primary },
  },
})

export const typeBadge = style({
  fontSize: tokens.font.size.xs,
  fontWeight: tokens.font.weight.semibold,
  textTransform: 'uppercase',
  letterSpacing: tokens.font.letterSpacing.wide,
  color: tokens.color.text.muted,
})

export const levelBadge = style({
  fontSize: tokens.font.size.xs,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.accent.primary,
  border: `1px solid ${tokens.color.accent.primary}`,
  borderRadius: tokens.radius.full,
  padding: `0 ${tokens.space['1.5']}`,
})

export const titleInput = style({
  flex: 1,
  minWidth: '8rem',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: tokens.radius.sm,
  color: tokens.color.text.primary,
  fontSize: tokens.font.size.base,
  fontWeight: tokens.font.weight.medium,
  padding: `${tokens.space['0.5']} ${tokens.space['1']}`,
  selectors: {
    '&:hover': { borderColor: tokens.color.border.subtle },
    '&:focus': { borderColor: tokens.color.border.focus, outline: 'none' },
  },
})

export const childrenContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  paddingLeft: tokens.space['3'],
  borderLeft: `2px solid ${tokens.color.border.subtle}`,
  marginLeft: tokens.space['1'],
  minWidth: 0,
  '@media': {
    'screen and (max-width: 640px)': {
      paddingLeft: tokens.space['1.5'],
      marginLeft: 0,
    },
  },
})

// ---- One-liner textarea ----

export const textarea = style({
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  resize: 'none',
  overflow: 'hidden',
  background: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  color: tokens.color.text.primary,
  fontSize: tokens.font.size.sm,
  lineHeight: tokens.font.lineHeight.normal,
  fontFamily: tokens.font.family.sans,
  padding: tokens.space['2'],
  minHeight: '2.5rem',
  selectors: {
    '&:focus': { borderColor: tokens.color.border.focus, outline: 'none' },
  },
})

// ---- Action toolbar ----

export const actions = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  flexWrap: 'wrap',
})

const buttonBase = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  fontSize: tokens.font.size.xs,
  fontWeight: tokens.font.weight.medium,
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  borderRadius: tokens.radius.sm,
  border: `1px solid ${tokens.color.border.default}`,
  background: tokens.color.surface.default,
  color: tokens.color.text.secondary,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
  selectors: {
    '&:hover:not(:disabled)': {
      background: tokens.color.surface.hover,
      color: tokens.color.text.primary,
      borderColor: tokens.color.border.strong,
    },
    '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
  },
})

export const actionButton = buttonBase

// ---- Detail-level segmented control (toolbar) ----

export const levelButton = style([
  buttonBase,
  {
    borderRadius: 0,
    borderWidth: 0,
    padding: `${tokens.space['1']} ${tokens.space['2.5']}`,
    background: 'transparent',
    fontWeight: tokens.font.weight.semibold,
    selectors: {
      '&:hover:not(:disabled)': {
        background: tokens.color.surface.hover,
        color: tokens.color.text.primary,
        borderColor: 'transparent',
      },
    },
  },
])

export const levelButtonActive = style([
  levelButton,
  {
    background: tokens.color.accent.primary,
    color: tokens.color.text.inverse,
    selectors: {
      '&:hover:not(:disabled)': {
        background: tokens.color.accent.primaryHover,
        color: tokens.color.text.inverse,
      },
    },
  },
])

export const dangerButton = style([
  buttonBase,
  {
    selectors: {
      '&:hover:not(:disabled)': {
        color: tokens.color.semantic.error,
        borderColor: tokens.color.semantic.error,
      },
    },
  },
])

export const spinner = style({
  width: '0.85rem',
  height: '0.85rem',
  border: `2px solid ${tokens.color.border.default}`,
  borderTopColor: tokens.color.accent.primary,
  borderRadius: tokens.radius.full,
  animation: `${spin} 0.7s linear infinite`,
})

// ---- Refinement preview ----

export const preview = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  padding: tokens.space['3'],
  borderRadius: tokens.radius.md,
  border: `1px solid ${tokens.color.accent.primary}`,
  background: tokens.color.bg.elevated,
})

export const previewColumns = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: tokens.space['3'],
  '@media': {
    'screen and (max-width: 640px)': {
      gridTemplateColumns: '1fr',
    },
  },
})

export const previewColumn = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const previewHeading = style({
  fontSize: tokens.font.size.xs,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.muted,
  textTransform: 'uppercase',
})

export const previewText = style({
  fontSize: tokens.font.size.sm,
  lineHeight: tokens.font.lineHeight.normal,
  color: tokens.color.text.primary,
  whiteSpace: 'pre-wrap',
})

export const previewTextOriginal = style([previewText, { color: tokens.color.text.muted }])

export const previewActions = style({
  display: 'flex',
  gap: tokens.space['2'],
  justifyContent: 'flex-end',
})

export const emptyState = style({
  textAlign: 'center',
  color: tokens.color.text.muted,
  fontSize: tokens.font.size.sm,
  padding: tokens.space['8'],
})
