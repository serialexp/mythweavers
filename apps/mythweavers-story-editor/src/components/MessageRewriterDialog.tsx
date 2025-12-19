import { Show, createEffect, createSignal } from 'solid-js'
import { messagesStore } from '../stores/messagesStore'
import { rewriteDialogStore } from '../stores/rewriteDialogStore'
import { MessageRewriter } from './MessageRewriter'

export function MessageRewriterDialog() {
  const [preselectedId, setPreselectedId] = createSignal<string | null>(null)

  // Update preselected ID when dialog opens
  createEffect(() => {
    if (rewriteDialogStore.isOpen) {
      const ids = rewriteDialogStore.selectedMessageIds
      setPreselectedId(ids.length > 0 ? ids[0] : null)
    }
  })

  return (
    <Show when={rewriteDialogStore.isOpen}>
      <MessageRewriter
        messages={messagesStore.messages.filter((m) => m.role === 'assistant' && !m.isQuery)}
        preselectedMessageId={preselectedId()}
        onClose={() => rewriteDialogStore.hide()}
      />
    </Show>
  )
}
