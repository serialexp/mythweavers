import { createSignal, For, Show } from 'solid-js'
import { Message } from '../types/core'
import { messagesStore } from '../stores/messagesStore'
import { settingsStore } from '../stores/settingsStore'
import { modelsStore } from '../stores/modelsStore'
import { LLMClientFactory, type LLMMessage } from '../utils/llm'
import styles from './MessageRewriter.module.css'

interface MessageRewriterProps {
  messages: Message[]
  preselectedMessageId?: string | null
  onClose: () => void
}

export function MessageRewriter(props: MessageRewriterProps) {
  const [selectedMessageIds, setSelectedMessageIds] = createSignal<Set<string>>(
    props.preselectedMessageId ? new Set([props.preselectedMessageId]) : new Set()
  )
  const [rewriteInstruction, setRewriteInstruction] = createSignal('')
  const [filterText, setFilterText] = createSignal('')
  const [isRewriting, setIsRewriting] = createSignal(false)
  const [progress, setProgress] = createSignal({ current: 0, total: 0 })
  
  const filteredMessages = () => {
    const filter = filterText().toLowerCase()
    if (!filter) return props.messages
    return props.messages.filter(m => 
      m.content.toLowerCase().includes(filter)
    )
  }

  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessageIds(current => {
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
    setSelectedMessageIds(new Set(filteredMessages().map(m => m.id)))
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
      const modelInfo = modelsStore.availableModels.find(m => m.name === settingsStore.model)
      const client = LLMClientFactory.getClient(settingsStore.provider)

      let processedCount = 0
      
      for (const messageId of selected) {
        const message = props.messages.find(m => m.id === messageId)
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
          providerOptions: settingsStore.provider === 'ollama' ? {
            num_ctx: modelInfo?.context_length || 4096
          } : undefined,
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
          versionType: 'rewrite'
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
    <div class={styles.container}>
      <div class={styles.modal}>
        <h2>Rewrite Messages</h2>
        
        <div class={styles.instructions}>
          <label>
            Rewrite Instructions:
            <textarea
              value={rewriteInstruction()}
              onInput={(e) => setRewriteInstruction(e.currentTarget.value)}
              placeholder='e.g., "Remove all mentions of the red dragon" or "Fix the character name from John to James"'
              rows={3}
            />
          </label>
        </div>

        <div class={styles.filterSection}>
          <label>
            Filter Messages:
            <input
              type="text"
              value={filterText()}
              onInput={(e) => setFilterText(e.currentTarget.value)}
              placeholder="Type to filter messages..."
            />
          </label>
        </div>

        <div class={styles.selectionControls}>
          <button onClick={selectAll}>Select All Visible</button>
          <button onClick={deselectAll}>Deselect All</button>
          <span>{selectedMessageIds().size} selected / {filteredMessages().length} visible / {props.messages.length} total</span>
        </div>

        <div class={styles.messageList}>
          <For each={filteredMessages()}>
            {(message) => (
              <div 
                class={`${styles.messageItem} ${selectedMessageIds().has(message.id) ? styles.selected : ''}`}
                onClick={() => toggleMessageSelection(message.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedMessageIds().has(message.id)}
                  onChange={() => toggleMessageSelection(message.id)}
                />
                <div class={styles.messageContent}>
                  {message.content.slice(0, 200)}...
                </div>
              </div>
            )}
          </For>
        </div>

        <Show when={isRewriting()}>
          <div class={styles.progress}>
            Rewriting message {progress().current} of {progress().total}...
          </div>
        </Show>

        <div class={styles.actions}>
          <button onClick={props.onClose} disabled={isRewriting()}>
            Cancel
          </button>
          <button 
            onClick={rewriteMessages} 
            disabled={isRewriting() || selectedMessageIds().size === 0 || !rewriteInstruction()}
            class={styles.primaryButton}
          >
            {isRewriting() ? 'Rewriting...' : 'Rewrite Selected Messages'}
          </button>
        </div>
      </div>
    </div>
  )
}
