import { splitProps } from 'solid-js'
import { Button, type ButtonProps } from './Button'
import { toggleButtonActive } from './ToggleButton.css'

export interface ToggleButtonProps extends Omit<ButtonProps, 'variant'> {
  /** Whether the button is in the active/pressed state */
  active?: boolean
  /** Button variant - ghost (default) or outline (subtle border) */
  variant?: 'ghost' | 'outline'
}

/**
 * A toggle button that can be in an active or inactive state.
 * Uses ghost variant styling by default with a highlighted background when active.
 *
 * @example
 * ```tsx
 * <ToggleButton active={isSelected()} onClick={() => setSelected(!isSelected())}>
 *   Toggle Me
 * </ToggleButton>
 * ```
 *
 * @example Icon-only toggle
 * ```tsx
 * <ToggleButton active={isBold()} onClick={toggleBold} iconOnly size="sm">
 *   <BsTypeBold />
 * </ToggleButton>
 * ```
 *
 * @example Outlined toggle group
 * ```tsx
 * <ButtonGroup>
 *   <ToggleButton variant="outline" active={mode() === 'a'} onClick={() => setMode('a')}>A</ToggleButton>
 *   <ToggleButton variant="outline" active={mode() === 'b'} onClick={() => setMode('b')}>B</ToggleButton>
 * </ButtonGroup>
 * ```
 */
export const ToggleButton = (props: ToggleButtonProps) => {
  const [local, rest] = splitProps(props, ['active', 'class', 'variant'])
  const variant = () => local.variant ?? 'ghost'

  return (
    <Button
      variant={variant()}
      class={`${local.active ? toggleButtonActive : ''} ${local.class ?? ''}`}
      {...rest}
    />
  )
}
