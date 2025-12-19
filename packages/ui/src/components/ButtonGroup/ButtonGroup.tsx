import { type ParentComponent } from 'solid-js'
import { buttonGroup } from './ButtonGroup.css'

export interface ButtonGroupProps {
  /** Additional class */
  class?: string
}

/**
 * Groups buttons together with connected borders.
 *
 * The first button has rounded left edges, the last button has rounded right edges,
 * and middle buttons have no border radius, creating a seamless button group.
 *
 * Works well with Dropdown using portal={true} so the dropdown menu doesn't
 * interfere with the button group layout.
 *
 * @example
 * ```tsx
 * <ButtonGroup>
 *   <Button variant="ghost" size="sm">Main Action</Button>
 *   <Dropdown portal trigger={<Button variant="ghost" size="sm" iconOnly><BsChevronDown /></Button>}>
 *     <DropdownItem>Option 1</DropdownItem>
 *     <DropdownItem>Option 2</DropdownItem>
 *   </Dropdown>
 * </ButtonGroup>
 * ```
 */
export const ButtonGroup: ParentComponent<ButtonGroupProps> = (props) => {
  return (
    <div class={`${buttonGroup} ${props.class ?? ''}`} role="group">
      {props.children}
    </div>
  )
}
