import { Button, Card, CardBody, Input, Modal, Spinner, Stack, Textarea } from '@mythweavers/ui'
import { For, Show, createSignal } from 'solid-js'
import { messagesStore } from '../stores/messagesStore'
import { modelsStore } from '../stores/modelsStore'
import { settingsStore } from '../stores/settingsStore'
import { Message } from '../types/core'
import { LLMClientFactory, type LLMMessage } from '../utils/llm'

interface MessageRewriterProps {
  messages: Message[]
  preselectedMessageId?: string | null
  onClose: () => void
}

export function MessageRewriter(props: MessageRewriterProps) {
  const [selectedMessageIds, setSelectedMessageIds] = createSignal<Set<string>>(
    props.preselectedMessageId ? new Set([props.preselectedMessageId]) : new Set(),
  )
  const [rewriteInstruction, setRewriteInstruction] = createSignal('')
  const [filterText, setFilterText] = createSignal('')
  const [isRewriting, setIsRewriting] = createSignal(false)
  const [progress, setProgress] = createSignal({ current: 0, total: 0 })

  const filteredMessages = () => {
    const filter = filterText().toLowerCase()
    if (!filter) return props.messages
    return props.messages.filter((m) => m.content.toLowerCase().includes(filter))
  }

  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessageIds((current) => {
      const newSet = new Set(current)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  const selectAll = () => {
    setSelectedMessageIds(new Set(filteredMessages().map((m) => m.id)))
  }

  const deselectAll = () => {
    setSelectedMessageIds(new Set<string>())
  }

  const rewriteMessages = async () => {
    const selected = selectedMessageIds()
    if (selected.size === 0 || !rewriteInstruction()) {
      alert('Please select messages and provide rewrite instructions')
      return
    }

    setIsRewriting(true)
    setProgress({ current: 0, total: selected.size })

    try {
      const modelInfo = modelsStore.availableModels.find((m) => m.name === settingsStore.model)
      const client = LLMClientFactory.getClient(settingsStore.provider)

      let processedCount = 0

      for (const messageId of selected) {
        const message = props.messages.find((m) => m.id === messageId)
        if (!message) continue

        const prompt = `Rewrite the following text according to these instructions: "${rewriteInstruction()}"

Important guidelines:
- You may rewrite larger sections around the specific change to ensure smooth narrative flow
- Make sure transitions between sentences and paragraphs remain natural
- If changing a specific detail, adjust surrounding context as needed so everything makes sense
- Preserve the overall story, tone, style, and narrative perspective
- Maintain approximately the same length overall
- Ensure the rewritten section reads as a cohesive whole, not as if a single sentence was copy-pasted

The goal is to make the requested change while ensuring the entire passage flows naturally and coherently.

Original text:
${message.content}

Rewritten text:`

        const messages: LLMMessage[] = [{ role: 'user', content: prompt }]

        const response = client.generate({
          model: settingsStore.model,
          messages,
          stream: false,
          providerOptions:
            settingsStore.provider === 'ollama'
              ? {
                  num_ctx: modelInfo?.context_length || 4096,
                }
              : undefined,
          metadata: { callType: 'rewrite:message' },
        })

        let rewrittenContent = ''
        for await (const part of response) {
          if (part.response) {
            rewrittenContent += part.response
          }
        }

        // Update the message with the rewritten content
        messagesStore.updateMessage(messageId, {
          content: rewrittenContent.trim(),
          versionType: 'rewrite',
        } as any)

        processedCount++
        setProgress({ current: processedCount, total: selected.size })
      }

      alert(`Successfully rewrote ${processedCount} messages`)
      props.onClose()
    } catch (error) {
      console.error('Error rewriting messages:', error)
      alert(`Error rewriting messages: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsRewriting(false)
    }
  }

  return (
    <Modal open={true} onClose={props.onClose} title="Rewrite Messages" size="lg">
      <Stack gap="md" style={{ padding: '1rem' }}>
        <div>
          <label
            style={{
              display: 'block',
              'margin-bottom': '0.25rem',
              color: 'var(--text-secondary)',
              'font-size': '0.9rem',
            }}
          >
            Rewrite Instructions:
          </label>
          <Textarea
            value={rewriteInstruction()}
            onInput={(e) => setRewriteInstruction(e.currentTarget.value)}
            placeholder='e.g., "Remove all mentions of the red dragon" or "Fix the character name from John to James"'
            rows={3}
          />
        </div>

        <div>
          <label
            style={{
              display: 'block',
              'margin-bottom': '0.25rem',
              color: 'var(--text-secondary)',
              'font-size': '0.9rem',
            }}
          >
            Filter Messages:
          </label>
          <Input
            type="text"
            value={filterText()}
            onInput={(e) => setFilterText(e.currentTarget.value)}
            placeholder="Type to filter messages..."
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', 'align-items': 'center', 'flex-wrap': 'wrap' }}>
          <Button size="sm" variant="secondary" onClick={selectAll}>
            Select All Visible
          </Button>
          <Button size="sm" variant="secondary" onClick={deselectAll}>
            Deselect All
          </Button>
          <span style={{ color: 'var(--text-secondary)', 'font-size': '0.9rem' }}>
            {selectedMessageIds().size} selected / {filteredMessages().length} visible / {props.messages.length} total
          </span>
        </div>

        <div
          style={{
            'max-height': '300px',
            'overflow-y': 'auto',
            display: 'flex',
            'flex-direction': 'column',
            gap: '0.5rem',
          }}
        >
          <For each={filteredMessages()}>
            {(message) => (
              <Card
                interactive
                onClick={() => toggleMessageSelection(message.id)}
                style={{
                  cursor: 'pointer',
                  border: selectedMessageIds().has(message.id)
                    ? '2px solid var(--primary-color)'
                    : '1px solid var(--border-color)',
                  background: selectedMessageIds().has(message.id)
                    ? 'color-mix(in srgb, var(--primary-color) 10%, var(--bg-primary))'
                    : 'var(--bg-primary)',
                }}
              >
                <CardBody padding="sm">
                  <div style={{ display: 'flex', gap: '0.5rem', 'align-items': 'flex-start' }}>
                    <input
                      type="checkbox"
                      checked={selectedMessageIds().has(message.id)}
                      onChange={() => toggleMessageSelection(message.id)}
                      style={{ 'margin-top': '0.25rem' }}
                    />
                    <div style={{ color: 'var(--text-primary)', 'font-size': '0.9rem', 'line-height': '1.4' }}>
                      {message.content.slice(0, 200)}...
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}
          </For>
        </div>

        <Show when={isRewriting()}>
          <Card variant="flat">
            <CardBody padding="sm" style={{ 'text-align': 'center' }}>
              <Spinner size="sm" /> Rewriting message {progress().current} of {progress().total}...
            </CardBody>
          </Card>
        </Show>
      </Stack>

      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          'justify-content': 'flex-end',
          padding: '1rem',
          'border-top': '1px solid var(--border-color)',
        }}
      >
        <Button variant="secondary" onClick={props.onClose} disabled={isRewriting()}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={rewriteMessages}
          disabled={isRewriting() || selectedMessageIds().size === 0 || !rewriteInstruction()}
        >
          {isRewriting() ? 'Rewriting...' : 'Rewrite Selected Messages'}
        </Button>
      </div>
    </Modal>
  )
}
