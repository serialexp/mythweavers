import { Button, Modal, Spinner } from '@mythweavers/ui'
import { Component, For, Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import { nodeStore } from '../stores/nodeStore'
import { generateSceneSplit, type ProposedStructure } from '../utils/llm/splitScene'
import type { AggregatedMessageContent } from '../utils/llm/splitScenePrompt'
import {
  aggregateNodeContent,
  applyProposedStructure,
  getNodeContentStats,
  validateProposedStructure,
} from '../utils/sceneSplitUtils'
import { estimateTokensFromText } from '../utils/templateAI'
import * as styles from './SplitSceneModal.css'
import { PhBookIcon, PhFileTextIcon, PhWarningIcon } from 'solidjs-phosphor'

type SplitPointType = 'none' | 'scene' | 'chapter'

interface SplitSceneModalProps {
  isOpen: boolean
  onClose: () => void
  targetNodeId: string | null
}

/**
 * Build a ProposedStructure from manually placed split points.
 * Split points are indexed by the gap between messages (index i = gap after message i).
 */
function buildStructureFromSplitPoints(
  messages: AggregatedMessageContent[],
  splitPoints: SplitPointType[],
  titles: Map<string, string>,
): ProposedStructure {
  // Group messages into scenes, scenes into chapters
  const chapters: ProposedStructure['structure'] = []
  let currentChapterIndex = 0
  let currentSceneIndex = 0

  // Start with one chapter containing one scene
  chapters.push({
    type: 'chapter',
    title: titles.get(`chapter-0`) || 'Chapter 1',
    scenes: [{ title: titles.get('scene-0-0') || 'Scene 1', messageAssignments: [] }],
  })

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    // Add this message to the current scene
    chapters[currentChapterIndex].scenes[currentSceneIndex].messageAssignments.push({
      mn: msg.messageNumber,
      sb: 'full',
    })

    // Check if there's a split point after this message
    if (i < messages.length - 1) {
      const splitType = splitPoints[i] || 'none'
      if (splitType === 'chapter') {
        // New chapter + new scene
        currentChapterIndex++
        currentSceneIndex = 0
        chapters.push({
          type: 'chapter',
          title:
            titles.get(`chapter-${currentChapterIndex}`) || `Chapter ${currentChapterIndex + 1}`,
          scenes: [
            {
              title:
                titles.get(`scene-${currentChapterIndex}-0`) ||
                `Scene 1`,
              messageAssignments: [],
            },
          ],
        })
      } else if (splitType === 'scene') {
        // New scene in current chapter
        currentSceneIndex++
        chapters[currentChapterIndex].scenes.push({
          title:
            titles.get(`scene-${currentChapterIndex}-${currentSceneIndex}`) ||
            `Scene ${currentSceneIndex + 1}`,
          messageAssignments: [],
        })
      }
    }
  }

  return { structure: chapters }
}

