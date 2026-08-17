import { Button, Modal, Spinner, Textarea } from '@mythweavers/ui'
import * as Diff from 'diff'
import { For, Show, createMemo, createSignal } from 'solid-js'
import { messagesStore } from '../stores/messagesStore'
import { modelsStore } from '../stores/modelsStore'
import { nodeStore } from '../stores/nodeStore'
import { singleRewriteDialogStore } from '../stores/singleRewriteDialogStore'
import type { Node } from '../types/core'
import { LLMClientFactory } from '../utils/llm'
import { generateReplacementRewrite } from '../utils/llm/replacementRewriter'
import { resolveModel } from '../utils/llm/resolveModel'
import * as styles from './SingleRewriteDialog.css'
import { PhCaretDownIcon, PhCaretRightIcon } from 'solidjs-phosphor'

interface RewriteResult {
  originalContent: string
  proposedContent: string
  failures: string[]
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
  const [activeTab, setActiveTab] = createSignal<'instructions' | 'context'>('instructions')

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
      const resolved = resolveModel('rewrite:single')
      const modelInfo = modelsStore.availableModels.find((m) => m.name === resolved.model)
      const client = LLMClientFactory.getClient(resolved.provider)

      // Build context from selected scenes
      const selectedIds = singleRewriteDialogStore.selectedSceneIds
      const contextParts: string[] = []

      for (const sceneId of selectedIds) {
        const scene = availableScenes().find((s) => s.node.id === sceneId)
        if (scene?.content) {
          contextParts.push(`=== ${scene.node.title} (${scene.path}) ===\n${scene.content}`)
        }
      }

      const contextSection =
        contextParts.length > 0
          ? `For reference, here is relevant earlier story content that you should keep in mind:\n\n${contextParts.join('\n\n')}\n\n---\n\n`
          : ''

      const replacementResult = await generateReplacementRewrite({
        client,
        model: resolved.model,
        messages: [{ id: msg.id, content: msg.content }],
        instruction: rewriteInstruction(),
        contextSection,
        providerOptions: resolved.provider === 'ollama' ? { num_ctx: modelInfo?.context_length || 4096 } : undefined,
        metadata: { callType: 'rewrite:single' },
      })

      if (replacementResult.appliedCount === 0 && replacementResult.failures.length === 0) {
        alert('The AI determined no changes were needed for this content.')
        return
      }

      setRewriteResult({
        originalContent: msg.content,
        proposedContent: replacementResult.messages.get(msg.id)!,
        failures: replacementResult.failures,
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
      const { revisionId, paragraphs } = await saveService.createMessageRevision(msg.id, result.proposedContent)
      // Update local state with new content, revision ID, and paragraphs
      messagesStore.updateMessage(msg.id, {
        content: result.proposedContent,
        currentMessageRevisionId: revisionId,
        paragraphs,
      })
      messagesStore.bumpContentVersion(msg.id)
    } catch (error) {
      console.error('Failed to create message revision:', error)
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
        footer={
          <div
            style={{
              width: '100%',
              display: 'flex',
              'justify-content': 'space-between',
              'align-items': 'center',
              gap: '0.5rem',
            }}
          >
            <Show
              when={hasResult()}
              fallback={
                <>
                  <div class={styles.selectionInfo}>
                    {singleRewriteDialogStore.selectedSceneIds.size} scene(s) selected for context
                  </div>
                  <div class={styles.footerActions}>
                    <Button variant="secondary" onClick={handleClose} disabled={isRewriting()}>
                      Cancel
                    </Button>
                    <Button variant="primary" onClick={handleRewrite} disabled={isRewriting() || !rewriteInstruction()}>
                      {isRewriting() ? (
                        <>
                          <Spinner size="sm" /> Rewriting...
                        </>
                      ) : (
                        'Rewrite'
                      )}
                    </Button>
                  </div>
                </>
              }
            >
              <div class={styles.selectionInfo}>Review the proposed changes before accepting</div>
              <div class={styles.footerActions}>
                <Button variant="secondary" onClick={handleReject}>
                  Reject
                </Button>
                <Button variant="primary" onClick={handleAccept}>
                  Accept
                </Button>
              </div>
            </Show>
          </div>
        }
      >
        {/* Preview Phase - Show diff with Accept/Reject */}
        <Show when={hasResult()}>
          <div class={styles.phaseWrapper}>
            <Show when={rewriteResult()!.failures.length > 0}>
              <div role="alert" class={styles.tokenBudget}>
                <strong>Some replacements could not be applied</strong>
                <ul>
                  <For each={rewriteResult()!.failures}>{(failure) => <li>{failure}</li>}</For>
                </ul>
                <span>Review the valid changes below before accepting them.</span>
              </div>
            </Show>
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
        </Show>

        {/* Input Phase - Select context and enter instructions */}
        <Show when={!hasResult()}>
          <div class={styles.phaseWrapper}>
            <Show when={isRewriting()}>
              <div class={styles.loadingContainer}>
                <Spinner size="md" />
                <span>Generating rewrite...</span>
              </div>
            </Show>

            <Show when={!isRewriting()}>
              <div class={styles.tabBar} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab() === 'instructions'}
                  class={activeTab() === 'instructions' ? styles.tabButtonActive : styles.tabButton}
                  onClick={() => setActiveTab('instructions')}
                >
                  Instructions
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab() === 'context'}
                  class={activeTab() === 'context' ? styles.tabButtonActive : styles.tabButton}
                  onClick={() => setActiveTab('context')}
                >
                  Context Scenes
                  <Show when={singleRewriteDialogStore.selectedSceneIds.size > 0}>
                    {' '}
                    ({singleRewriteDialogStore.selectedSceneIds.size})
                  </Show>
                </button>
              </div>
              <div class={styles.twoColumnLayout} data-active-tab={activeTab()}>
                {/* Left column: Scene selection */}
                <div class={`${styles.column} ${styles.columnContext}`}>
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
                                  {isExpanded() ? <PhCaretDownIcon /> : <PhCaretRightIcon />}
                                </button>
                              </div>

                              <Show when={isExpanded()}>
                                <div class={styles.sceneContent}>{scene.content || <em>No content</em>}</div>
                              </Show>
                            </div>
                          )
                        }}
                      </For>
                    </Show>
                  </div>
                </div>

                {/* Right column: Message and instruction */}
                <div class={`${styles.column} ${styles.columnInstructions}`}>
                  <div class={styles.columnHeader}>Rewrite Message</div>

                  <div class={styles.instructionArea}>
                    <label class={styles.label}>Rewrite Instructions</label>
                    <Textarea
                      value={rewriteInstruction()}
                      onInput={(e) => setRewriteInstruction(e.currentTarget.value)}
                      placeholder='e.g., "Make this character remember meeting Ahsoka in the earlier scene"'
                      rows={6}
                    />
                  </div>

                  <label class={styles.label}>Original Message</label>
                  <div class={styles.messagePreview}>{targetMessage()?.content || 'No message selected'}</div>

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
        </Show>
      </Modal>
    </Show>
  )
}
