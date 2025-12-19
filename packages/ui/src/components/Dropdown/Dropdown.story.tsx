import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { Button } from '../Button'
import { Dropdown, DropdownDivider, DropdownItem } from './Dropdown'

const EditIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const CopyIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
)

const TrashIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Dropdown" group="components">
      <Hst.Variant title="Basic">
        <ThemeComparison>
          <Dropdown trigger={<Button variant="secondary">Actions</Button>}>
            <DropdownItem onClick={() => console.log('Edit')}>Edit</DropdownItem>
            <DropdownItem onClick={() => console.log('Copy')}>Duplicate</DropdownItem>
            <DropdownItem onClick={() => console.log('Share')}>Share</DropdownItem>
          </Dropdown>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Icons">
        <ThemeComparison>
          <Dropdown trigger={<Button variant="secondary">Actions</Button>}>
            <DropdownItem icon={<EditIcon />} onClick={() => console.log('Edit')}>
              Edit
            </DropdownItem>
            <DropdownItem icon={<CopyIcon />} onClick={() => console.log('Copy')}>
              Duplicate
            </DropdownItem>
            <DropdownDivider />
            <DropdownItem icon={<TrashIcon />} danger onClick={() => console.log('Delete')}>
              Delete
            </DropdownItem>
          </Dropdown>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Divider and Danger">
        <ThemeComparison>
          <Dropdown trigger={<Button variant="secondary">More</Button>}>
            <DropdownItem>View Details</DropdownItem>
            <DropdownItem>Edit</DropdownItem>
            <DropdownItem disabled>Archive (disabled)</DropdownItem>
            <DropdownDivider />
            <DropdownItem danger>Delete</DropdownItem>
          </Dropdown>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Align Right">
        <ThemeComparison>
          <div style={{ display: 'flex', 'justify-content': 'flex-end' }}>
            <Dropdown trigger={<Button variant="secondary">Right Aligned</Button>} alignRight>
              <DropdownItem>Option 1</DropdownItem>
              <DropdownItem>Option 2</DropdownItem>
              <DropdownItem>Option 3</DropdownItem>
            </Dropdown>
          </div>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With IconButton Trigger">
        <ThemeComparison>
          <Dropdown
            trigger={
              <Button iconOnly variant="ghost" aria-label="More actions">
                <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </Button>
            }
          >
            <DropdownItem>Edit</DropdownItem>
            <DropdownItem>Share</DropdownItem>
            <DropdownDivider />
            <DropdownItem danger>Delete</DropdownItem>
          </Dropdown>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Active State">
        <ThemeComparison>
          <Dropdown trigger={<Button variant="secondary">View Mode</Button>}>
            <DropdownItem active>Normal View</DropdownItem>
            <DropdownItem>Compact View</DropdownItem>
            <DropdownItem>Expanded View</DropdownItem>
          </Dropdown>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Portal Mode (escapes overflow:hidden)">
        <ThemeComparison>
          <Dropdown portal trigger={<Button variant="secondary">Portal Dropdown</Button>}>
            <DropdownItem icon={<EditIcon />}>Edit</DropdownItem>
            <DropdownItem icon={<CopyIcon />}>Duplicate</DropdownItem>
            <DropdownDivider />
            <DropdownItem icon={<TrashIcon />} danger>
              Delete
            </DropdownItem>
          </Dropdown>
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
