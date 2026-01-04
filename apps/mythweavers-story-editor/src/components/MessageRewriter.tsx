import { Button, Card, CardBody, Input, Modal, Spinner, Stack, Textarea } from '@mythweavers/ui'
import * as Diff from 'diff'
import { BsCheck2, BsX } from 'solid-icons/bs'
import { For, Show, createMemo, createSignal } from 'solid-js'
import { messagesStore } from '../stores/messagesStore'
import { modelsStore } from '../stores/modelsStore'
import { settingsStore } from '../stores/settingsStore'
import { Message } from '../types/core'
import { LLMClientFactory, type LLMMessage } from '../utils/llm'
import * as styles from './MessageRewriter.css'

interface RewriteResult {
  messageId: string
  messagePreview: string
  originalContent: string
  proposedContent: string | null
  error: string | null
  accepted: boolean
}

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
  const [results, setResults] = createSignal<RewriteResult[]>([])

  // Check if we have results to show (preview phase)
  const hasResults = createMemo(() => results().length > 0)

  // Count pending (unaccepted, non-error) results
  const pendingCount = createMemo(() => {
    return results().filter((r) => !r.accepted && !r.error && r.proposedContent).length
  })

  // Compute diff between original and proposed content
  const computeDiff = (original: string, proposed: string) => {
    return Diff.diffLines(original, proposed)
  }

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
    setResults([])

    try {
      const modelInfo = modelsStore.availableModels.find((m) => m.name === settingsStore.model)
      const client = LLMClientFactory.getClient(settingsStore.provider)

      let processedCount = 0

      for (const messageId of selected) {
        const message = props.messages.find((m) => m.id === messageId)
        if (!message) continue

        const messagePreview = message.content.slice(0, 100) + (message.content.length > 100 ? '...' : '')

        try {
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

          const llmMessages: LLMMessage[] = [{ role: 'user', content: prompt }]

          const response = client.generate({
            model: settingsStore.model,
            messages: llmMessages,
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

          const trimmedContent = rewrittenContent.trim()

          // Store the result for preview
          setResults((prev) => [
            ...prev,
            {
              messageId,
              messagePreview,
              originalContent: message.content,
              proposedContent: trimmedContent,
              error: null,
              accepted: false,
            },
          ])
        } catch (error) {
          // Store error result
          setResults((prev) => [
            ...prev,
            {
              messageId,
              messagePreview,
              originalContent: message.content,
              proposedContent: null,
              error: error instanceof Error ? error.message : 'Failed to generate rewrite',
              accepted: false,
            },
          ])
        }

        processedCount++
        setProgress({ current: processedCount, total: selected.size })
      }
    } catch (error) {
      console.error('Error rewriting messages:', error)
      alert(`Error rewriting messages: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsRewriting(false)
    }
  }

  const handleAcceptResult = async (messageId: string) => {
    const result = results().find((r) => r.messageId === messageId)
    if (!result || !result.proposedContent) return

    // Create a new revision with the rewritten content
    const { saveService } = await import('../services/saveService')
    try {
      const { revisionId } = await saveService.createMessageRevision(messageId, result.proposedContent)
      // Update local state with new content and revision ID
      // Clear paragraphs to force editor to re-parse from new content
      messagesStore.updateMessage(messageId, {
        content: result.proposedContent,
        currentMessageRevisionId: revisionId,
        paragraphs: undefined,
      })
    } catch (error) {
      console.error('Failed to create message revision:', error)
      // Fall back to just updating local state
      messagesStore.updateMessage(messageId, { content: result.proposedContent, paragraphs: undefined })
    }

    // Mark as accepted
    setResults((prev) => prev.map((r) => (r.messageId === messageId ? { ...r, accepted: true } : r)))
  }

  const handleRejectResult = (messageId: string) => {
    setResults((prev) => prev.filter((r) => r.messageId !== messageId))
  }

  const handleAcceptAll = async () => {
    const pendingResults = results().filter((r) => !r.accepted && !r.error && r.proposedContent)
    const { saveService } = await import('../services/saveService')

    for (const result of pendingResults) {
      try {
        const { revisionId } = await saveService.createMessageRevision(result.messageId, result.proposedContent!)
        messagesStore.updateMessage(result.messageId, {
          content: result.proposedContent!,
          currentMessageRevisionId: revisionId,
          paragraphs: undefined,
        })
      } catch (error) {
        console.error('Failed to create message revision:', error)
        messagesStore.updateMessage(result.messageId, { content: result.proposedContent!, paragraphs: undefined })
      }
    }

    // Mark all as accepted
    setResults((prev) => prev.map((r) => (r.proposedContent && !r.error ? { ...r, accepted: true } : r)))
  }

  const handleReset = () => {
    setResults([])
  }

  return (
    <Modal
      open={true}
      onClose={props.onClose}
      title={hasResults() ? 'Review Rewrites' : 'Rewrite Messages'}
      size="lg"
    >
      {/* Results Preview Phase */}
      <Show when={hasResults() && !isRewriting()}>
        <Stack gap="md" style={{ padding: '1rem' }}>
          <div class={styles.resultsContainer}>
            <For each={results()}>
              {(result) => (
                <div class={`${styles.resultCard} ${result.accepted ? styles.resultCardAccepted : ''}`}>
                  <div class={styles.resultHeader}>
                    <span class={styles.resultTitle}>{result.messagePreview}</span>
                    <Show when={result.accepted}>
                      <span class={styles.acceptedBadge}>✓ Accepted</span>
                    </Show>
                    <Show when={result.error}>
                      <span class={styles.errorBadge}>Error</span>
                    </Show>
                    <Show when={!result.accepted && !result.error && result.proposedContent}>
                      <div class={styles.resultActions}>
                        <button
                          type="button"
                          class={styles.acceptButton}
                          onClick={() => handleAcceptResult(result.messageId)}
                          title="Accept changes"
                        >
                          <BsCheck2 />
                        </button>
                        <button
                          type="button"
                          class={styles.rejectButton}
                          onClick={() => handleRejectResult(result.messageId)}
                          title="Reject changes"
                        >
                          <BsX />
                        </button>
                      </div>
                    </Show>
                  </div>

                  <Show when={result.error}>
                    <div style={{ color: '#ef4444', 'font-size': '0.875rem' }}>{result.error}</div>
                  </Show>

                  <Show when={result.proposedContent && !result.error}>
                    <div class={styles.diffContainer}>
                      {/* Original Content */}
                      <div class={styles.diffPane}>
                        <div class={styles.diffHeader}>Original</div>
                        <div class={styles.diffContent}>
                          <For each={computeDiff(result.originalContent, result.proposedContent!)}>
                            {(part) => (
                              <Show when={!part.added}>
                                <span class={`${styles.diffLine} ${part.removed ? styles.diffLineRemoved : ''}`}>
                                  {part.value}
                                </span>
                              </Show>
                            )}
                          </For>
                        </div>
                      </div>

                      {/* Proposed Content */}
                      <div class={styles.diffPane}>
                        <div class={styles.diffHeader}>Proposed</div>
                        <div class={styles.diffContent}>
                          <For each={computeDiff(result.originalContent, result.proposedContent!)}>
                            {(part) => (
                              <Show when={!part.removed}>
                                <span class={`${styles.diffLine} ${part.added ? styles.diffLineAdded : ''}`}>
                                  {part.value}
                                </span>
                              </Show>
                            )}
                          </For>
                        </div>
                      </div>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Stack>

        <div class={styles.footer}>
          <Button variant="secondary" onClick={handleReset}>
            Start Over
          </Button>
          <Button variant="secondary" onClick={props.onClose}>
            Close
          </Button>
          <Show when={pendingCount() > 0}>
            <Button variant="primary" onClick={handleAcceptAll}>
              Accept All ({pendingCount()})
            </Button>
          </Show>
        </div>
      </Show>

      {/* Input Phase */}
      <Show when={!hasResults()}>
        <Stack gap="md" style={{ padding: '1rem' }}>
          <Show when={isRewriting()}>
            <div class={styles.loadingContainer}>
              <Spinner size="md" />
              <span>Rewriting message {progress().current} of {progress().total}...</span>
            </div>
          </Show>

          <Show when={!isRewriting()}>
            <div>
              <label class={styles.label}>Rewrite Instructions:</label>
              <Textarea
                value={rewriteInstruction()}
                onInput={(e) => setRewriteInstruction(e.currentTarget.value)}
                placeholder='e.g., "Remove all mentions of the red dragon" or "Fix the character name from John to James"'
                rows={3}
              />
            </div>

            <div>
              <label class={styles.label}>Filter Messages:</label>
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
              <span class={styles.selectionInfo}>
                {selectedMessageIds().size} selected / {filteredMessages().length} visible / {props.messages.length} total
              </span>
            </div>

            <div class={styles.messageListContainer}>
              <For each={filteredMessages()}>
                {(message) => (
                  <Card
                    interactive
                    onClick={() => toggleMessageSelection(message.id)}
                    class={selectedMessageIds().has(message.id) ? styles.messageCardSelected : styles.messageCardUnselected}
                  >
                    <CardBody padding="sm">
                      <div style={{ display: 'flex', gap: '0.5rem', 'align-items': 'flex-start' }}>
                        <input
                          type="checkbox"
                          checked={selectedMessageIds().has(message.id)}
                          onChange={() => toggleMessageSelection(message.id)}
                          style={{ 'margin-top': '0.25rem' }}
                        />
                        <div class={styles.messageContent}>{message.content.slice(0, 200)}...</div>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </For>
            </div>
          </Show>
        </Stack>

        <div class={styles.footer}>
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
      </Show>
    </Modal>
  )
}
