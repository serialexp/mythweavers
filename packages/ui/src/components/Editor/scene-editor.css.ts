import { globalStyle, keyframes, style } from '@vanilla-extract/css'
import { tokens } from '../../theme/tokens.css'

/**
 * Scene Editor Styles
 * Using design tokens from @mythweavers/ui for theme support
 */

export const sceneEditor = style({
  position: 'relative',
})

export const editorContainer = style({
  minHeight: '200px',
  padding: tokens.space['4'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.lg,
  backgroundColor: tokens.color.bg.raised,
  fontFamily: 'inherit',
  lineHeight: tokens.font.lineHeight.relaxed,
})

// ProseMirror base styles
globalStyle(`${sceneEditor} .ProseMirror`, {
  outline: 'none',
  padding: 0,
  margin: 0,
})

// Paragraph base styles
globalStyle(`${sceneEditor} .ProseMirror p`, {
  margin: 0,
  padding: `${tokens.space['2']} 0`,
  paddingLeft: tokens.space['2'],
  minHeight: '1.6em',
  position: 'relative',
  borderLeft: '3px solid transparent',
  // Only transition specific properties to avoid flashing on reactive updates
  transition: `background-color ${tokens.duration.normal} ${tokens.easing.default}, border-left-color ${tokens.duration.normal} ${tokens.easing.default}, border-left-width ${tokens.duration.fast} ${tokens.easing.default}, box-shadow ${tokens.duration.fast} ${tokens.easing.default}`,
})

// Paragraph hover (non-active)
globalStyle(`${sceneEditor} .ProseMirror p:hover:not(.active-paragraph)`, {
  backgroundColor: tokens.color.surface.hover,
})

// Active paragraph
globalStyle(`${sceneEditor} .ProseMirror p.active-paragraph`, {
  borderLeftColor: `${tokens.color.accent.primary} !important`,
  backgroundColor: `${tokens.color.surface.selected} !important`,
  borderLeftWidth: '4px !important',
  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tokens.color.accent.primary} 20%, transparent), 0 0 0 1px color-mix(in srgb, ${tokens.color.accent.primary} 10%, transparent) !important`,
})

// Active paragraph hover
globalStyle(`${sceneEditor} .ProseMirror p.active-paragraph:hover`, {
  borderLeftColor: `${tokens.color.accent.primary} !important`,
  backgroundColor: `${tokens.color.surface.selected} !important`,
  borderLeftWidth: '4px !important',
  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tokens.color.accent.primary} 20%, transparent), 0 0 0 1px color-mix(in srgb, ${tokens.color.accent.primary} 10%, transparent) !important`,
})

// Paragraph state indicators
globalStyle(`${sceneEditor} .ProseMirror p[data-state="draft"]`, {
  borderLeftColor: tokens.color.semantic.warning,
})

globalStyle(`${sceneEditor} .ProseMirror p[data-state="revise"]`, {
  borderLeftColor: tokens.color.semantic.error,
})

globalStyle(`${sceneEditor} .ProseMirror p[data-state="ai"]`, {
  borderLeftColor: tokens.color.accent.secondary,
})

globalStyle(`${sceneEditor} .ProseMirror p[data-state="final"]`, {
  borderLeftColor: tokens.color.semantic.success,
})

globalStyle(`${sceneEditor} .ProseMirror p[data-state="sdt"]`, {
  borderLeftColor: tokens.color.semantic.info,
})

// Paragraph Actions Menu
export const paragraphActionsMenu = style({
  position: 'absolute',
  backgroundColor: tokens.color.bg.elevated,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.lg,
  padding: tokens.space['2.5'],
  boxShadow: tokens.shadow.md,
  display: 'flex',
  gap: tokens.space['1.5'],
  zIndex: tokens.zIndex.dropdown,
  flexWrap: 'wrap',
  minWidth: '600px',
  fontSize: tokens.font.size.xs,
})

export const paragraphActionsGroup = style({
  display: 'flex',
  gap: '3px',
  marginRight: tokens.space['3'],
})

