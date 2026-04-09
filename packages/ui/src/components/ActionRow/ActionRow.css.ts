import { recipe } from '@vanilla-extract/recipes'
import { style } from '@vanilla-extract/css'
import { tokens } from '../../theme/tokens.css'

export const row = recipe({
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space['3'],
    padding: tokens.space['3'],
    border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
    borderRadius: tokens.radius.sm,
    transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
  },

  variants: {
    interactive: {
      true: {
        cursor: 'pointer',

        ':hover': {
          backgroundColor: tokens.color.surface.hover,
          borderColor: tokens.color.border.focus,
        },
      },
      false: {},
    },
  },

  defaultVariants: {
    interactive: false,
  },
})

export const content = style({
  flex: 1,
  minWidth: 0,
})

export const title = style({
  fontSize: '0.9375rem',
  fontWeight: 500,
  color: tokens.color.text.primary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})

export const description = style({
  display: 'flex',
  gap: tokens.space['3'],
  marginTop: tokens.space['1'],
  fontSize: '0.75rem',
  color: tokens.color.text.muted,
})

export const actions = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  flexShrink: 0,
})
