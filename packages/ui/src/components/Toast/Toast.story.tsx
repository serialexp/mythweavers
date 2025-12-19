import { For, createSignal } from 'solid-js'
import { chronicleTheme } from '../../theme/chronicle.css'
import { starlightTheme } from '../../theme/starlight.css'
import { Button } from '../Button'
import { Toast, ToastContainer } from './Toast'

// Demo wrapper with toast state
const ToastDemo = (props: { theme: string; themeName: string }) => {
  const [toasts, setToasts] = createSignal<Array<{ id: number; variant: string; title?: string; message: string }>>([])
  let idCounter = 0

  const addToast = (variant: string, title: string | undefined, message: string) => {
    const id = idCounter++
    setToasts((prev) => [...prev, { id, variant, title, message }])
  }

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div
      class={props.theme}
      style={{
        padding: '1rem',
        'background-color': 'var(--color-bg-base)',
        color: 'var(--color-text-primary)',
        'border-radius': '8px',
        'min-height': '200px',
        position: 'relative',
      }}
    >
      <div style={{ 'font-size': '12px', opacity: 0.7, 'margin-bottom': '1rem' }}>{props.themeName}</div>
      <div style={{ display: 'flex', gap: '0.5rem', 'flex-wrap': 'wrap' }}>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => addToast('default', undefined, 'This is a default toast message.')}
        >
          Default
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => addToast('success', 'Success!', 'Your changes have been saved.')}
        >
          Success
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => addToast('warning', 'Warning', 'Please review your input.')}
        >
          Warning
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => addToast('error', 'Error', 'Something went wrong. Please try again.')}
        >
          Error
        </Button>
        <Button size="sm" variant="secondary" onClick={() => addToast('info', 'Info', 'A new update is available.')}>
          Info
        </Button>
      </div>

      <ToastContainer>
        <For each={toasts()}>
          {(toast) => (
            <Toast
              variant={toast.variant as any}
              title={toast.title}
              message={toast.message}
              onClose={() => removeToast(toast.id)}
              duration={5000}
            />
          )}
        </For>
      </ToastContainer>
    </div>
  )
}

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Toast" group="components">
      <Hst.Variant title="Interactive Demo">
        <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap' }}>
          <ToastDemo theme={chronicleTheme} themeName="Chronicle (Dark)" />
          <ToastDemo theme={starlightTheme} themeName="Starlight (Light)" />
        </div>
      </Hst.Variant>

      <Hst.Variant title="Static Examples">
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1rem', 'max-width': '400px' }}>
          <div
            class={chronicleTheme}
            style={{ padding: '1rem', 'border-radius': '8px', 'background-color': 'var(--color-bg-base)' }}
          >
            <Toast variant="default" message="This is a default toast." />
          </div>
          <div
            class={chronicleTheme}
            style={{ padding: '1rem', 'border-radius': '8px', 'background-color': 'var(--color-bg-base)' }}
          >
            <Toast variant="success" title="Success!" message="Your changes have been saved." />
          </div>
          <div
            class={chronicleTheme}
            style={{ padding: '1rem', 'border-radius': '8px', 'background-color': 'var(--color-bg-base)' }}
          >
            <Toast variant="warning" title="Warning" message="Please review your input." />
          </div>
          <div
            class={chronicleTheme}
            style={{ padding: '1rem', 'border-radius': '8px', 'background-color': 'var(--color-bg-base)' }}
          >
            <Toast variant="error" title="Error" message="Something went wrong." />
          </div>
          <div
            class={chronicleTheme}
            style={{ padding: '1rem', 'border-radius': '8px', 'background-color': 'var(--color-bg-base)' }}
          >
            <Toast variant="info" title="Info" message="A new update is available." />
          </div>
        </div>
      </Hst.Variant>
    </Hst.Story>
  )
}