globalStyle(`${paragraphActionsMenu} .btn`, {
  minHeight: '28px',
  height: '28px',
  padding: `0 ${tokens.space['2.5']}`,
  fontSize: tokens.font.size.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

globalStyle(`${paragraphActionsMenu} .btn svg`, {
  color: 'currentColor',
  flexShrink: 0,
})

// Block Menu
export const blockMenu = style({
  position: 'absolute',
  display: 'flex',
  gap: '2px',
  maxWidth: '70px',
  overflow: 'hidden',
  zIndex: tokens.zIndex.dropdown,
})

globalStyle(`${blockMenu} button`, {
  backgroundColor: tokens.color.surface.default,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  color: tokens.color.text.primary,
  cursor: 'pointer',
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
})

// Suggestion Widget
const slideInFromRight = keyframes({
  from: {
    transform: 'translateX(100%) translateY(-50%)',
    opacity: 0,
  },
  to: {
    transform: 'translateX(0) translateY(-50%)',
    opacity: 1,
  },
})

export const suggestionWidget = style({
  fontSize: tokens.font.size.sm,
  maxHeight: '80vh',
  overflowY: 'auto',
  backdropFilter: 'blur(8px)',
  animation: `${slideInFromRight} ${tokens.duration.slow} ${tokens.easing.out}`,
  zIndex: tokens.zIndex.tooltip,
  position: 'fixed',
  right: '20px',
  top: '50%',
  transform: 'translateY(-50%)',
  width: '400px',
  backgroundColor: tokens.color.bg.elevated,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.lg,
  padding: tokens.space['3'],
  boxShadow: tokens.shadow.lg,
})

export const suggestionContent = style({
  maxHeight: '400px',
  overflowY: 'auto',
  border: `1px solid ${tokens.color.border.default}`,
  scrollbarWidth: 'thin',
  scrollbarColor: `${tokens.color.border.strong} transparent`,
  backgroundColor: tokens.color.surface.default,
  borderRadius: tokens.radius.default,
  padding: tokens.space['3'],
  marginBottom: tokens.space['3'],
  fontFamily: 'inherit',
  fontSize: tokens.font.size.sm,
  lineHeight: tokens.font.lineHeight.relaxed,
  userSelect: 'text',
})

globalStyle(`${suggestionContent}::-webkit-scrollbar`, {
  width: '6px',
})

globalStyle(`${suggestionContent}::-webkit-scrollbar-track`, {
  background: 'transparent',
})

globalStyle(`${suggestionContent}::-webkit-scrollbar-thumb`, {
  backgroundColor: tokens.color.border.strong,
  borderRadius: '3px',
})

export const suggestionButtons = style({
  display: 'flex',
  gap: tokens.space['2'],
  justifyContent: 'flex-end',
})

export const suggestionHeader = style({
  fontWeight: tokens.font.weight.semibold,
  marginBottom: tokens.space['2'],
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.primary,
})

export const suggestionLegend = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.secondary,
  marginBottom: tokens.space['2'],
  display: 'flex',
  gap: tokens.space['3'],
})

// Diff styling - exported for use in innerHTML
export const diffDelete = style({
  backgroundColor: tokens.color.semantic.errorSubtle,
  color: tokens.color.semantic.error,
  textDecoration: 'line-through',
  padding: '1px 2px',
  borderRadius: tokens.radius.sm,
  margin: '0 1px',
})

export const diffInsert = style({
  backgroundColor: tokens.color.semantic.successSubtle,
  color: tokens.color.semantic.success,
  padding: '1px 2px',
  borderRadius: tokens.radius.sm,
  margin: '0 1px',
})

// Legend indicators
export const diffDeleteInline = style({
  color: tokens.color.semantic.error,
  fontSize: '8px',
  verticalAlign: 'middle',
})

export const diffInsertInline = style({
  color: tokens.color.semantic.success,
  fontSize: '8px',
  verticalAlign: 'middle',
})

globalStyle(`${suggestionWidget} .btn`, {
  minHeight: '28px',
  height: '28px',
  padding: `0 ${tokens.space['3']}`,
  fontSize: tokens.font.size.xs,
})

// Loading animation
const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
})

export const animateSpin = style({
  animation: `${spin} 1s linear infinite`,
})

export const loadingContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const loadingSpinner = style({
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  borderWidth: '2px',
  borderStyle: 'solid',
  borderColor: tokens.color.border.default,
  borderTopColor: tokens.color.accent.primary,
  animation: `${spin} 1s linear infinite`,
})

export const loadingText = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

// Inline Menu
export const inlineMenu = style({
  backgroundColor: tokens.color.bg.elevated,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  padding: tokens.space['1'],
  boxShadow: tokens.shadow.md,
  display: 'flex',
  gap: '2px',
  zIndex: tokens.zIndex.dropdown,
})

globalStyle(`${inlineMenu} button`, {
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  border: 'none',
  background: 'transparent',
  borderRadius: tokens.radius.default,
  fontSize: tokens.font.size.xs,
  cursor: 'pointer',
  transition: `background-color ${tokens.duration.fast} ${tokens.easing.default}`,
  color: tokens.color.text.primary,
})

globalStyle(`${inlineMenu} button:hover`, {
  backgroundColor: tokens.color.surface.hover,
})

globalStyle(`${inlineMenu} button.active`, {
  backgroundColor: tokens.color.accent.primary,
  color: tokens.color.text.inverse,
})

// Translation marks
globalStyle('.translation-mark', {
  backgroundColor: tokens.color.semantic.warningSubtle,
  borderBottom: `1px dotted ${tokens.color.semantic.warning}`,
  cursor: 'help',
})

// Empty paragraph placeholder
globalStyle(`${sceneEditor} .ProseMirror p:empty::before`, {
  content: '"Type here..."',
  color: tokens.color.text.muted,
  pointerEvents: 'none',
  fontStyle: 'italic',
})

