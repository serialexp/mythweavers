import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const twoColumnLayout = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '1rem',
  height: '60vh',
  minHeight: '400px',
})

export const column = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  overflow: 'hidden',
})

export const columnHeader = style({
  fontSize: '0.875rem',
  fontWeight: 600,
  color: tokens.color.text.primary,
  paddingBottom: '0.5rem',
  borderBottom: `1px solid ${tokens.color.border.default}`,
  flexShrink: 0,
})

export const searchInput = style({
  width: '100%',
  padding: '0.5rem',
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  background: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: '0.875rem',
  flexShrink: 0,
})

export const sceneList = style({
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
})

export const sceneItem = style({
  padding: '0.75rem',
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '6px',
  background: tokens.color.bg.base,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  ':hover': {
    borderColor: tokens.color.border.focus,
    background: tokens.color.surface.hover,
  },
})

export const sceneItemSelected = style([
  sceneItem,
  {
    borderColor: tokens.color.accent.primary,
    background: tokens.color.surface.selected,
    borderWidth: '2px',
  },
])

export const sceneHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '0.25rem',
})

export const sceneCheckbox = style({
  flexShrink: 0,
})

export const sceneTitle = style({
  fontWeight: 500,
  fontSize: '0.875rem',
  color: tokens.color.text.primary,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

export const scenePath = style({
  fontSize: '0.75rem',
  color: tokens.color.text.muted,
})

export const expandButton = style({
  padding: '0.25rem',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: tokens.color.text.secondary,
  borderRadius: '4px',
  ':hover': {
    background: tokens.color.surface.hover,
    color: tokens.color.text.primary,
  },
})

export const sceneContent = style({
  marginTop: '0.5rem',
  paddingTop: '0.5rem',
  borderTop: `1px solid ${tokens.color.border.default}`,
  fontSize: '0.8rem',
  lineHeight: 1.5,
  color: tokens.color.text.secondary,
  maxHeight: '200px',
  overflowY: 'auto',
  whiteSpace: 'pre-wrap',
})

export const label = style({
  display: 'block',
  marginBottom: '0.25rem',
  color: tokens.color.text.secondary,
  fontSize: '0.875rem',
  fontWeight: 500,
})

export const messagePreview = style({
  flex: 1,
  padding: '0.75rem',
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '6px',
  background: tokens.color.bg.base,
  fontSize: '0.875rem',
  lineHeight: 1.5,
  color: tokens.color.text.primary,
  overflowY: 'auto',
  whiteSpace: 'pre-wrap',
})

export const instructionArea = style({
  flexShrink: 0,
})

export const tokenBudget = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 0.75rem',
  background: tokens.color.bg.raised,
  borderRadius: '4px',
  fontSize: '0.75rem',
  color: tokens.color.text.secondary,
})

export const tokenCount = style({
  fontWeight: 600,
  color: tokens.color.text.primary,
})

export const tokenWarning = style({
  color: tokens.color.semantic.warning,
})

export const footer = style({
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1rem',
  borderTop: `1px solid ${tokens.color.border.default}`,
})

export const footerActions = style({
  display: 'flex',
  gap: '0.5rem',
})

export const selectionInfo = style({
  fontSize: '0.8rem',
  color: tokens.color.text.secondary,
})

export const noScenes = style({
  padding: '2rem',
  textAlign: 'center',
  color: tokens.color.text.muted,
  fontSize: '0.875rem',
})
