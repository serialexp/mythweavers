import { Alert, Button, Modal, Stack, Textarea } from '@mythweavers/ui'
import { Component, Show, createEffect, createSignal } from 'solid-js'
import { copyPreviewStore } from '../stores/copyPreviewStore'

export const CopyTokenModal: Component = () => {
  const state = copyPreviewStore.state
  let textareaRef: HTMLTextAreaElement | undefined
  const [copiedMessage, setCopiedMessage] = createSignal(false)

  createEffect(() => {
    if (state.showFallback && textareaRef) {
      textareaRef.select()
    }
  })

  const handleCopyFallback = () => {
    if (textareaRef) {
      textareaRef.select()
      try {
        document.execCommand('copy')
        setCopiedMessage(true)
        setTimeout(() => setCopiedMessage(false), 2000)
      } catch {
        alert('Failed to copy. Please select and copy manually.')
      }
    }
  }

  return (
    <Modal
      open={state.isOpen}
      onClose={() => copyPreviewStore.cancel()}
      title={state.showFallback ? 'Copy Text' : 'Token Count Preview'}
      size="md"
      footer={
        <Stack direction="horizontal" gap="sm" justify="end">
          <Button variant="ghost" onClick={() => copyPreviewStore.cancel()} disabled={state.isLoading}>
            {state.showFallback ? 'Done' : 'Cancel'}
          </Button>
          <Show when={!state.showFallback}>
            <Button onClick={() => copyPreviewStore.confirmCopy()} disabled={state.isLoading}>
              Copy
            </Button>
          </Show>
          <Show when={state.showFallback}>
            <Button onClick={handleCopyFallback}>{copiedMessage() ? 'Copied!' : 'Copy'}</Button>
          </Show>
        </Stack>
      }
    >
      <div style={{ 'line-height': '1.5', 'white-space': 'pre-wrap' }}>
        <Show when={state.showFallback}>
          <p>Copy the text below manually:</p>
          <Textarea
            ref={textareaRef!}
            value={state.text}
            readonly
            rows={10}
            style={{ 'font-family': 'monospace', 'font-size': '0.9rem', margin: '12px 0' }}
          />
          <Show when={copiedMessage()}>
            <Alert variant="success">Copied to clipboard!</Alert>
          </Show>
        </Show>
        <Show when={!state.showFallback}>
          <Show when={state.isLoading}>
            <p>Calculating token usage…</p>
          </Show>
          <Show when={!state.isLoading && !state.error && state.tokens !== null}>
            <p>
              Copied text constitutes <strong style={{ 'font-weight': '600' }}>{state.tokens!.toLocaleString()}</strong>{' '}
              tokens.
            </p>
          </Show>
          <Show when={state.error}>
            <Alert variant="error">{state.error}</Alert>
          </Show>
        </Show>
      </div>
    </Modal>
  )
}
