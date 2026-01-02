import { Button, Modal, Spinner } from '@mythweavers/ui'
import { BsBook, BsExclamationTriangle, BsFileEarmarkText } from 'solid-icons/bs'
import { Component, For, Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import { nodeStore } from '../stores/nodeStore'
import { generateSceneSplit, type ProposedStructure } from '../utils/llm/splitScene'
import {
  aggregateNodeContent,
  applyProposedStructure,
  getNodeContentStats,
  validateProposedStructure,
} from '../utils/sceneSplitUtils'
import { estimateTokensFromText } from '../utils/templateAI'
import * as styles from './SplitSceneModal.css'

interface SplitSceneModalProps {
  isOpen: boolean
  onClose: () => void
  targetNodeId: string | null
}

export const SplitSceneModal: Component<SplitSceneModalProps> = (props) => {
  const [step, setStep] = createSignal<'configure' | 'generating' | 'preview'>('configure')
  const [error, setError] = createSignal<string | null>(null)
  const [proposedStructure, setProposedStructure] = createSignal<ProposedStructure | null>(null)
  const [generationProgress, setGenerationProgress] = createSignal('')
  const [isApplying, setIsApplying] = createSignal(false)

  // Get the target node
  const targetNode = createMemo(() => {
    const nodeId = props.targetNodeId
    if (!nodeId) return null
    return nodeStore.getNode(nodeId)
  })

  // Get content stats
  const contentStats = createMemo(() => {
    const nodeId = props.targetNodeId
    if (!nodeId) return null
    try {
      return getNodeContentStats(nodeId)
    } catch {
      return null
    }
  })

  // Estimate token count
  const tokenEstimate = createMemo(() => {
    const nodeId = props.targetNodeId
    if (!nodeId) return null
    try {
      const { messages } = aggregateNodeContent(nodeId)
      const content = messages.map((m) => m.content).join('\n\n')
      return estimateTokensFromText(content)
    } catch {
      return null
    }
  })

  // Reset state when modal opens
  createEffect(
    on(
      () => props.isOpen,
      (isOpen) => {
        if (isOpen) {
          setStep('configure')
          setError(null)
          setProposedStructure(null)
          setGenerationProgress('')
          setIsApplying(false)
        }
      },
    ),
  )

  const handleGenerate = async () => {
    const nodeId = props.targetNodeId
    if (!nodeId) return

    setError(null)
    setStep('generating')
    setGenerationProgress('')

    try {
      const { messages, context } = aggregateNodeContent(nodeId)

      const result = await generateSceneSplit(messages, context, {
        onProgress: (text) => {
          // Show a snippet of the progress
          const preview = text.length > 100 ? '...' + text.slice(-100) : text
          setGenerationProgress(preview)
        },
      })

      // Validate the result
      const validation = validateProposedStructure(result, messages)
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid structure returned by AI')
      }

      setProposedStructure(result)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate split structure')
      setStep('configure')
    }
  }

  const handleAccept = async () => {
    const nodeId = props.targetNodeId
    const structure = proposedStructure()
    if (!nodeId || !structure) return

    setIsApplying(true)
    setError(null)

    try {
      await applyProposedStructure(nodeId, structure)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply split structure')
      setIsApplying(false)
    }
  }

  const handleReset = () => {
    setStep('configure')
    setError(null)
    setProposedStructure(null)
    setGenerationProgress('')
  }

  const handleClose = () => {
    setStep('configure')
    setError(null)
    setProposedStructure(null)
    setGenerationProgress('')
    setIsApplying(false)
    props.onClose()
  }

  // Count total chapters and scenes in proposed structure
  const structureSummary = createMemo(() => {
    const structure = proposedStructure()
    if (!structure) return null

    let chapterCount = 0
    let sceneCount = 0
    for (const chapter of structure.structure) {
      chapterCount++
      sceneCount += chapter.scenes.length
    }
    return { chapterCount, sceneCount }
  })

  return (
    <Modal
      open={props.isOpen}
      onClose={handleClose}
      title="Split into Chapters/Scenes"
      size="lg"
      footer={
        <div class={styles.actions}>
          <Show when={step() === 'configure'}>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!contentStats() || contentStats()!.messageCount === 0}
            >
              Generate Split
            </Button>
          </Show>
          <Show when={step() === 'generating'}>
            <Button variant="secondary" disabled>
              <Spinner size="sm" /> Generating...
            </Button>
          </Show>
          <Show when={step() === 'preview'}>
            <Button variant="secondary" onClick={handleReset} disabled={isApplying()}>
              Start Over
            </Button>
            <Button variant="secondary" onClick={handleClose} disabled={isApplying()}>
              Cancel
            </Button>
            <Button onClick={handleAccept} disabled={isApplying()}>
              <Show when={isApplying()} fallback="Accept Split">
                <Spinner size="sm" /> Applying...
              </Show>
            </Button>
          </Show>
        </div>
      }
    >
      <div class={styles.modalContent}>
        {/* Error Display */}
        <Show when={error()}>
          <div class={styles.errorBox}>
            <BsExclamationTriangle />
            <span>{error()}</span>
          </div>
        </Show>

        {/* Configure Step */}
        <Show when={step() === 'configure'}>
          {/* Source Info */}
          <Show when={targetNode() && contentStats()}>
            <div class={styles.sourceInfo}>
              <span class={styles.sourceInfoLabel}>Scene:</span>
              <span class={styles.sourceInfoValue}>{targetNode()?.title || 'Untitled'}</span>
              <span class={styles.sourceInfoLabel}>|</span>
              <span class={styles.sourceInfoLabel}>Messages:</span>
              <span class={styles.sourceInfoValue}>{contentStats()!.messageCount}</span>
              <span class={styles.sourceInfoLabel}>|</span>
              <span class={styles.sourceInfoLabel}>Words:</span>
              <span class={styles.sourceInfoValue}>{contentStats()!.wordCount.toLocaleString()}</span>
            </div>
          </Show>

          {/* Token Estimate */}
          <Show when={tokenEstimate()}>
            <div class={styles.tokenEstimate}>
              <span>~{tokenEstimate()!.toLocaleString()} tokens</span>
            </div>
          </Show>

          {/* Warning for single message */}
          <Show when={contentStats() && contentStats()!.messageCount === 1}>
            <div class={styles.warningBox}>
              <BsExclamationTriangle />
              <span>This scene has only one message. Splitting may not be meaningful.</span>
            </div>
          </Show>

          {/* No content warning */}
          <Show when={contentStats() && contentStats()!.messageCount === 0}>
            <div class={styles.warningBox}>
              <BsExclamationTriangle />
              <span>This scene has no messages to split.</span>
            </div>
          </Show>

          {/* Description */}
          <div style={{ 'font-size': '0.875rem', color: 'var(--color-text-secondary)' }}>
            This will analyze the scene content and suggest how to split it into logical chapters and
            scenes based on natural narrative breaks (location changes, time jumps, POV shifts, etc.).
          </div>
        </Show>

        {/* Generating Step */}
        <Show when={step() === 'generating'}>
          <div class={styles.loadingContainer}>
            <Spinner size="lg" />
            <span>Analyzing content and generating split structure...</span>
            <Show when={generationProgress()}>
              <div class={styles.loadingStatus}>{generationProgress()}</div>
            </Show>
          </div>
        </Show>

        {/* Preview Step */}
        <Show when={step() === 'preview' && proposedStructure()}>
          {/* Summary */}
          <Show when={structureSummary()}>
            <div class={styles.sourceInfo}>
              <span class={styles.sourceInfoLabel}>Result:</span>
              <span class={styles.sourceInfoValue}>
                {structureSummary()!.chapterCount} chapter
                {structureSummary()!.chapterCount !== 1 ? 's' : ''},{' '}
                {structureSummary()!.sceneCount} scene{structureSummary()!.sceneCount !== 1 ? 's' : ''}
              </span>
            </div>
          </Show>

          {/* Proposed Structure */}
          <div class={styles.proposedStructure}>
            <div class={styles.structureLabel}>Proposed Structure:</div>
            <For each={proposedStructure()?.structure}>
              {(chapter) => (
                <div class={styles.chapterNode}>
                  <div class={styles.chapterTitle}>
                    <BsBook class={styles.chapterIcon} />
                    {chapter.title}
                  </div>
                  <div class={styles.scenesContainer}>
                    <For each={chapter.scenes}>
                      {(scene) => (
                        <div class={styles.sceneNode}>
                          <div class={styles.sceneTitle}>
                            <BsFileEarmarkText class={styles.sceneIcon} />
                            {scene.title}
                          </div>
                          <div class={styles.messageAssignments}>
                            <For each={scene.messageAssignments}>
                              {(assignment) => {
                                const isRange = () => typeof assignment.mn === 'string' && assignment.mn.includes('-')
                                return (
                                  <div class={styles.messageAssignment}>
                                    <Show
                                      when={assignment.sb === 'full'}
                                      fallback={
                                        <span class={styles.splitIndicator}>
                                          Message {assignment.mn} (
                                          {assignment.sb === 'splitAfter'
                                            ? `paragraphs 1-${(assignment.p ?? 0) + 1}`
                                            : `from paragraph ${(assignment.p ?? 0) + 1}`}
                                          )
                                        </span>
                                      }
                                    >
                                      <span class={styles.fullIndicator}>
                                        {isRange() ? `Messages ${assignment.mn}` : `Message ${assignment.mn}`}
                                      </span>
                                    </Show>
                                  </div>
                                )
                              }}
                            </For>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </Modal>
  )
}
