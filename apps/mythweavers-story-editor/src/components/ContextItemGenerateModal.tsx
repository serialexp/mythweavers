import { Button, Modal, Spinner } from '@mythweavers/ui'
import * as Diff from 'diff'
import { BsExclamationTriangle } from 'solid-icons/bs'
import { Component, For, Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import { contextItemsStore } from '../stores/contextItemsStore'
import { nodeStore } from '../stores/nodeStore'
import type { ContextItem } from '../types/core'
import { generateMessageId } from '../utils/id'
import { buildNodeMarkdown } from '../utils/nodeContentExport'
import {
  estimateContextItemTokens,
  generateContextItemDescription,
  type TokenEstimateResult,
} from '../utils/templateAI'
import * as styles from './ContextItemGenerateModal.css'

type ContextItemType = 'theme' | 'location' | 'plot'

interface ContextItemGenerateModalProps {
  isOpen: boolean
  onClose: () => void
  preselectedContextItemId?: string
}

export const ContextItemGenerateModal: Component<ContextItemGenerateModalProps> = (props) => {
  const [mode, setMode] = createSignal<'new' | 'update'>(props.preselectedContextItemId ? 'update' : 'new')
  const [selectedContextItemId, setSelectedContextItemId] = createSignal<string>(props.preselectedContextItemId || '')
  const [newName, setNewName] = createSignal('')
  const [newType, setNewType] = createSignal<ContextItemType>('location')
  const [instruction, setInstruction] = createSignal('')
  const [isGenerating, setIsGenerating] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [proposedDescription, setProposedDescription] = createSignal<string | null>(null)
  const [tokenEstimate, setTokenEstimate] = createSignal<TokenEstimateResult | null>(null)
  const [isEstimating, setIsEstimating] = createSignal(false)

  // Get nodes marked for full content (includeInFull === 2)
  const fullContentNodes = createMemo(() => {
    return nodeStore.nodesArray
      .filter((node) => node.includeInFull === 2)
      .sort((a, b) => a.order - b.order)
  })

  // Get nodes marked for summary (includeInFull === 1)
  const summaryNodes = createMemo(() => {
    return nodeStore.nodesArray
      .filter((node) => node.includeInFull === 1 && node.summary)
      .sort((a, b) => a.order - b.order)
  })

  // Check if we have any context nodes
  const hasContextNodes = createMemo(() => fullContentNodes().length > 0 || summaryNodes().length > 0)

  // Get selected context item (for update mode)
  const selectedContextItem = createMemo(() => {
    const id = selectedContextItemId()
    if (!id) return null
    return contextItemsStore.contextItems.find((c) => c.id === id) || null
  })

  // Get current name (either from selected item or new name)
  const currentName = createMemo(() => {
    if (mode() === 'update') {
      return selectedContextItem()?.name || ''
    }
    return newName()
  })

  // Get current type
  const currentType = createMemo((): ContextItemType => {
    if (mode() === 'update') {
      return selectedContextItem()?.type || 'location'
    }
    return newType()
  })

  // Build combined story content from context nodes
  const getStoryContent = () => {
    const fullNodes = fullContentNodes()
    const summNodes = summaryNodes()
    if (fullNodes.length === 0 && summNodes.length === 0) return undefined

    const sections: string[] = []

    // Add full content sections
    for (const node of fullNodes) {
      const markdown = buildNodeMarkdown(node.id)
      if (markdown) {
        sections.push(`## ${node.title}\n\n${markdown}`)
      }
    }

    // Add summary sections
    for (const node of summNodes) {
      if (node.summary) {
        sections.push(`## ${node.title} (Summary)\n\n${node.summary}`)
      }
    }

    return sections.length > 0 ? sections.join('\n\n---\n\n') : undefined
  }

  // Compute diff between current and proposed description (for update mode)
  const diffResult = createMemo(() => {
    if (mode() !== 'update') return null
    const current = selectedContextItem()?.description || ''
    const proposed = proposedDescription()
    if (!proposed) return null

    return Diff.diffLines(current, proposed)
  })

  // Estimate tokens when content or name changes
  createEffect(
    on(
      () => [currentName(), currentType(), fullContentNodes(), summaryNodes(), props.isOpen, hasContextNodes()] as const,
      async ([name, type, _fullNodes, _summNodes, isOpen, hasNodes]) => {
        if (!isOpen || !name || !hasNodes) {
          setTokenEstimate(null)
          return
        }

        setIsEstimating(true)
        try {
          const storyContent = getStoryContent()
          if (!storyContent) {
            setTokenEstimate(null)
            return
          }

          const existingDescription = mode() === 'update' ? selectedContextItem()?.description : undefined

          const estimate = await estimateContextItemTokens(
            type,
            name,
            'placeholder instruction',
            storyContent,
            existingDescription,
          )
          setTokenEstimate(estimate)
        } catch (err) {
          console.warn('Failed to estimate tokens:', err)
          setTokenEstimate(null)
        } finally {
          setIsEstimating(false)
        }
      },
    ),
  )

  const handleGenerate = async () => {
    const name = currentName()
    const type = currentType()
    if (!name || !instruction().trim()) return

    const storyContent = getStoryContent()
    if (!storyContent) {
      setError('No story content available. Mark nodes for context first.')
      return
    }

    setIsGenerating(true)
    setError(null)
    setProposedDescription(null)

    try {
      const existingDescription = mode() === 'update' ? selectedContextItem()?.description : undefined

      const newDescription = await generateContextItemDescription(
        type,
        name,
        instruction(),
        storyContent,
        existingDescription,
      )

      setProposedDescription(newDescription)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate description')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAccept = () => {
    const proposed = proposedDescription()
    if (!proposed) return

    if (mode() === 'update') {
      const item = selectedContextItem()
      if (!item) return
      contextItemsStore.updateContextItem(item.id, { description: proposed })
    } else {
      // Create new context item
      const newItem: ContextItem = {
        id: generateMessageId(),
        name: newName(),
        description: proposed,
        type: newType(),
        isGlobal: false,
      }
      contextItemsStore.addContextItem(newItem)
    }
    handleClose()
  }

  const handleClose = () => {
    setMode(props.preselectedContextItemId ? 'update' : 'new')
    setSelectedContextItemId(props.preselectedContextItemId || '')
    setNewName('')
    setNewType('location')
    setInstruction('')
    setError(null)
    setProposedDescription(null)
    props.onClose()
  }

  const handleReset = () => {
    setProposedDescription(null)
    setError(null)
  }

  const canGenerate = createMemo(() => {
    const name = currentName()
    const instructionText = instruction().trim()
    const hasContent = hasContextNodes()
    const fitsInContext = tokenEstimate() === null || tokenEstimate()!.fitsInContext

    return name && instructionText && hasContent && fitsInContext && !isGenerating()
  })

  return (
    <Modal
      open={props.isOpen}
      onClose={handleClose}
      title={mode() === 'update' ? 'Update Context Item from Story' : 'Generate Context Item from Story'}
      size="lg"
      footer={
        <div class={styles.actions}>
          <Show when={!proposedDescription()}>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={!canGenerate()}>
              <Show when={isGenerating()} fallback="Generate">
                <Spinner size="sm" /> Generating...
              </Show>
            </Button>
          </Show>
          <Show when={proposedDescription()}>
            <Button variant="secondary" onClick={handleReset}>
              Try Again
            </Button>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleAccept}>
              {mode() === 'update' ? 'Accept Changes' : 'Create Context Item'}
            </Button>
          </Show>
        </div>
      }
    >
      <div class={styles.modalContent}>
        {/* Mode Toggle */}
        <Show when={!proposedDescription()}>
          <div class={styles.modeToggle}>
            <button
              type="button"
              class={`${styles.modeButton} ${mode() === 'new' ? styles.modeButtonActive : ''}`}
              onClick={() => setMode('new')}
              disabled={isGenerating()}
            >
              Create New
            </button>
            <button
              type="button"
              class={`${styles.modeButton} ${mode() === 'update' ? styles.modeButtonActive : ''}`}
              onClick={() => setMode('update')}
              disabled={isGenerating() || contextItemsStore.contextItems.length === 0}
            >
              Update Existing
            </button>
          </div>
        </Show>

        {/* Context Nodes Display */}
        <Show when={hasContextNodes()}>
          <div class={styles.contextNodesInfo}>
            <Show when={fullContentNodes().length > 0}>
              <span class={styles.contextLabel}>Full:</span>
              <span class={styles.nodeList}>{fullContentNodes().map((n) => n.title).join(', ')}</span>
            </Show>
            <Show when={fullContentNodes().length > 0 && summaryNodes().length > 0}>
              <span class={styles.contextLabel}>&nbsp;|&nbsp;</span>
            </Show>
            <Show when={summaryNodes().length > 0}>
              <span class={styles.contextLabel}>Summary:</span>
              <span class={styles.nodeList}>{summaryNodes().map((n) => n.title).join(', ')}</span>
            </Show>
          </div>
        </Show>

        <Show when={!hasContextNodes()}>
          <div class={styles.noContextWarning}>
            <BsExclamationTriangle />
            <span>No nodes marked for context. Mark nodes with the circle icons to use as source content.</span>
          </div>
        </Show>

        {/* Token Estimate Display */}
        <Show when={tokenEstimate() && currentName()}>
          {(() => {
            const est = tokenEstimate()!
            const statusClass = !est.fitsInContext
              ? styles.tokenEstimateError
              : est.percentUsed > 80
                ? styles.tokenEstimateWarning
                : ''
            return (
              <div class={`${styles.tokenEstimate} ${statusClass}`}>
                <Show when={isEstimating()}>
                  <Spinner size="sm" />
                </Show>
                <span>
                  {est.estimate.isExact ? '' : '~'}
                  {est.estimate.tokens.toLocaleString()} tokens ({est.percentUsed}% of context)
                </span>
                <Show when={!est.fitsInContext}>
                  <span>- exceeds context limit!</span>
                </Show>
              </div>
            )
          })()}
        </Show>

        {/* New Item Form */}
        <Show when={mode() === 'new' && !proposedDescription()}>
          <div class={styles.formSection}>
            <label class={styles.label}>Context Item Name</label>
            <input
              type="text"
              class={styles.input}
              value={newName()}
              onInput={(e) => setNewName(e.currentTarget.value)}
              placeholder="e.g., 'The Capital City', 'Political Tensions', 'The Heist'"
              disabled={isGenerating()}
            />
          </div>

          <div class={styles.formSection}>
            <label class={styles.label}>Type</label>
            <div class={styles.typeSelector}>
              <label class={styles.typeLabel}>
                <input
                  type="radio"
                  name="new-type"
                  checked={newType() === 'location'}
                  onChange={() => setNewType('location')}
                  disabled={isGenerating()}
                />
                Location
              </label>
              <label class={styles.typeLabel}>
                <input
                  type="radio"
                  name="new-type"
                  checked={newType() === 'theme'}
                  onChange={() => setNewType('theme')}
                  disabled={isGenerating()}
                />
                Theme
              </label>
              <label class={styles.typeLabel}>
                <input
                  type="radio"
                  name="new-type"
                  checked={newType() === 'plot'}
                  onChange={() => setNewType('plot')}
                  disabled={isGenerating()}
                />
                Plot
              </label>
            </div>
          </div>
        </Show>

        {/* Update Item Selection */}
        <Show when={mode() === 'update' && !proposedDescription()}>
          <div class={styles.formSection}>
            <label class={styles.label}>Context Item to Update</label>
            <select
              class={styles.select}
              value={selectedContextItemId()}
              onChange={(e) => setSelectedContextItemId(e.currentTarget.value)}
              disabled={isGenerating()}
            >
              <option value="">Select a context item...</option>
              <For each={contextItemsStore.contextItems}>
                {(item) => (
                  <option value={item.id}>
                    {item.name} ({item.type})
                  </option>
                )}
              </For>
            </select>
          </div>
        </Show>

        {/* Instruction Input */}
        <Show when={!proposedDescription()}>
          <div class={styles.formSection}>
            <label class={styles.label}>
              {mode() === 'update' ? 'Update Instructions' : 'Generation Instructions'}
            </label>
            <textarea
              class={styles.textarea}
              value={instruction()}
              onInput={(e) => setInstruction(e.currentTarget.value)}
              placeholder={
                mode() === 'update'
                  ? "e.g., 'Add details from the recent events' or 'Update with the new political situation'"
                  : "e.g., 'Summarize everything about this city' or 'Capture the key events and current state'"
              }
              disabled={isGenerating()}
            />
          </div>
        </Show>

        {/* Error Display */}
        <Show when={error()}>
          <div class={styles.noContextWarning}>
            <BsExclamationTriangle />
            <span>{error()}</span>
          </div>
        </Show>

        {/* Loading State */}
        <Show when={isGenerating()}>
          <div class={styles.loadingContainer}>
            <Spinner size="md" />
            <span>Generating context item description...</span>
          </div>
        </Show>

        {/* Preview for new item */}
        <Show when={proposedDescription() && mode() === 'new'}>
          <div class={styles.previewContainer}>
            <div class={styles.diffHeader}>Generated Description</div>
            <div class={styles.previewContent}>{proposedDescription()}</div>
          </div>
        </Show>

        {/* Diff Preview for update */}
        <Show when={proposedDescription() && mode() === 'update' && diffResult()}>
          <div class={styles.diffContainer}>
            {/* Current Description */}
            <div class={styles.diffPane}>
              <div class={styles.diffHeader}>Current Description</div>
              <div class={styles.diffContent}>
                <For each={diffResult()!}>
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

            {/* Proposed Description */}
            <div class={styles.diffPane}>
              <div class={styles.diffHeader}>Proposed Description</div>
              <div class={styles.diffContent}>
                <For each={diffResult()!}>
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
    </Modal>
  )
}
