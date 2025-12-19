import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { Button } from '../Button'
import { Dropdown, DropdownItem } from '../Dropdown'
import { ButtonGroup } from './ButtonGroup'

// Simple icon components for demo
const ChevronDownIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M6 9l6 6 6-6" />
  </svg>
)

const SaveIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17,21 17,13 7,13 7,21" />
    <polyline points="7,3 7,8 15,8" />
  </svg>
)

const PlayIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
)

const PauseIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
)

const StopIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="4" y="4" width="16" height="16" />
  </svg>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="ButtonGroup" group="components">
      <Hst.Variant title="Basic Group">
        <ThemeComparison>
          <ButtonGroup>
            <Button variant="secondary" size="sm">Left</Button>
            <Button variant="secondary" size="sm">Middle</Button>
            <Button variant="secondary" size="sm">Right</Button>
          </ButtonGroup>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Dropdown">
        <ThemeComparison>
          <ButtonGroup>
            <Button variant="ghost" size="sm">
              <SaveIcon /> Save
            </Button>
            <Dropdown
              portal
              alignRight
              trigger={
                <Button variant="ghost" size="sm" iconOnly>
                  <ChevronDownIcon />
                </Button>
              }
            >
              <DropdownItem>Save as Draft</DropdownItem>
              <DropdownItem>Save and Close</DropdownItem>
              <DropdownItem>Save as Template</DropdownItem>
            </Dropdown>
          </ButtonGroup>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Icon Only Group">
        <ThemeComparison>
          <ButtonGroup>
            <Button variant="ghost" size="sm" iconOnly title="Play">
              <PlayIcon />
            </Button>
            <Button variant="ghost" size="sm" iconOnly title="Pause">
              <PauseIcon />
            </Button>
            <Button variant="ghost" size="sm" iconOnly title="Stop">
              <StopIcon />
            </Button>
          </ButtonGroup>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Primary Variant">
        <ThemeComparison>
          <ButtonGroup>
            <Button size="sm">Action</Button>
            <Dropdown
              portal
              alignRight
              trigger={
                <Button size="sm" iconOnly>
                  <ChevronDownIcon />
                </Button>
              }
            >
              <DropdownItem>Option 1</DropdownItem>
              <DropdownItem>Option 2</DropdownItem>
              <DropdownItem>Option 3</DropdownItem>
            </Dropdown>
          </ButtonGroup>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Different Sizes">
        <ThemeComparison>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px', 'align-items': 'flex-start' }}>
            <ButtonGroup>
              <Button variant="secondary" size="sm">Small</Button>
              <Button variant="secondary" size="sm" iconOnly>
                <ChevronDownIcon />
              </Button>
            </ButtonGroup>
            <ButtonGroup>
              <Button variant="secondary" size="md">Medium</Button>
              <Button variant="secondary" size="md" iconOnly>
                <ChevronDownIcon />
              </Button>
            </ButtonGroup>
            <ButtonGroup>
              <Button variant="secondary" size="lg">Large</Button>
              <Button variant="secondary" size="lg" iconOnly>
                <ChevronDownIcon />
              </Button>
            </ButtonGroup>
          </div>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Single Button (Full Radius)">
        <ThemeComparison>
          <ButtonGroup>
            <Button variant="secondary" size="sm">Single Button</Button>
          </ButtonGroup>
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
