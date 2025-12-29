import { style } from '@vanilla-extract/css'
import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

export const card = recipe({
  base: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.color.bg.raised,
    borderRadius: tokens.radius.lg,
    border: `${tokens.borderWidth.default} solid ${tokens.color.border.subtle}`,
    transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,
  },

  variants: {
    variant: {
      default: {
        boxShadow: tokens.shadow.default,
      },
      elevated: {
        boxShadow: tokens.shadow.lg,
      },
      outlined: {
        boxShadow: 'none',
        borderColor: tokens.color.border.default,
      },
      flat: {
        boxShadow: 'none',
        border: 'none',
      },
    },

    interactive: {
      true: {
        cursor: 'pointer',
        ':hover': {
          transform: 'translateY(-2px)',
          boxShadow: tokens.shadow.lg,
        },
        ':active': {
          transform: 'translateY(0)',
        },
      },
    },

    padding: {
      none: {},
      sm: {
        padding: tokens.space['3'],
      },
      md: {
        padding: tokens.space['4'],
      },
      lg: {
        padding: tokens.space['6'],
      },
    },

    size: {
      auto: {},
      sm: {
        maxWidth: '400px',
        width: '100%',
      },
      md: {
        maxWidth: '600px',
        width: '100%',
      },
      lg: {
        maxWidth: '800px',
        width: '100%',
      },
      xl: {
        maxWidth: '1000px',
        width: '100%',
      },
      full: {
        width: '100%',
      },
    },
  },

  defaultVariants: {
    variant: 'default',
    padding: 'none',
    size: 'auto',
  },
})

export const cardImage = style({
  width: '100%',
  objectFit: 'cover',
  flexShrink: 0,
})

export const cardBody = recipe({
  base: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },

  variants: {
    padding: {
      none: {},
      sm: {
        padding: tokens.space['3'],
      },
      md: {
        padding: tokens.space['4'],
      },
      lg: {
        padding: tokens.space['6'],
      },
    },

    gap: {
      none: {},
      sm: {
        gap: tokens.space['2'],
      },
      md: {
        gap: tokens.space['3'],
      },
      lg: {
        gap: tokens.space['4'],
      },
    },
  },

  defaultVariants: {
    padding: 'md',
    gap: 'sm',
  },
})

export const cardTitle = recipe({
  base: {
    margin: 0,
    fontFamily: tokens.font.family.sans,
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text.primary,
    lineHeight: tokens.font.lineHeight.tight,
  },

  variants: {
    size: {
      sm: {
        fontSize: tokens.font.size.base,
      },
      md: {
        fontSize: tokens.font.size.lg,
      },
      lg: {
        fontSize: tokens.font.size.xl,
      },
    },
  },

  defaultVariants: {
    size: 'md',
  },
})

export const cardDescription = style({
  margin: 0,
  fontFamily: tokens.font.family.sans,
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  lineHeight: tokens.font.lineHeight.normal,
})

export const cardActions = recipe({
  base: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: tokens.space['3'],
  },

  variants: {
    justify: {
      start: {
        justifyContent: 'flex-start',
      },
      center: {
        justifyContent: 'center',
      },
      end: {
        justifyContent: 'flex-end',
      },
      between: {
        justifyContent: 'space-between',
      },
      around: {
        justifyContent: 'space-around',
      },
    },

    gap: {
      sm: {
        gap: tokens.space['2'],
      },
      md: {
        gap: tokens.space['3'],
      },
      lg: {
        gap: tokens.space['4'],
      },
    },
  },

  defaultVariants: {
    justify: 'end',
    gap: 'sm',
  },
})

export type CardVariants = RecipeVariants<typeof card>
export type CardBodyVariants = RecipeVariants<typeof cardBody>
export type CardTitleVariants = RecipeVariants<typeof cardTitle>
export type CardActionsVariants = RecipeVariants<typeof cardActions>
