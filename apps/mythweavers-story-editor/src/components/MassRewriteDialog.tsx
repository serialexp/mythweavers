import { Button, Modal, Spinner, Textarea } from '@mythweavers/ui'
import * as Diff from 'diff'
import { For, Show, createMemo, createSignal } from 'solid-js'
import { massRewriteDialogStore } from '../stores/massRewriteDialogStore'
import { messagesStore } from '../stores/messagesStore'
import { modelsStore } from '../stores/modelsStore'
import { nodeStore } from '../stores/nodeStore'
import { settingsStore } from '../stores/settingsStore'
import type { Message, Node } from '../types/core'
import { LLMClientFactory, type LLMMessage } from '../utils/llm'
import * as styles from './MassRewriteDialog.css'

interface RewriteResult {
  messageId: string
  originalContent: string
  proposedContent: string
  status: 'pending' | 'accepted' | 'rejected' | 'skipped'
}

interface SceneWithContent {
  node: Node
  path: string
  content: string
  wordCount: number
}

type Phase = 'selection' | 'processing' | 'review'

export function MassRewriteDialog() {
  const [rewriteInstruction, setRewriteInstruction] = createSignal('')
  const [filterText, setFilterText] = createSignal('')
  const [phase, setPhase] = createSignal<Phase>('selection')
  const [isProcessing, setIsProcessing] = createSignal(false)
  const [currentProcessingIndex, setCurrentProcessingIndex] = createSignal(0)
  const [results, setResults] = createSignal<RewriteResult[]>([])
  const [currentReviewIndex, setCurrentReviewIndex] = createSignal(0)

  // Get the target node
  const targetNode = createMemo(() => {
    const nodeId = massRewriteDialogStore.targetNodeId
    if (!nodeId) return null
    return nodeStore.getNode(nodeId) || null
  })

  // Get messages for the target node
  const nodeMessages = createMemo((): Message[] => {
    const nodeId = massRewriteDialogStore.targetNodeId
    if (!nodeId) return []
    return messagesStore.messages
      .filter((m) => m.sceneId === nodeId && m.role === 'assistant' && !m.isQuery)
      .sort((a, b) => a.order - b.order)
  })

  // Build path string for a node
  const getNodePath = (node: Node): string => {
    const parts: string[] = []
    let current: Node | null = node

    while (current) {
      if (current.type !== 'scene') {
        parts.unshift(current.title)
      }
      current = current.parentId ? nodeStore.getNode(current.parentId) : null
    }

    return parts.join(' > ')
  }

  // Get all scenes that appear before the target node
  const availableContextScenes = createMemo((): SceneWithContent[] => {
    const nodeId = massRewriteDialogStore.targetNodeId
    if (!nodeId) return []

    const targetN = nodeStore.getNode(nodeId)
    if (!targetN) return []

    const precedingNodes: Node[] = []

    const collectNodes = (treeNodes: typeof nodeStore.tree): boolean => {
      for (const treeNode of treeNodes) {
        if (treeNode.id === nodeId) {
          return true
        }

        const node = nodeStore.getNode(treeNode.id)
        if (node && (node.type === 'chapter' || node.type === 'scene')) {
          precedingNodes.push(node)
        }

        if (treeNode.children.length > 0) {
          const found = collectNodes(treeNode.children)
          if (found) return true
        }
      }
      return false
    }

    collectNodes(nodeStore.tree)

    return precedingNodes
      .map((node) => {
        const nodeMessages = messagesStore.messages.filter(
          (m) => m.sceneId === node.id && m.role === 'assistant' && !m.isQuery,
        )
        const content = nodeMessages.map((m) => m.content).join('\n\n')
        const wordCount = content.split(/\s+/).filter(Boolean).length

        return {
          node,
          path: getNodePath(node),
          content,
          wordCount,
        }
      })
      .filter((item) => item.wordCount > 0)
  })

  // Filter context scenes by search text
  const filteredContextScenes = createMemo(() => {
    const filter = filterText().toLowerCase()
    if (!filter) return availableContextScenes()

    return availableContextScenes().filter(
      (scene) =>
        scene.node.title.toLowerCase().includes(filter) ||
        scene.path.toLowerCase().includes(filter),
    )
  })

  // Calculate token estimates
  const contextTokenEstimate = createMemo(() => {
    const selectedIds = massRewriteDialogStore.selectedContextSceneIds
    let totalWords = 0

    for (const sceneId of selectedIds) {
      const scene = availableContextScenes().find((s) => s.node.id === sceneId)
      if (scene) {
        totalWords += scene.wordCount
      }
    }

    return Math.round(totalWords * 0.75)
  })

  const selectedMessagesTokens = createMemo(() => {
    const selectedIds = massRewriteDialogStore.selectedMessageIds
    let totalWords = 0

    for (const msgId of selectedIds) {
      const msg = nodeMessages().find((m) => m.id === msgId)
      if (msg) {
        totalWords += msg.content.split(/\s+/).filter(Boolean).length
      }
    }

    return Math.round(totalWords * 0.75)
  })

  // Compute diff between original and proposed content
  const computeDiff = (original: string, proposed: string) => {
    return Diff.diffLines(original, proposed)
  }

  // Get current result being reviewed
  const currentResult = createMemo(() => {
    const r = results()
    const idx = currentReviewIndex()
    return r[idx] || null
  })

  // Count results by status
  const resultStats = createMemo(() => {
    const r = results()
    return {
      total: r.length,
      pending: r.filter((x) => x.status === 'pending').length,
      accepted: r.filter((x) => x.status === 'accepted').length,
      rejected: r.filter((x) => x.status === 'rejected').length,
      skipped: r.filter((x) => x.status === 'skipped').length,
    }
  })

  const handleSelectAll = () => {
    const ids = nodeMessages().map((m) => m.id)
    massRewriteDialogStore.selectAllMessages(ids)
  }

  const handleSelectNone = () => {
    massRewriteDialogStore.clearMessageSelection()
  }

  const handleStartRewrite = async () => {
    const selectedIds = Array.from(massRewriteDialogStore.selectedMessageIds)
    if (selectedIds.length === 0 || !rewriteInstruction()) {
      alert('Please select at least one message and provide rewrite instructions')
      return
    }

    setPhase('processing')
    setIsProcessing(true)
    setResults([])
    setCurrentProcessingIndex(0)

    try {
      const modelInfo = modelsStore.availableModels.find((m) => m.name === settingsStore.model)
      const client = LLMClientFactory.getClient(settingsStore.provider)

      // Build context from selected scenes
      const selectedContextIds = massRewriteDialogStore.selectedContextSceneIds
      const contextParts: string[] = []

      for (const sceneId of selectedContextIds) {
        const scene = availableContextScenes().find((s) => s.node.id === sceneId)
        if (scene && scene.content) {
          contextParts.push(`=== ${scene.node.title} (${scene.path}) ===\n${scene.content}`)
        }
      }

      const contextSection =
        contextParts.length > 0
          ? `For reference, here is relevant earlier story content that you should keep in mind:\n\n${contextParts.join('\n\n')}\n\n---\n\n`
          : ''

      // Process messages in order
      const orderedMessages = nodeMessages().filter((m) => selectedIds.includes(m.id))
      const newResults: RewriteResult[] = []

      for (let i = 0; i < orderedMessages.length; i++) {
        setCurrentProcessingIndex(i)
        const msg = orderedMessages[i]

        // Build accumulated context from already processed messages
        // Include skipped (unchanged) and pending/accepted messages, exclude rejected
        const processedContext = newResults
          .filter((r) => r.status !== 'rejected')
          .map((r) => r.status === 'skipped' ? r.originalContent : r.proposedContent)
          .join('\n\n')

        const accumulatedContextSection = processedContext
          ? `\n\nHere is the updated content from messages you've already rewritten in this batch:\n\n${processedContext}\n\n---\n\n`
          : ''

        const prompt = `${contextSection}${accumulatedContextSection}Rewrite the following text according to these instructions: "${rewriteInstruction()}"

Important guidelines:
- If the instructions do not apply to this text and no changes are needed, respond with exactly: NO_CHANGE
- You may rewrite larger sections around the specific change to ensure smooth narrative flow
- Make sure transitions between sentences and paragraphs remain natural
- If changing a specific detail, adjust surrounding context as needed so everything makes sense
- Preserve the overall story, tone, style, and narrative perspective
- Maintain approximately the same length overall
- Ensure the rewritten section reads as a cohesive whole
${contextParts.length > 0 ? '- Keep the rewrite consistent with the earlier story content provided above' : ''}
${processedContext ? '- Ensure consistency with the already-rewritten messages in this batch' : ''}

Original text:
${msg.content}

Rewritten text (or NO_CHANGE if no changes needed):`

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
          metadata: { callType: 'rewrite:mass' },
        })

        let rewrittenContent = ''
        for await (const part of response) {
          if (part.response) {
            rewrittenContent += part.response
          }
        }

        const trimmedContent = rewrittenContent.trim()
        const isNoChange = trimmedContent === 'NO_CHANGE' || trimmedContent.startsWith('NO_CHANGE')

        newResults.push({
          messageId: msg.id,
          originalContent: msg.content,
          proposedContent: isNoChange ? msg.content : trimmedContent,
          status: isNoChange ? 'skipped' : 'pending',
        })

        setResults([...newResults])
      }

      setPhase('review')
      // Find the first pending result (skip over NO_CHANGE results)
      const firstPendingIndex = newResults.findIndex((r) => r.status === 'pending')
      setCurrentReviewIndex(firstPendingIndex >= 0 ? firstPendingIndex : 0)
    } catch (error) {
      console.error('Error during mass rewrite:', error)
      alert(`Error during rewrite: ${error instanceof Error ? error.message : String(error)}`)
      setPhase('selection')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAcceptCurrent = async () => {
    const result = currentResult()
    if (!result) return

    // Update the result status
    setResults((prev) =>
      prev.map((r) => (r.messageId === result.messageId ? { ...r, status: 'accepted' as const } : r)),
    )

    // Move to next pending result
    moveToNextPending()
  }

  const handleRejectCurrent = () => {
    const result = currentResult()
    if (!result) return

    // Update the result status
    setResults((prev) =>
      prev.map((r) => (r.messageId === result.messageId ? { ...r, status: 'rejected' as const } : r)),
    )

    // Move to next pending result
    moveToNextPending()
  }

  const moveToNextPending = () => {
    const r = results()
    const currentIdx = currentReviewIndex()

    // Find next pending result
    for (let i = currentIdx + 1; i < r.length; i++) {
      if (r[i].status === 'pending') {
        setCurrentReviewIndex(i)
        return
      }
    }

    // Check if all are reviewed
    const stats = resultStats()
    if (stats.pending === 0) {
      // All reviewed - offer to apply changes
      applyAcceptedChanges()
    }
  }

  const handleNavigateResult = (index: number) => {
    setCurrentReviewIndex(index)
  }

  const applyAcceptedChanges = async () => {
    const accepted = results().filter((r) => r.status === 'accepted')
    if (accepted.length === 0) {
      massRewriteDialogStore.hide()
      return
    }

    const { saveService } = await import('../services/saveService')

    for (const result of accepted) {
      try {
        const { revisionId } = await saveService.createMessageRevision(result.messageId, result.proposedContent)
        messagesStore.updateMessage(result.messageId, {
          content: result.proposedContent,
          currentMessageRevisionId: revisionId,
          paragraphs: undefined,
        })
      } catch (error) {
        console.error('Failed to create message revision:', error)
        messagesStore.updateMessage(result.messageId, {
          content: result.proposedContent,
          paragraphs: undefined,
        })
      }
    }

    massRewriteDialogStore.hide()
  }

  const handleClose = () => {
    if (!isProcessing()) {
      setPhase('selection')
      setResults([])
      setRewriteInstruction('')
      setFilterText('')
      massRewriteDialogStore.hide()
    }
  }

  const handleBackToSelection = () => {
    setPhase('selection')
    setResults([])
  }

  return (
    <Show when={massRewriteDialogStore.isOpen}>
      <Modal
        open={true}
        onClose={handleClose}
        title={
          phase() === 'selection'
            ? `Mass Rewrite: ${targetNode()?.title || 'Unknown'}`
            : phase() === 'processing'
              ? 'Processing Rewrites...'
              : 'Review Rewrites'
        }
        size="xl"
      >
        {/* Selection Phase */}
        <Show when={phase() === 'selection'}>
          <div style={{ padding: '1rem' }}>
            <div class={styles.threeColumnLayout}>
              {/* Left column: Messages in target node */}
              <div class={styles.column}>
                <div class={styles.columnHeader}>
                  <span>
                    Messages to Rewrite
                    <Show when={massRewriteDialogStore.selectedMessageIds.size > 0}>
                      <span class={styles.selectionInfo}>
                        {' '}
                        ({massRewriteDialogStore.selectedMessageIds.size}/{nodeMessages().length})
                      </span>
                    </Show>
                  </span>
                  <div class={styles.headerActions}>
                    <button class={styles.headerButton} onClick={handleSelectAll}>
                      All
                    </button>
                    <button class={styles.headerButton} onClick={handleSelectNone}>
                      None
                    </button>
                  </div>
                </div>

                <div class={styles.messageList}>
                  <Show
                    when={nodeMessages().length > 0}
                    fallback={<div class={styles.noMessages}>No messages in this node</div>}
                  >
                    <For each={nodeMessages()}>
                      {(msg, index) => {
                        const isSelected = () => massRewriteDialogStore.selectedMessageIds.has(msg.id)
                        const wordCount = () => msg.content.split(/\s+/).filter(Boolean).length

                        return (
                          <div
                            class={isSelected() ? styles.messageItemSelected : styles.messageItem}
                            onClick={() => massRewriteDialogStore.toggleMessageSelection(msg.id)}
                          >
                            <div class={styles.messageHeader}>
                              <input
                                type="checkbox"
                                class={styles.messageCheckbox}
                                checked={isSelected()}
                                onChange={() => massRewriteDialogStore.toggleMessageSelection(msg.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span class={styles.messageIndex}>#{index() + 1}</span>
                              <span class={styles.messageWordCount}>{wordCount()} words</span>
                            </div>
                            <div class={styles.messagePreview}>{msg.content}</div>
                          </div>
                        )
                      }}
                    </For>
                  </Show>
                </div>
              </div>

              {/* Middle column: Context scenes */}
              <div class={styles.column}>
                <div class={styles.columnHeader}>
                  Context Scenes
                  <Show when={massRewriteDialogStore.selectedContextSceneIds.size > 0}>
                    <span class={styles.selectionInfo}>
                      {' '}
                      ({massRewriteDialogStore.selectedContextSceneIds.size} selected)
                    </span>
                  </Show>
                </div>

                <input
                  type="text"
                  class={styles.searchInput}
                  placeholder="Filter scenes..."
                  value={filterText()}
                  onInput={(e) => setFilterText(e.currentTarget.value)}
                />

                <div class={styles.sceneList}>
                  <Show
                    when={filteredContextScenes().length > 0}
                    fallback={
                      <div class={styles.noScenes}>
                        {availableContextScenes().length === 0
                          ? 'No earlier scenes available'
                          : 'No scenes match your filter'}
                      </div>
                    }
                  >
                    <For each={filteredContextScenes()}>
                      {(scene) => {
                        const isSelected = () =>
                          massRewriteDialogStore.selectedContextSceneIds.has(scene.node.id)

                        return (
                          <div
                            class={isSelected() ? styles.sceneItemSelected : styles.sceneItem}
                            onClick={() => massRewriteDialogStore.toggleContextSceneSelection(scene.node.id)}
                          >
                            <div class={styles.sceneHeader}>
                              <input
                                type="checkbox"
                                class={styles.sceneCheckbox}
                                checked={isSelected()}
                                onChange={() =>
                                  massRewriteDialogStore.toggleContextSceneSelection(scene.node.id)
                                }
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div style={{ flex: 1 }}>
                                <div class={styles.sceneTitle}>{scene.node.title}</div>
                                <div class={styles.scenePath}>
                                  {scene.path} ({scene.wordCount} words)
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      }}
                    </For>
                  </Show>
                </div>
              </div>

              {/* Right column: Instructions */}
              <div class={styles.column}>
                <div class={styles.columnHeader}>Rewrite Instructions</div>

                <div class={styles.instructionArea}>
                  <Textarea
                    value={rewriteInstruction()}
                    onInput={(e) => setRewriteInstruction(e.currentTarget.value)}
                    placeholder='e.g., "Change character name from X to Y" or "Make the dialogue more formal"'
                    rows={6}
                  />
                </div>

                <Show
                  when={
                    massRewriteDialogStore.selectedMessageIds.size > 0 ||
                    massRewriteDialogStore.selectedContextSceneIds.size > 0
                  }
                >
                  <div class={styles.tokenBudget}>
                    <span>Estimated tokens per message:</span>
                    <span class={styles.tokenCount}>
                      ~{contextTokenEstimate() + Math.round(selectedMessagesTokens() / Math.max(1, massRewriteDialogStore.selectedMessageIds.size)) + 200}
                    </span>
                    <span style={{ width: '100%', 'font-size': '0.7rem' }}>
                      (context: {contextTokenEstimate()}, avg message:{' '}
                      {Math.round(selectedMessagesTokens() / Math.max(1, massRewriteDialogStore.selectedMessageIds.size))}, prompt: ~200)
                    </span>
                  </div>
                </Show>
              </div>
            </div>
          </div>

          <div class={styles.footer}>
            <div class={styles.selectionInfo}>
              {massRewriteDialogStore.selectedMessageIds.size} message(s) selected,{' '}
              {massRewriteDialogStore.selectedContextSceneIds.size} context scene(s)
            </div>
            <div class={styles.footerActions}>
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleStartRewrite}
                disabled={massRewriteDialogStore.selectedMessageIds.size === 0 || !rewriteInstruction()}
              >
                Rewrite {massRewriteDialogStore.selectedMessageIds.size} Message(s)
              </Button>
            </div>
          </div>
        </Show>

        {/* Processing Phase */}
        <Show when={phase() === 'processing'}>
          <div style={{ padding: '1rem' }}>
            <div class={styles.processingContainer}>
              <div class={styles.processingHeader}>
                <span class={styles.progressText}>
                  Processing message {currentProcessingIndex() + 1} of{' '}
                  {massRewriteDialogStore.selectedMessageIds.size}
                </span>
                <div class={styles.progressBar}>
                  <div
                    class={styles.progressFill}
                    style={{
                      width: `${((currentProcessingIndex() + 1) / massRewriteDialogStore.selectedMessageIds.size) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div class={styles.loadingContainer}>
                <Spinner size="md" />
                <span>Generating rewrite...</span>
              </div>
            </div>
          </div>
        </Show>

        {/* Review Phase */}
        <Show when={phase() === 'review'}>
          <div style={{ padding: '1rem' }}>
            <div class={styles.processingContainer}>
              <div class={styles.processingHeader}>
                <span class={styles.progressText}>
                  {resultStats().skipped > 0 && `${resultStats().skipped} skipped, `}
                  {resultStats().accepted} accepted, {resultStats().rejected} rejected
                  {resultStats().pending > 0 && `, ${resultStats().pending} pending`}
                </span>
                <div class={styles.headerActions}>
                  <For each={results()}>
                    {(result, index) => (
                      <button
                        class={styles.headerButton}
                        style={{
                          background:
                            result.status === 'accepted'
                              ? 'rgba(34, 197, 94, 0.3)'
                              : result.status === 'rejected'
                                ? 'rgba(239, 68, 68, 0.3)'
                                : result.status === 'skipped'
                                  ? 'rgba(156, 163, 175, 0.3)'
                                  : index() === currentReviewIndex()
                                    ? 'rgba(59, 130, 246, 0.3)'
                                    : undefined,
                        }}
                        onClick={() => handleNavigateResult(index())}
                        title={result.status === 'skipped' ? 'No changes needed' : undefined}
                      >
                        {result.status === 'skipped' ? '−' : index() + 1}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <Show when={currentResult()}>
                <div class={styles.diffContainer}>
                  <div class={styles.diffPane}>
                    <div class={styles.diffHeader}>Original (Message #{currentReviewIndex() + 1})</div>
                    <div class={styles.diffContent}>
                      <For each={computeDiff(currentResult()!.originalContent, currentResult()!.proposedContent)}>
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

                  <div class={styles.diffPane}>
                    <div class={styles.diffHeader}>Proposed</div>
                    <div class={styles.diffContent}>
                      <For each={computeDiff(currentResult()!.originalContent, currentResult()!.proposedContent)}>
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

                <Show when={currentResult()?.status === 'pending'}>
                  <div class={styles.previewActions}>
                    <Button variant="secondary" onClick={handleRejectCurrent}>
                      Reject
                    </Button>
                    <Button variant="primary" onClick={handleAcceptCurrent}>
                      Accept
                    </Button>
                  </div>
                </Show>

                <Show when={currentResult()?.status === 'skipped'}>
                  <div class={styles.previewActions}>
                    <span style={{ 'font-style': 'italic', color: 'var(--text-muted)' }}>
                      No changes needed for this message
                    </span>
                  </div>
                </Show>

                <Show when={currentResult()?.status === 'accepted' || currentResult()?.status === 'rejected'}>
                  <div class={styles.previewActions}>
                    <span style={{ 'font-style': 'italic', color: 'var(--text-muted)' }}>
                      This change was {currentResult()?.status}
                    </span>
                  </div>
                </Show>
              </Show>
            </div>
          </div>

          <div class={styles.footer}>
            <div class={styles.selectionInfo}>
              {resultStats().pending > 0
                ? `${resultStats().pending} remaining to review`
                : `Done: ${resultStats().accepted} accepted, ${resultStats().rejected} rejected${resultStats().skipped > 0 ? `, ${resultStats().skipped} skipped` : ''}`}
            </div>
            <div class={styles.footerActions}>
              <Button variant="secondary" onClick={handleBackToSelection}>
                Back
              </Button>
              <Show when={resultStats().pending === 0 && resultStats().accepted > 0}>
                <Button variant="primary" onClick={applyAcceptedChanges}>
                  Apply {resultStats().accepted} Change(s)
                </Button>
              </Show>
              <Show when={resultStats().pending === 0 && resultStats().accepted === 0}>
                <Button variant="secondary" onClick={handleClose}>
                  Close
                </Button>
              </Show>
            </div>
          </div>
        </Show>
      </Modal>
    </Show>
  )
}
