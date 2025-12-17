import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { Button } from './Button'

// Simple icon components for demo
const PlusIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const SettingsIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
)

const TrashIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
)

const SaveIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17,21 17,13 7,13 7,21" />
    <polyline points="7,3 7,8 15,8" />
  </svg>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Button" group="components">
      <Hst.Variant title="All Variants">
        <ThemeComparison>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Sizes">
        <ThemeComparison>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Icons">
        <ThemeComparison>
          <Button>
            <SaveIcon /> Save
          </Button>
          <Button variant="secondary">
            <SettingsIcon /> Settings
          </Button>
          <Button variant="ghost">
            <PlusIcon /> Add Item
          </Button>
          <Button variant="danger">
            <TrashIcon /> Delete
          </Button>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Icon Only">
        <ThemeComparison>
          <Button iconOnly aria-label="Add">
            <PlusIcon />
          </Button>
          <Button iconOnly variant="secondary" aria-label="Settings">
            <SettingsIcon />
          </Button>
          <Button iconOnly variant="ghost" aria-label="Save">
            <SaveIcon />
          </Button>
          <Button iconOnly variant="danger" aria-label="Delete">
            <TrashIcon />
          </Button>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Icon Only (All Sizes)">
        <ThemeComparison>
          <Button iconOnly size="sm" aria-label="Small">
            <PlusIcon />
          </Button>
          <Button iconOnly size="md" aria-label="Medium">
            <PlusIcon />
          </Button>
          <Button iconOnly size="lg" aria-label="Large">
            <PlusIcon />
          </Button>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Disabled">
        <ThemeComparison>
          <Button disabled>Primary Disabled</Button>
          <Button variant="secondary" disabled>
            Secondary Disabled
          </Button>
          <Button variant="ghost" disabled>
            Ghost Disabled
          </Button>
          <Button iconOnly disabled aria-label="Disabled">
            <PlusIcon />
          </Button>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Full Width">
        <ThemeComparison>
          <Button fullWidth>Full Width Button</Button>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Wide Buttons (Gradient Test)">
        <ThemeComparison>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px', width: '400px' }}>
            <Button fullWidth>Wide Button - Hover to see spinning gradient</Button>
            <Button fullWidth variant="secondary">
              Wide Secondary Button
            </Button>
            <Button fullWidth variant="danger">
              Wide Danger Button
            </Button>
          </div>
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
