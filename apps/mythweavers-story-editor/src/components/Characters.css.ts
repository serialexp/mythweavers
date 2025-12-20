import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const listItemContent = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['3'],
  flex: 1,
  minWidth: 0,
})

export const listItemAvatar = style({
  width: '32px',
  height: '32px',
  borderRadius: tokens.radius.full,
  overflow: 'hidden',
  flexShrink: 0,
})

export const listItemAvatarImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
})

export const listItemAvatarPlaceholder = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: tokens.color.surface.default,
  color: tokens.color.text.secondary,
  fontWeight: tokens.font.weight.medium,
  fontSize: tokens.font.size.sm,
})

export const listItemName = style({
  flex: 1,
  minWidth: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: tokens.font.size.base,
})

export const protagonistIcon = style({
  color: tokens.color.semantic.warning,
  fontSize: tokens.font.size.sm,
})

export const form = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['3'],
})

export const input = style({
  padding: `${tokens.space['2.5']} ${tokens.space['3']}`,
  background: tokens.color.bg.base,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  color: tokens.color.text.primary,
  fontSize: tokens.font.size.base,
  transition: `border-color ${tokens.duration.normal} ${tokens.easing.default}`,
})

export const imageSection = style({
  display: 'flex',
  gap: tokens.space['4'],
  alignItems: 'flex-start',
})

export const imagePreview = style({
  width: '80px',
  height: '80px',
  borderRadius: tokens.radius.full,
  overflow: 'hidden',
  flexShrink: 0,
  border: `${tokens.borderWidth.thick} solid ${tokens.color.border.default}`,
})

export const imagePreviewImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
})

export const imagePlaceholder = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: tokens.color.surface.default,
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size['2xl'],
  fontWeight: tokens.font.weight.medium,
})

export const imageControls = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const imageUploadButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  background: tokens.color.bg.raised,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  cursor: 'pointer',
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.primary,
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,
})

export const imageRemoveButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  padding: `${tokens.space['1.5']} ${tokens.space['2.5']}`,
  background: 'transparent',
  border: 'none',
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  fontSize: tokens.font.size.xs,
  color: tokens.color.semantic.error,
})

export const quickInsertButtons = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  flexWrap: 'wrap',
})

export const quickInsertLabel = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.secondary,
})

export const quickInsertButton = style({
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  fontSize: tokens.font.size.xs,
  background: tokens.color.surface.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  color: tokens.color.text.primary,
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,
})

export const detailView = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
})

export const detailAvatar = style({
  width: '100px',
  height: '100px',
  borderRadius: tokens.radius.full,
  overflow: 'hidden',
  flexShrink: 0,
  border: `3px solid ${tokens.color.border.default}`,
  alignSelf: 'center',
})

export const detailAvatarImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
})

export const detailAvatarPlaceholder = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: tokens.color.surface.default,
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size['3xl'],
  fontWeight: tokens.font.weight.medium,
})

export const characterDescription = style({
  lineHeight: tokens.font.lineHeight.relaxed,
  color: tokens.color.text.primary,
})

export const characterBirthdate = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const detailActions = style({
  display: 'flex',
  gap: tokens.space['2'],
  flexWrap: 'wrap',
  marginTop: tokens.space['2'],
  paddingTop: tokens.space['4'],
  borderTop: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const birthdateButton = style({
  width: '100%',
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['2.5']} ${tokens.space['3']}`,
  background: tokens.color.bg.base,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  color: tokens.color.text.primary,
  fontSize: tokens.font.size.base,
  cursor: 'pointer',
  transition: `border-color ${tokens.duration.normal} ${tokens.easing.default}`,
})

export const marginTop = style({
  marginTop: tokens.space['2'],
})
