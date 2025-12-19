import { createSignal } from 'solid-js'
import { chronicleTheme } from '../../theme/chronicle.css'
import { starlightTheme } from '../../theme/starlight.css'
import { Button } from '../Button'
import { Input } from '../Input'
import { Textarea } from '../Textarea'
import { Modal } from './Modal'

// Wrapper that provides theme context for modals (since they portal out)
const ThemedModalDemo = (props: {
  theme: string
  themeName: string
  children: (open: () => void) => any
  modalContent: (close: () => void) => any
  modalProps?: any
}) => {
  const [isOpen, setIsOpen] = createSignal(false)

  return (
    <div
      class={props.theme}
      style={{
        padding: '1rem',
        'background-color': 'var(--color-bg-base)',
        color: 'var(--color-text-primary)',
        'border-radius': '8px',
        'min-height': '100px',
      }}
    >
      <div style={{ 'font-size': '12px', opacity: 0.7, 'margin-bottom': '0.5rem' }}>{props.themeName}</div>
      {props.children(() => setIsOpen(true))}
      <Modal open={isOpen()} onClose={() => setIsOpen(false)} {...props.modalProps}>
        {props.modalContent(() => setIsOpen(false))}
      </Modal>
    </div>
  )
}

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Modal" group="components">
      <Hst.Variant title="Basic">
        <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap' }}>
          <ThemedModalDemo
            theme={chronicleTheme}
            themeName="Chronicle (Dark)"
            modalProps={{ title: 'Modal Title' }}
            modalContent={(_close) => (
              <>
                <p>This is the modal content. Press Escape or click outside to close.</p>
              </>
            )}
          >
            {(open) => <Button onClick={open}>Open Modal</Button>}
          </ThemedModalDemo>
          <ThemedModalDemo
            theme={starlightTheme}
            themeName="Starlight (Light)"
            modalProps={{ title: 'Modal Title' }}
            modalContent={(_close) => (
              <>
                <p>This is the modal content. Press Escape or click outside to close.</p>
              </>
            )}
          >
            {(open) => <Button onClick={open}>Open Modal</Button>}
          </ThemedModalDemo>
        </div>
      </Hst.Variant>

      <Hst.Variant title="Sizes">
        <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap' }}>
          {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
            <ThemedModalDemo
              theme={chronicleTheme}
              themeName={`Size: ${size}`}
              modalProps={{ title: `${size.toUpperCase()} Modal`, size }}
              modalContent={() => <p>This is a {size} sized modal.</p>}
            >
              {(open) => (
                <Button onClick={open} variant="secondary">
                  {size}
                </Button>
              )}
            </ThemedModalDemo>
          ))}
        </div>
      </Hst.Variant>

      <Hst.Variant title="With Footer">
        <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap' }}>
          <ThemedModalDemo
            theme={chronicleTheme}
            themeName="Chronicle (Dark)"
            modalProps={{
              title: 'Confirm Action',
              footer: (
                <>
                  <Button variant="ghost" onClick={() => {}}>
                    Cancel
                  </Button>
                  <Button onClick={() => {}}>Confirm</Button>
                </>
              ),
            }}
            modalContent={() => <p>Are you sure you want to proceed with this action?</p>}
          >
            {(open) => <Button onClick={open}>Open with Footer</Button>}
          </ThemedModalDemo>
          <ThemedModalDemo
            theme={starlightTheme}
            themeName="Starlight (Light)"
            modalProps={{
              title: 'Delete Item',
              footer: (
                <>
                  <Button variant="ghost" onClick={() => {}}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={() => {}}>
                    Delete
                  </Button>
                </>
              ),
            }}
            modalContent={() => <p>This action cannot be undone. Are you sure?</p>}
          >
            {(open) => <Button onClick={open}>Open with Footer</Button>}
          </ThemedModalDemo>
        </div>
      </Hst.Variant>

      <Hst.Variant title="With Form">
        <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap' }}>
          <ThemedModalDemo
            theme={chronicleTheme}
            themeName="Chronicle (Dark)"
            modalProps={{
              title: 'Create New Item',
              footer: (
                <>
                  <Button variant="ghost" onClick={() => {}}>
                    Cancel
                  </Button>
                  <Button onClick={() => {}}>Create</Button>
                </>
              ),
            }}
            modalContent={() => (
              <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', 'margin-bottom': '0.5rem' }}>Name</label>
                  <Input placeholder="Enter name..." />
                </div>
                <div>
                  <label style={{ display: 'block', 'margin-bottom': '0.5rem' }}>Description</label>
                  <Textarea placeholder="Enter description..." rows={3} />
                </div>
              </div>
            )}
          >
            {(open) => <Button onClick={open}>Open Form Modal</Button>}
          </ThemedModalDemo>
        </div>
      </Hst.Variant>

      <Hst.Variant title="No Title">
        <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap' }}>
          <ThemedModalDemo
            theme={chronicleTheme}
            themeName="Chronicle (Dark)"
            modalProps={{}}
            modalContent={() => (
              <div style={{ 'text-align': 'center', padding: '2rem' }}>
                <p style={{ 'font-size': '1.25rem', 'margin-bottom': '1rem' }}>Welcome!</p>
                <p>This modal has no title bar, just a close button.</p>
              </div>
            )}
          >
            {(open) => (
              <Button onClick={open} variant="secondary">
                No Title Modal
              </Button>
            )}
          </ThemedModalDemo>
        </div>
      </Hst.Variant>
    </Hst.Story>
  )
}