export const SplitSceneModal: Component<SplitSceneModalProps> = (props) => {
  const [step, setStep] = createSignal<'configure' | 'generating' | 'preview' | 'manual'>(
    'configure',
  )
  const [error, setError] = createSignal<string | null>(null)
  const [proposedStructure, setProposedStructure] = createSignal<ProposedStructure | null>(null)
  const [generationProgress, setGenerationProgress] = createSignal('')
  const [isApplying, setIsApplying] = createSignal(false)

  // Manual split state
  // splitPoints[i] = type of break AFTER message index i
  const [splitPoints, setSplitPoints] = createSignal<SplitPointType[]>([])
  const [titles, setTitles] = createSignal<Map<string, string>>(new Map())

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

  // Aggregated messages for manual split display
  const aggregatedMessages = createMemo(() => {
    const nodeId = props.targetNodeId
    if (!nodeId) return []
    try {
      return aggregateNodeContent(nodeId).messages
    } catch {
      return []
    }
  })

  // Count split points for summary
  const splitPointCount = createMemo(() => {
    const pts = splitPoints()
    let scenes = 0
    let chapters = 0
    for (const pt of pts) {
      if (pt === 'scene') scenes++
      if (pt === 'chapter') chapters++
    }
    return { scenes, chapters }
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
          setSplitPoints([])
          setTitles(new Map())
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

  const handleManualSplit = () => {
    const msgs = aggregatedMessages()
    if (msgs.length === 0) return
    // Initialize split points array (one entry per gap between messages)
    setSplitPoints(new Array(msgs.length - 1).fill('none'))
    setTitles(new Map())
    setStep('manual')
  }

  const toggleSplitPoint = (index: number) => {
    setSplitPoints((prev) => {
      const next = [...prev]
      const cycle: SplitPointType[] = ['none', 'scene', 'chapter']
      const current = cycle.indexOf(next[index])
      next[index] = cycle[(current + 1) % cycle.length]
      return next
    })
  }

  const updateTitle = (key: string, value: string) => {
    setTitles((prev) => {
      const next = new Map(prev)
      next.set(key, value)
      return next
    })
  }

  const handleApplyManualSplit = async () => {
    const nodeId = props.targetNodeId
    if (!nodeId) return

    const msgs = aggregatedMessages()
    const hasSplits = splitPoints().some((p) => p !== 'none')
    if (!hasSplits) {
      setError('No split points added. Click between messages to add scene or chapter breaks.')
      return
    }

    const structure = buildStructureFromSplitPoints(msgs, splitPoints(), titles())

    // Validate
    const validation = validateProposedStructure(structure, msgs)
    if (!validation.valid) {
      setError(validation.error || 'Invalid structure')
      return
    }

    setIsApplying(true)
    setError(null)

    try {
      await applyProposedStructure(nodeId, structure)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply split')
      setIsApplying(false)
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
    setSplitPoints([])
    setTitles(new Map())
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
              variant="secondary"
              onClick={handleManualSplit}
              disabled={!contentStats() || contentStats()!.messageCount < 2}
            >
              Manual Split
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!contentStats() || contentStats()!.messageCount === 0}
            >
              AI Split
            </Button>
          </Show>
          <Show when={step() === 'generating'}>
            <Button variant="secondary" disabled>
              <Spinner size="sm" /> Generating...
            </Button>
          </Show>
          <Show when={step() === 'manual'}>
            <Button variant="secondary" onClick={handleReset} disabled={isApplying()}>
              Back
            </Button>
            <Button variant="secondary" onClick={handleClose} disabled={isApplying()}>
              Cancel
            </Button>
            <Button onClick={handleApplyManualSplit} disabled={isApplying()}>
              <Show when={isApplying()} fallback="Apply Split">
                <Spinner size="sm" /> Applying...
              </Show>
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
            <PhWarningIcon />
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
              <PhWarningIcon />
              <span>This scene has only one message. Splitting may not be meaningful.</span>
            </div>
          </Show>

          {/* No content warning */}
          <Show when={contentStats() && contentStats()!.messageCount === 0}>
            <div class={styles.warningBox}>
              <PhWarningIcon />
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
                    <PhBookIcon class={styles.chapterIcon} />
                    {chapter.title}
                  </div>
                  <div class={styles.scenesContainer}>
                    <For each={chapter.scenes}>
                      {(scene) => (
                        <div class={styles.sceneNode}>
                          <div class={styles.sceneTitle}>
                            <PhFileTextIcon class={styles.sceneIcon} />
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

        {/* Manual Split Step */}
        <Show when={step() === 'manual'}>
          <div class={styles.manualSplitDescription}>
            Click between messages to cycle through: no break → scene break → chapter break.
            {splitPointCount().chapters + splitPointCount().scenes > 0 && (
              <span>
                {' '}Current: {splitPointCount().chapters > 0 && `${splitPointCount().chapters + 1} chapters`}
                {splitPointCount().chapters > 0 && splitPointCount().scenes > 0 && ', '}
                {splitPointCount().scenes > 0 && `${splitPointCount().scenes} scene break${splitPointCount().scenes !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>

          <div class={styles.manualSplitContainer}>
            <For each={aggregatedMessages()}>
              {(msg, msgIndex) => {
                const splitType = () => splitPoints()[msgIndex()] || 'none'
                const isLastMessage = () => msgIndex() === aggregatedMessages().length - 1
                const preview = () => {
                  const text = msg.content.replace(/\n+/g, ' ').trim()
                  return text.length > 120 ? text.slice(0, 120) + '...' : text
                }

                // Compute the chapter/scene indices for title inputs at this split point
                const splitLabel = () => {
                  const type = splitType()
                  if (type === 'none') return null
                  // Count chapters and scenes up to this point
                  let chapterIdx = 0
                  let sceneIdx = 0
                  const pts = splitPoints()
                  for (let i = 0; i < msgIndex(); i++) {
                    if (pts[i] === 'chapter') {
                      chapterIdx++
                      sceneIdx = 0
                    } else if (pts[i] === 'scene') {
                      sceneIdx++
                    }
                  }
                  if (type === 'chapter') {
                    return {
                      type: 'chapter' as const,
                      chapterKey: `chapter-${chapterIdx + 1}`,
                      sceneKey: `scene-${chapterIdx + 1}-0`,
                      chapterDefault: `Chapter ${chapterIdx + 2}`,
                      sceneDefault: 'Scene 1',
                    }
                  }
                  return {
                    type: 'scene' as const,
                    sceneKey: `scene-${chapterIdx}-${sceneIdx + 1}`,
                    sceneDefault: `Scene ${sceneIdx + 2}`,
                  }
                }

                return (
                  <>
                    <div class={styles.messageItem}>
                      <span class={styles.messageNumber}>#{msg.messageNumber}</span>
                      <span class={styles.messagePreview}>{preview()}</span>
                      <span class={styles.messageWordCount}>
                        {msg.wordCount.toLocaleString()} words
                      </span>
                    </div>

                    <Show when={!isLastMessage()}>
                      <div
                        class={styles.splitPointArea}
                        onClick={() => toggleSplitPoint(msgIndex())}
                      >
                        <div class={styles.splitPointLine} />
                        <span
                          class={`${styles.splitPointButton} ${
                            splitType() === 'scene'
                              ? styles.splitPointButtonActive
                              : splitType() === 'chapter'
                                ? styles.splitPointChapter
                                : ''
                          }`}
                        >
                          {splitType() === 'none' && '+ split'}
                          {splitType() === 'scene' && '— scene break —'}
                          {splitType() === 'chapter' && '— chapter break —'}
                        </span>
                      </div>

                      {/* Title inputs for active split points */}
                      <Show when={splitLabel()}>
                        {(label) => (
                          <div>
                            <Show when={label().type === 'chapter'}>
                              <div class={styles.manualTitleInputRow}>
                                <span class={styles.manualTitleLabel}>Chapter:</span>
                                <input
                                  class={styles.manualTitleInput}
                                  type="text"
                                  placeholder={(label() as { chapterDefault: string }).chapterDefault}
                                  value={titles().get((label() as { chapterKey: string }).chapterKey) || ''}
                                  onInput={(e) =>
                                    updateTitle(
                                      (label() as { chapterKey: string }).chapterKey,
                                      e.currentTarget.value,
                                    )
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </Show>
                            <div class={styles.manualTitleInputRow}>
                              <span class={styles.manualTitleLabel}>Scene:</span>
                              <input
                                class={styles.manualTitleInput}
                                type="text"
                                placeholder={label().sceneDefault}
                                value={titles().get(label().sceneKey) || ''}
                                onInput={(e) =>
                                  updateTitle(label().sceneKey, e.currentTarget.value)
                                }
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                        )}
                      </Show>
                    </Show>
                  </>
                )
              }}
            </For>
          </div>
        </Show>
      </div>
    </Modal>
  )
}