// Focus styles
globalStyle(`${sceneEditor} .ProseMirror:focus`, {
  boxShadow: `0 0 0 2px color-mix(in srgb, ${tokens.color.accent.primary} 15%, transparent)`,
})

// ====================================
// Solid-Editor Styles
// ====================================

// Solid-editor base styles
globalStyle(`${sceneEditor} .solid-editor`, {
  outline: 'none',
  padding: 0,
  margin: 0,
})

// Solid-editor paragraph styles
globalStyle(`${sceneEditor} .solid-editor p, ${sceneEditor} .solid-editor .solid-editor-paragraph`, {
  margin: 0,
  padding: `${tokens.space['2']} 0`,
  paddingLeft: tokens.space['2'],
  minHeight: '1.6em',
  position: 'relative',
  borderLeft: '3px solid transparent',
  // Only transition specific properties to avoid flashing on reactive updates
  transition: `background-color ${tokens.duration.normal} ${tokens.easing.default}, border-left-color ${tokens.duration.normal} ${tokens.easing.default}, border-left-width ${tokens.duration.fast} ${tokens.easing.default}, box-shadow ${tokens.duration.fast} ${tokens.easing.default}`,
})

// Paragraph hover
globalStyle(`${sceneEditor} .solid-editor p:hover, ${sceneEditor} .solid-editor .solid-editor-paragraph:hover`, {
  backgroundColor: tokens.color.surface.hover,
})

// Active paragraph in solid-editor
globalStyle(
  `${sceneEditor} .solid-editor p.active-paragraph, ${sceneEditor} .solid-editor .solid-editor-paragraph.active-paragraph`,
  {
    borderLeftColor: `${tokens.color.accent.primary} !important`,
    backgroundColor: `${tokens.color.surface.selected} !important`,
    borderLeftWidth: '4px !important',
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tokens.color.accent.primary} 20%, transparent), 0 0 0 1px color-mix(in srgb, ${tokens.color.accent.primary} 10%, transparent) !important`,
  },
)

// Solid-editor paragraph states
globalStyle(
  `${sceneEditor} .solid-editor p[data-state="draft"], ${sceneEditor} .solid-editor .solid-editor-paragraph[data-state="draft"]`,
  {
    borderLeftColor: tokens.color.semantic.warning,
  },
)

globalStyle(
  `${sceneEditor} .solid-editor p[data-state="revise"], ${sceneEditor} .solid-editor .solid-editor-paragraph[data-state="revise"]`,
  {
    borderLeftColor: tokens.color.semantic.error,
  },
)

globalStyle(
  `${sceneEditor} .solid-editor p[data-state="ai"], ${sceneEditor} .solid-editor .solid-editor-paragraph[data-state="ai"]`,
  {
    borderLeftColor: tokens.color.accent.secondary,
  },
)

globalStyle(
  `${sceneEditor} .solid-editor p[data-state="final"], ${sceneEditor} .solid-editor .solid-editor-paragraph[data-state="final"]`,
  {
    borderLeftColor: tokens.color.semantic.success,
  },
)

globalStyle(
  `${sceneEditor} .solid-editor p[data-state="sdt"], ${sceneEditor} .solid-editor .solid-editor-paragraph[data-state="sdt"]`,
  {
    borderLeftColor: tokens.color.semantic.info,
  },
)

// Solid-editor focus styles
globalStyle(`${sceneEditor} .solid-editor:focus`, {
  boxShadow: `0 0 0 2px color-mix(in srgb, ${tokens.color.accent.primary} 15%, transparent)`,
})

// Solid-editor placeholder
globalStyle(`${sceneEditor} .solid-editor-placeholder`, {
  color: tokens.color.text.muted,
  fontStyle: 'italic',
  // Match paragraph padding: borderLeft (3px) + paddingLeft (space['2'])
  paddingLeft: `calc(3px + ${tokens.space['2']})`,
  paddingTop: tokens.space['2'],
})

// Solid-editor mark styles
globalStyle(`${sceneEditor} .solid-editor strong`, {
  fontWeight: tokens.font.weight.bold,
})

globalStyle(`${sceneEditor} .solid-editor em`, {
  fontStyle: 'italic',
})

globalStyle(`${sceneEditor} .solid-editor .translation-mark, ${sceneEditor} .solid-editor abbr.translation-mark`, {
  backgroundColor: tokens.color.semantic.warningSubtle,
  borderBottom: `1px dotted ${tokens.color.semantic.warning}`,
  cursor: 'help',
  textDecoration: 'none',
})

// Prevent text selection highlight inside mentions
globalStyle(`${sceneEditor} .solid-editor-mention`, {
  userSelect: 'none',
})

globalStyle(`${sceneEditor} .solid-editor-mention *`, {
  userSelect: 'none',
})

globalStyle(`${sceneEditor} .solid-editor-mention::selection`, {
  background: 'transparent',
})

globalStyle(`${sceneEditor} .solid-editor-mention *::selection`, {
  background: 'transparent',
})
