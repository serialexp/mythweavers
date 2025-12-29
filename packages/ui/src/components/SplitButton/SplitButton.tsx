import { type JSX, type ParentComponent, splitProps } from 'solid-js'
import { Button, type ButtonProps } from '../Button'
import { ButtonGroup } from '../ButtonGroup'
import { Dropdown } from '../Dropdown'

export interface SplitButtonProps extends Omit<ButtonProps, 'iconOnly'> {
  /** Label for the main action button */
  label: JSX.Element
  /** Dropdown menu content (DropdownItem elements) */
  children: JSX.Element
  /** Align dropdown to right edge */
  alignRight?: boolean
}

/**
 * A button with a dropdown for additional options.
 *
 * Combines ButtonGroup, Button, and Dropdown into a cohesive split button pattern.
 *
 * @example
 * ```tsx
 * <SplitButton
 *   label="Save"
 *   onClick={() => save()}
 *   variant="primary"
 *   size="sm"
 * >
 *   <DropdownItem onClick={() => saveAs()}>Save As...</DropdownItem>
 *   <DropdownItem onClick={() => saveCopy()}>Save Copy</DropdownItem>
 * </SplitButton>
 * ```
 */
export const SplitButton: ParentComponent<SplitButtonProps> = (props) => {
  const [local, buttonProps] = splitProps(props, ['label', 'children', 'alignRight'])

  return (
    <ButtonGroup>
      <Button {...buttonProps}>{local.label}</Button>
      <Dropdown
        portal
        alignRight={local.alignRight}
        trigger={
          <Button
            variant={buttonProps.variant}
            size={buttonProps.size}
            disabled={buttonProps.disabled}
            iconOnly
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.427 6.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 6H4.604a.25.25 0 00-.177.427z" />
            </svg>
          </Button>
        }
      >
        {local.children}
      </Dropdown>
    </ButtonGroup>
  )
}
