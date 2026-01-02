import { Button, Modal, Spinner } from '@mythweavers/ui'
import * as Diff from 'diff'
import { BsCheck2, BsExclamationTriangle, BsX } from 'solid-icons/bs'
import { Component, For, Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import { useContextMessage } from '../hooks/useContextMessage'
import { charactersStore } from '../stores/charactersStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { getCharacterDisplayName } from '../utils/character'
import { buildNodeMarkdown } from '../utils/nodeContentExport'
import { getTemplatePreview } from '../utils/scriptEngine'
import { estimateTemplateChangeTokens, generateTemplateChange, type TokenEstimateResult } from '../utils/templateAI'
import * as styles from './CharacterUpdateModal.css'

interface CharacterUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  preselectedCharacterId?: string
}

interface CharacterResult {
  characterId: string
  characterName: string
  originalDescription: string
  proposedDescription: string | null
  error: string | null
  accepted: boolean
}

export const CharacterUpdateModal: Component<CharacterUpdateModalProps> = (props) => {
  const [selectedCharacterIds, setSelectedCharacterIds] = createSignal<Set<string>>(new Set())
  const [instruction, setInstruction] = createSignal('')
  const [isGenerating, setIsGenerating] = createSignal(false)
  const [currentProcessingIndex, setCurrentProcessingIndex] = createSignal(0)
  const [results, setResults] = createSignal<CharacterResult[]>([])
  const [tokenEstimate, setTokenEstimate] = createSignal<TokenEstimateResult | null>(null)
  const [isEstimating, setIsEstimating] = createSignal(false)
  const contextMessageId = useContextMessage()

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

  // Get characters that are active in any of the context nodes
  const availableCharacters = createMemo(() => {
    const fullNodes = fullContentNodes()
    const summNodes = summaryNodes()
    if (fullNodes.length === 0 && summNodes.length === 0) {
      // Fallback to all characters if no context nodes
      return charactersStore.characters
    }

    // Collect all active character IDs from context nodes
    const activeCharacterIds = new Set<string>()
    for (const node of [...fullNodes, ...summNodes]) {
      if (node.activeCharacterIds) {
        for (const id of node.activeCharacterIds) {
          activeCharacterIds.add(id)
        }
      }
    }

    // If no active characters defined, return all
    if (activeCharacterIds.size === 0) {
      return charactersStore.characters
    }

    return charactersStore.characters.filter((char) => activeCharacterIds.has(char.id))
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

  // Compute diff between current and proposed description
  const computeDiff = (current: string, proposed: string | null) => {
    if (!proposed) return null
    return Diff.diffLines(current, proposed)
  }

  // Check if we have any results to show
  const hasResults = createMemo(() => results().length > 0)

  // Count pending (unaccepted, non-error) results
  const pendingCount = createMemo(() => {
    return results().filter((r) => !r.accepted && !r.error && r.proposedDescription).length
  })

  // Initialize selection when modal opens
  createEffect(
    on(
      () => props.isOpen,
      (isOpen) => {
        if (isOpen && props.preselectedCharacterId) {
          setSelectedCharacterIds(new Set([props.preselectedCharacterId]))
        }
      },
    ),
  )

  // Estimate tokens when selection or content changes
  createEffect(
    on(
      () => [selectedCharacterIds().size, fullContentNodes(), summaryNodes(), props.isOpen] as const,
      async ([selectedCount, _fullNodes, _summNodes, isOpen]) => {
        if (!isOpen || selectedCount === 0) {
          setTokenEstimate(null)
          return
        }

        setIsEstimating(true)
        try {
          const messages = messagesStore.messages
          const messageId = contextMessageId()

          // Get script state for first selected character (estimate is similar for all)
          const firstCharacterId = [...selectedCharacterIds()][0]
          const firstCharacter = charactersStore.characters.find((c) => c.id === firstCharacterId)
          if (!firstCharacter) {
            setTokenEstimate(null)
            return
          }

          const currentDescription = firstCharacter.description || ''

          // Get script state
          let currentResolvedState = {}
          if (messageId) {
            const preview = getTemplatePreview(
              currentDescription,
              messages,
              messageId,
              nodeStore.nodesArray,
              currentStoryStore.globalScript,
            )
            currentResolvedState = preview.data
          }

          const storyContent = getStoryContent()
          const estimate = await estimateTemplateChangeTokens(
            currentDescription,
            currentResolvedState,
            'placeholder instruction',
            storyContent,
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

  const toggleCharacterSelection = (characterId: string) => {
    setSelectedCharacterIds((prev) => {
      const next = new Set(prev)
      if (next.has(characterId)) {
        next.delete(characterId)
      } else {
        next.add(characterId)
      }
      return next
    })
  }

  const selectAllCharacters = () => {
    const allIds = new Set(availableCharacters().map((c) => c.id))
    setSelectedCharacterIds(allIds)
  }

  const deselectAllCharacters = () => {
    setSelectedCharacterIds(new Set<string>())
  }

  const handleGenerate = async () => {
    const selectedIds = [...selectedCharacterIds()]
    if (selectedIds.length === 0 || !instruction().trim()) return

    setIsGenerating(true)
    setResults([])
    setCurrentProcessingIndex(0)

    const messages = messagesStore.messages
    const messageId = contextMessageId()
    const storyContent = getStoryContent()

    // Process each character sequentially to benefit from caching
    for (let i = 0; i < selectedIds.length; i++) {
      setCurrentProcessingIndex(i)
      const characterId = selectedIds[i]
      const character = charactersStore.characters.find((c) => c.id === characterId)

      if (!character) continue

      const characterName = getCharacterDisplayName(character)
      const currentDescription = character.description || ''

      try {
        // Get script state
        let currentResolvedState = {}
        if (messageId) {
          const preview = getTemplatePreview(
            currentDescription,
            messages,
            messageId,
            nodeStore.nodesArray,
            currentStoryStore.globalScript,
          )
          currentResolvedState = preview.data
        }

        // Generate new description
        const newDescription = await generateTemplateChange(
          currentDescription,
          currentResolvedState,
          instruction(),
          storyContent,
        )

        // Validate the new template
        let validationError: string | null = null
        if (messageId) {
          const validationResult = getTemplatePreview(
            newDescription,
            messages,
            messageId,
            nodeStore.nodesArray,
            currentStoryStore.globalScript,
          )

          if (validationResult.error) {
            validationError = `Invalid template: ${validationResult.error}`
          }
        }

        // Add result
        setResults((prev) => [
          ...prev,
          {
            characterId,
            characterName,
            originalDescription: currentDescription,
            proposedDescription: validationError ? null : newDescription,
            error: validationError,
            accepted: false,
          },
        ])
      } catch (err) {
        // Add error result
        setResults((prev) => [
          ...prev,
          {
            characterId,
            characterName,
            originalDescription: currentDescription,
            proposedDescription: null,
            error: err instanceof Error ? err.message : 'Failed to generate description',
            accepted: false,
          },
        ])
      }
    }

    setIsGenerating(false)
  }

  const handleAcceptResult = (characterId: string) => {
    const result = results().find((r) => r.characterId === characterId)
    if (!result || !result.proposedDescription) return

    charactersStore.updateCharacter(characterId, { description: result.proposedDescription })
    setResults((prev) => prev.map((r) => (r.characterId === characterId ? { ...r, accepted: true } : r)))
  }

  const handleRejectResult = (characterId: string) => {
    setResults((prev) => prev.filter((r) => r.characterId !== characterId))
  }

  const handleAcceptAll = () => {
    const pendingResults = results().filter((r) => !r.accepted && !r.error && r.proposedDescription)
    for (const result of pendingResults) {
      charactersStore.updateCharacter(result.characterId, { description: result.proposedDescription! })
    }
    setResults((prev) => prev.map((r) => (r.proposedDescription && !r.error ? { ...r, accepted: true } : r)))
  }

  const handleClose = () => {
    setSelectedCharacterIds(new Set<string>())
    setInstruction('')
    setResults([])
    setCurrentProcessingIndex(0)
    props.onClose()
  }

  const handleReset = () => {
    setResults([])
    setCurrentProcessingIndex(0)
  }

  return (
    <Modal
      open={props.isOpen}
      onClose={handleClose}
      title="Update Character Descriptions"
      size="lg"
      footer={
        <div class={styles.actions}>
          <Show when={!hasResults()}>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={
                selectedCharacterIds().size === 0 ||
                !instruction().trim() ||
                isGenerating() ||
                (tokenEstimate() !== null && !tokenEstimate()!.fitsInContext)
              }
            >
              <Show when={isGenerating()} fallback={`Generate (${selectedCharacterIds().size} characters)`}>
                <Spinner size="sm" /> Generating...
              </Show>
            </Button>
          </Show>
          <Show when={hasResults() && !isGenerating()}>
            <Button variant="secondary" onClick={handleReset}>
              Start Over
            </Button>
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
            <Show when={pendingCount() > 0}>
              <Button onClick={handleAcceptAll}>Accept All ({pendingCount()})</Button>
            </Show>
          </Show>
        </div>
      }
    >
      <div class={styles.modalContent}>
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
            <span>No scenes marked for context. Mark scenes with the circle icons to use as context.</span>
          </div>
        </Show>

        {/* Token Estimate Display */}
        <Show when={tokenEstimate() && selectedCharacterIds().size > 0}>
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
                  {selectedCharacterIds().size > 1 && ' per character (cached after first)'}
                </span>
                <Show when={!est.fitsInContext}>
                  <span>- exceeds context limit!</span>
                </Show>
              </div>
            )
          })()}
        </Show>

        {/* Character Selection - only show when not generating and no results */}
        <Show when={!hasResults() && !isGenerating()}>
          <div class={styles.formSection}>
            <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
              <label class={styles.label}>Select Characters ({selectedCharacterIds().size} selected)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={selectAllCharacters}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-accent-primary)',
                    cursor: 'pointer',
                    'font-size': '0.75rem',
                    padding: '0.25rem 0.5rem',
                  }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAllCharacters}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    'font-size': '0.75rem',
                    padding: '0.25rem 0.5rem',
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
            <div class={styles.characterGrid}>
              <For each={availableCharacters()}>
                {(character) => (
                  <label class={styles.characterCheckbox}>
                    <input
                      type="checkbox"
                      checked={selectedCharacterIds().has(character.id)}
                      onChange={() => toggleCharacterSelection(character.id)}
                    />
                    <span>{getCharacterDisplayName(character)}</span>
                  </label>
                )}
              </For>
            </div>
          </div>

          {/* Instruction Input */}
          <div class={styles.formSection}>
            <label class={styles.label}>Update Instructions</label>
            <textarea
              class={styles.textarea}
              value={instruction()}
              onInput={(e) => setInstruction(e.currentTarget.value)}
              placeholder="e.g., 'Add details about their experience in the recent battle' or 'Update their emotional state based on recent events'"
            />
          </div>
        </Show>

        {/* Progress Display */}
        <Show when={isGenerating()}>
          <div class={styles.loadingContainer}>
            <Spinner size="md" />
            <span>
              Processing character {currentProcessingIndex() + 1} of {selectedCharacterIds().size}...
              {currentProcessingIndex() > 0 && ' (using cached context)'}
            </span>
          </div>
        </Show>

        {/* Results Display */}
        <Show when={hasResults()}>
          <div class={styles.resultsContainer}>
            <For each={results()}>
              {(result) => (
                <div class={`${styles.resultCard} ${result.accepted ? styles.resultCardAccepted : ''}`}>
                  <div class={styles.resultHeader}>
                    <span class={styles.resultCharacterName}>{result.characterName}</span>
                    <Show when={result.accepted}>
                      <span class={styles.acceptedBadge}>✓ Accepted</span>
                    </Show>
                    <Show when={result.error}>
                      <span class={styles.errorBadge}>Error</span>
                    </Show>
                    <Show when={!result.accepted && !result.error && result.proposedDescription}>
                      <div class={styles.resultActions}>
                        <button
                          type="button"
                          class={styles.acceptButton}
                          onClick={() => handleAcceptResult(result.characterId)}
                          title="Accept changes"
                        >
                          <BsCheck2 />
                        </button>
                        <button
                          type="button"
                          class={styles.rejectButton}
                          onClick={() => handleRejectResult(result.characterId)}
                          title="Reject changes"
                        >
                          <BsX />
                        </button>
                      </div>
                    </Show>
                  </div>

                  <Show when={result.error}>
                    <div class={styles.noContextWarning}>
                      <BsExclamationTriangle />
                      <span>{result.error}</span>
                    </div>
                  </Show>

                  <Show when={result.proposedDescription && !result.error}>
                    <div class={styles.diffContainer}>
                      {/* Current Description */}
                      <div class={styles.diffPane}>
                        <div class={styles.diffHeader}>Current</div>
                        <div class={styles.diffContent}>
                          <For each={computeDiff(result.originalDescription, result.proposedDescription)}>
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
                        <div class={styles.diffHeader}>Proposed</div>
                        <div class={styles.diffContent}>
                          <For each={computeDiff(result.originalDescription, result.proposedDescription)}>
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
        </Show>
      </div>
    </Modal>
  )
}
