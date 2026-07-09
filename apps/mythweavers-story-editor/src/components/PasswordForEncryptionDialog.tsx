import { Alert, Button, FormField, Input, Modal, Spinner } from '@mythweavers/ui'
import { Component, Show, createSignal } from 'solid-js'
import { settingsStore } from '../stores/settingsStore'

interface PasswordForEncryptionDialogProps {
  /** 'decrypt' = unlocking secrets from backend, 'encrypt' = first-time encryption */
  mode: 'decrypt' | 'encrypt'
  onClose: () => void
}

export const PasswordForEncryptionDialog: Component<PasswordForEncryptionDialogProps> = (props) => {
  const [password, setPassword] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal('')

  const title = () => (props.mode === 'decrypt' ? 'Unlock API Keys' : 'Encrypt API Keys')

  const description = () =>
    props.mode === 'decrypt'
      ? 'Enter your account password to decrypt your API keys on this device.'
      : 'Enter your account password to encrypt your API keys before syncing to the server.'

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    const pw = password().trim()
    if (!pw) return

    setLoading(true)
    setError('')

    try {
      const key = await settingsStore.deriveKey(pw)
      await settingsStore.setEncryptionKey(key)

      if (props.mode === 'encrypt') {
        settingsStore.encryptAndSync()
      }

      props.onClose()
    } catch (err) {
      if (!settingsStore.isEncryptionAvailable()) {
        // crypto.subtle is undefined on insecure origins — not a password problem
        setError('Encryption is unavailable on this connection. Use HTTPS or localhost to sync encrypted keys.')
      } else if (err instanceof DOMException && err.name === 'OperationError') {
        // AES-GCM authentication failure — the actual wrong-password case
        setError('Incorrect password. Please try again.')
      } else {
        setError(`Could not unlock keys: ${err instanceof Error ? err.message : String(err)}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={true} onClose={props.onClose} title={title()} size="sm">
      <form onSubmit={handleSubmit}>
        <p style={{ 'margin-bottom': '1rem', color: 'var(--color-text-secondary)', 'font-size': '0.875rem' }}>
          {description()}
        </p>

        <Show when={error()}>
          <Alert variant="error" style={{ 'margin-bottom': '1rem' }}>
            {error()}
          </Alert>
        </Show>

        <FormField label="Password">
          <Input
            type="password"
            value={password()}
            onInput={(e: InputEvent) => setPassword((e.target as HTMLInputElement).value)}
            placeholder="Your account password"
            autofocus
          />
        </FormField>

        <div style={{ display: 'flex', gap: '0.5rem', 'margin-top': '1rem', 'justify-content': 'flex-end' }}>
          <Button variant="ghost" onClick={props.onClose} disabled={loading()}>
            Skip
          </Button>
          <Button variant="primary" type="submit" disabled={!password().trim() || loading()}>
            <Show when={loading()} fallback={props.mode === 'decrypt' ? 'Unlock' : 'Encrypt'}>
              <Spinner size="sm" />
            </Show>
          </Button>
        </div>
      </form>
    </Modal>
  )
}
