import { Button, Modal, Spinner, Textarea } from '@mythweavers/ui'
import * as Diff from 'diff'
import { BsChevronDown, BsChevronRight } from 'solid-icons/bs'
import { For, Show, createMemo, createSignal } from 'solid-js'
import { messagesStore } from '../stores/messagesStore'
import { modelsStore } from '../stores/modelsStore'
import { nodeStore } from '../stores/nodeStore'
import { settingsStore } from '../stores/settingsStore'
import { singleRewriteDialogStore } from '../stores/singleRewriteDialogStore'
import type { Node } from '../types/core'
import { LLMClientFactory, type LLMMessage } from '../utils/llm'
import * as styles from './SingleRewriteDialog.css'

interface RewriteResult {
  originalContent: string
  proposedContent: string
}

interface SceneWithContent {
  node: Node
  path: string // e.g., "Book 1 > Arc 1 > Chapter 1"
  content: string
  wordCount: number
}

export function SingleRewriteDialog() {
  const [rewriteInstruction, setRewriteInstruction] = createSignal('')
  const [filterText, setFilterText] = createSignal('')
  const [expandedSceneIds, setExpandedSceneIds] = createSignal<Set<string>>(new Set())
  const [isRewriting, setIsRewriting] = createSignal(false)
  const [rewriteResult, setRewriteResult] = createSignal<RewriteResult | null>(null)

  // Check if we have a result to show (preview phase)
  const hasResult = () => rewriteResult() !== null

  // Compute diff between original and proposed content
  const computeDiff = (original: string, proposed: string) => {
    return Diff.diffLines(original, proposed)
  }

  // Get the message being rewritten
  const targetMessage = createMemo(() => {
    const msgId = singleRewriteDialogStore.messageId
    if (!msgId) return null
    return messagesStore.messages.find((m) => m.id === msgId) || null
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

  // Get all nodes (chapters or scenes) that appear before the target message's node and have content
  const availableScenes = createMemo((): SceneWithContent[] => {
    const msg = targetMessage()
    if (!msg || !msg.sceneId) return []

    const targetNode = nodeStore.getNode(msg.sceneId)
    if (!targetNode) return []

    // Collect all nodes (chapters and scenes) in tree order that come before the target
    const precedingNodes: Node[] = []

    const collectNodes = (treeNodes: typeof nodeStore.tree): boolean => {
      for (const treeNode of treeNodes) {
        if (treeNode.id === msg.sceneId) {
          // Found target, stop collecting
          return true
        }

        const node = nodeStore.getNode(treeNode.id)
        // Collect chapters and scenes (nodes that can contain messages)
        if (node && (node.type === 'chapter' || node.type === 'scene')) {
          precedingNodes.push(node)
        }

        // Recursively check children
        if (treeNode.children.length > 0) {
          const found = collectNodes(treeNode.children)
          if (found) return true
        }
      }
      return false
    }

    collectNodes(nodeStore.tree)

    // Build node data with content, filtering to only those that have messages
    return precedingNodes
      .map((node) => {
        // Get all messages in this node
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
      .filter((item) => item.wordCount > 0) // Only show nodes that have content
  })

  // Filter scenes by search text
  const filteredScenes = createMemo(() => {
    const filter = filterText().toLowerCase()
    if (!filter) return availableScenes()

    return availableScenes().filter(
      (scene) =>
        scene.node.title.toLowerCase().includes(filter) ||
        scene.path.toLowerCase().includes(filter) ||
        scene.content.toLowerCase().includes(filter),
    )
  })

  // Calculate approximate token count for context
  const contextTokenEstimate = createMemo(() => {
    const selectedIds = singleRewriteDialogStore.selectedSceneIds
    let totalWords = 0

    for (const sceneId of selectedIds) {
      const scene = availableScenes().find((s) => s.node.id === sceneId)
      if (scene) {
        totalWords += scene.wordCount
      }
    }

    // Rough estimate: ~0.75 tokens per word for English text
    return Math.round(totalWords * 0.75)
  })

  // Calculate tokens for the target message
  const targetMessageTokens = createMemo(() => {
    const msg = targetMessage()
    if (!msg) return 0
    const wordCount = msg.content.split(/\s+/).filter(Boolean).length
    return Math.round(wordCount * 0.75)
  })

  const toggleSceneExpanded = (sceneId: string) => {
    setExpandedSceneIds((current) => {
      const next = new Set(current)
      if (next.has(sceneId)) {
        next.delete(sceneId)
      } else {
        next.add(sceneId)
      }
      return next
    })
  }

  const handleRewrite = async () => {
    const msg = targetMessage()
    if (!msg || !rewriteInstruction()) {
      alert('Please provide rewrite instructions')
      return
    }

    setIsRewriting(true)

    try {
      const modelInfo = modelsStore.availableModels.find((m) => m.name === settingsStore.model)
      const client = LLMClientFactory.getClient(settingsStore.provider)

      // Build context from selected scenes
      const selectedIds = singleRewriteDialogStore.selectedSceneIds
      const contextParts: string[] = []

      for (const sceneId of selectedIds) {
        const scene = availableScenes().find((s) => s.node.id === sceneId)
        if (scene && scene.content) {
          contextParts.push(`=== ${scene.node.title} (${scene.path}) ===\n${scene.content}`)
        }
      }

      const contextSection =
        contextParts.length > 0
          ? `For reference, here is relevant earlier story content that you should keep in mind:\n\n${contextParts.join('\n\n')}\n\n---\n\n`
          : ''

      const prompt = `${contextSection}Rewrite the following text according to these instructions: "${rewriteInstruction()}"

Important guidelines:
- You may rewrite larger sections around the specific change to ensure smooth narrative flow
- Make sure transitions between sentences and paragraphs remain natural
- If changing a specific detail, adjust surrounding context as needed so everything makes sense
- Preserve the overall story, tone, style, and narrative perspective
- Maintain approximately the same length overall
- Ensure the rewritten section reads as a cohesive whole, not as if a single sentence was copy-pasted
${contextParts.length > 0 ? '- Keep the rewrite consistent with the earlier story content provided above' : ''}

The goal is to make the requested change while ensuring the entire passage flows naturally and coherently.

Original text:
${msg.content}

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
        metadata: { callType: 'rewrite:single' },
      })

      let rewrittenContent = ''
      for await (const part of response) {
        if (part.response) {
          rewrittenContent += part.response
        }
      }

      const trimmedContent = rewrittenContent.trim()

      // Store the result for preview instead of applying directly
      setRewriteResult({
        originalContent: msg.content,
        proposedContent: trimmedContent,
      })
    } catch (error) {
      console.error('Error rewriting message:', error)
      alert(`Error rewriting message: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsRewriting(false)
    }
  }

  const handleAccept = async () => {
    const msg = targetMessage()
    const result = rewriteResult()
    if (!msg || !result) return

    // Create a new revision with the rewritten content
    const { saveService } = await import('../services/saveService')
    try {
      const { revisionId } = await saveService.createMessageRevision(msg.id, result.proposedContent)
      // Update local state with new content and revision ID
      // Clear paragraphs to force editor to re-parse from new content
      messagesStore.updateMessage(msg.id, {
        content: result.proposedContent,
        currentMessageRevisionId: revisionId,
        paragraphs: undefined,
      })
    } catch (error) {
      console.error('Failed to create message revision:', error)
      // Fall back to just updating local state
      messagesStore.updateMessage(msg.id, { content: result.proposedContent, paragraphs: undefined })
    }

    singleRewriteDialogStore.hide()
  }

  const handleReject = () => {
    setRewriteResult(null)
  }

  const handleClose = () => {
    if (!isRewriting()) {
      setRewriteResult(null)
      singleRewriteDialogStore.hide()
    }
  }

  return (
    <Show when={singleRewriteDialogStore.isOpen}>
      <Modal
        open={true}
        onClose={handleClose}
        title={hasResult() ? 'Review Rewrite' : 'Rewrite with Context'}
        size="xl"
      >
        {/* Preview Phase - Show diff with Accept/Reject */}
        <Show when={hasResult()}>
          <div style={{ padding: '1rem' }}>
            <div class={styles.previewContainer}>
              <div class={styles.diffContainer}>
                {/* Original Content */}
                <div class={styles.diffPane}>
                  <div class={styles.diffHeader}>Original</div>
                  <div class={styles.diffContent}>
                    <For each={computeDiff(rewriteResult()!.originalContent, rewriteResult()!.proposedContent)}>
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
                    <For each={computeDiff(rewriteResult()!.originalContent, rewriteResult()!.proposedContent)}>
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
            </div>
          </div>

          <div class={styles.footer}>
            <div class={styles.selectionInfo}>
              Review the proposed changes before accepting
            </div>
            <div class={styles.footerActions}>
              <Button variant="secondary" onClick={handleReject}>
                Reject
              </Button>
              <Button variant="primary" onClick={handleAccept}>
                Accept
              </Button>
            </div>
          </div>
        </Show>

        {/* Input Phase - Select context and enter instructions */}
        <Show when={!hasResult()}>
          <div style={{ padding: '1rem' }}>
            <Show when={isRewriting()}>
              <div class={styles.loadingContainer}>
                <Spinner size="md" />
                <span>Generating rewrite...</span>
              </div>
            </Show>

            <Show when={!isRewriting()}>
              <div class={styles.twoColumnLayout}>
                {/* Left column: Scene selection */}
                <div class={styles.column}>
                  <div class={styles.columnHeader}>
                    Context Scenes
                    <Show when={singleRewriteDialogStore.selectedSceneIds.size > 0}>
                      <span class={styles.selectionInfo}>
                        {' '}
                        ({singleRewriteDialogStore.selectedSceneIds.size} selected)
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
                      when={filteredScenes().length > 0}
                      fallback={
                        <div class={styles.noScenes}>
                          {availableScenes().length === 0
                            ? 'No earlier scenes available'
                            : 'No scenes match your filter'}
                        </div>
                      }
                    >
                      <For each={filteredScenes()}>
                        {(scene) => {
                          const isSelected = () => singleRewriteDialogStore.selectedSceneIds.has(scene.node.id)
                          const isExpanded = () => expandedSceneIds().has(scene.node.id)

                          return (
                            <div class={isSelected() ? styles.sceneItemSelected : styles.sceneItem}>
                              <div class={styles.sceneHeader}>
                                <input
                                  type="checkbox"
                                  class={styles.sceneCheckbox}
                                  checked={isSelected()}
                                  onChange={() => singleRewriteDialogStore.toggleSceneSelection(scene.node.id)}
                                />
                                <div
                                  style={{ flex: 1, cursor: 'pointer' }}
                                  onClick={() => singleRewriteDialogStore.toggleSceneSelection(scene.node.id)}
                                >
                                  <div class={styles.sceneTitle}>{scene.node.title}</div>
                                  <div class={styles.scenePath}>
                                    {scene.path} ({scene.wordCount} words)
                                  </div>
                                </div>
                                <button
                                  class={styles.expandButton}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleSceneExpanded(scene.node.id)
                                  }}
                                  title={isExpanded() ? 'Collapse' : 'Expand to see content'}
                                >
                                  {isExpanded() ? <BsChevronDown /> : <BsChevronRight />}
                                </button>
                              </div>

                              <Show when={isExpanded()}>
                                <div class={styles.sceneContent}>
                                  {scene.content || <em>No content</em>}
                                </div>
                              </Show>
                            </div>
                          )
                        }}
                      </For>
                    </Show>
                  </div>
                </div>

                {/* Right column: Message and instruction */}
                <div class={styles.column}>
                  <div class={styles.columnHeader}>Rewrite Message</div>

                  <div class={styles.instructionArea}>
                    <label class={styles.label}>Rewrite Instructions</label>
                    <Textarea
                      value={rewriteInstruction()}
                      onInput={(e) => setRewriteInstruction(e.currentTarget.value)}
                      placeholder='e.g., "Make this character remember meeting Ahsoka in the earlier scene"'
                      rows={3}
                    />
                  </div>

                  <label class={styles.label}>Original Message</label>
                  <div class={styles.messagePreview}>
                    {targetMessage()?.content || 'No message selected'}
                  </div>

                  <Show when={singleRewriteDialogStore.selectedSceneIds.size > 0 || targetMessage()}>
                    <div class={styles.tokenBudget}>
                      <span>Estimated tokens:</span>
                      <span class={styles.tokenCount}>
                        ~{contextTokenEstimate() + targetMessageTokens() + 200} total
                      </span>
                      <span>
                        (context: {contextTokenEstimate()}, message: {targetMessageTokens()}, prompt: ~200)
                      </span>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>
          </div>

          <div class={styles.footer}>
            <div class={styles.selectionInfo}>
              {singleRewriteDialogStore.selectedSceneIds.size} scene(s) selected for context
            </div>
            <div class={styles.footerActions}>
              <Button variant="secondary" onClick={handleClose} disabled={isRewriting()}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRewrite}
                disabled={isRewriting() || !rewriteInstruction()}
              >
                {isRewriting() ? (
                  <>
                    <Spinner size="sm" /> Rewriting...
                  </>
                ) : (
                  'Rewrite'
                )}
              </Button>
            </div>
          </div>
        </Show>
      </Modal>
    </Show>
  )
}
