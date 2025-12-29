import { Button, Modal, Spinner } from '@mythweavers/ui'
import * as Diff from 'diff'
import { BsExclamationTriangle } from 'solid-icons/bs'
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

export const CharacterUpdateModal: Component<CharacterUpdateModalProps> = (props) => {
  const [selectedCharacterId, setSelectedCharacterId] = createSignal<string>(props.preselectedCharacterId || '')
  const [instruction, setInstruction] = createSignal('')
  const [isGenerating, setIsGenerating] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [proposedDescription, setProposedDescription] = createSignal<string | null>(null)
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

  // Get selected character
  const selectedCharacter = createMemo(() => {
    const id = selectedCharacterId()
    if (!id) return null
    return charactersStore.characters.find((c) => c.id === id) || null
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
  const diffResult = createMemo(() => {
    const current = selectedCharacter()?.description || ''
    const proposed = proposedDescription()
    if (!proposed) return null

    return Diff.diffLines(current, proposed)
  })

  // Estimate tokens when character or content changes
  createEffect(
    on(
      () => [selectedCharacter(), fullContentNodes(), summaryNodes(), props.isOpen] as const,
      async ([character, _fullNodes, _summNodes, isOpen]) => {
        if (!isOpen || !character) {
          setTokenEstimate(null)
          return
        }

        setIsEstimating(true)
        try {
          const messages = messagesStore.messages
          const messageId = contextMessageId()
          const currentDescription = character.description || ''

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
            'placeholder instruction', // Use placeholder to estimate base cost
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

  const handleGenerate = async () => {
    const character = selectedCharacter()
    if (!character || !instruction().trim()) return

    setIsGenerating(true)
    setError(null)
    setProposedDescription(null)

    try {
      const messages = messagesStore.messages
      const messageId = contextMessageId()
      const currentDescription = character.description || ''

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

      // Get story content
      const storyContent = getStoryContent()

      // Generate new description
      const newDescription = await generateTemplateChange(
        currentDescription,
        currentResolvedState,
        instruction(),
        storyContent,
      )

      // Validate the new template
      if (messageId) {
        const validationResult = getTemplatePreview(
          newDescription,
          messages,
          messageId,
          nodeStore.nodesArray,
          currentStoryStore.globalScript,
        )

        if (validationResult.error) {
          setError(`Invalid template generated: ${validationResult.error}`)
          return
        }
      }

      setProposedDescription(newDescription)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate description')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAccept = () => {
    const character = selectedCharacter()
    const proposed = proposedDescription()
    if (!character || !proposed) return

    charactersStore.updateCharacter(character.id, { description: proposed })
    handleClose()
  }

  const handleClose = () => {
    setSelectedCharacterId(props.preselectedCharacterId || '')
    setInstruction('')
    setError(null)
    setProposedDescription(null)
    props.onClose()
  }

  const handleReset = () => {
    setProposedDescription(null)
    setError(null)
  }

  return (
    <Modal
      open={props.isOpen}
      onClose={handleClose}
      title="Update Character Description"
      size="lg"
      footer={
        <div class={styles.actions}>
          <Show when={!proposedDescription()}>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={
                !selectedCharacterId() ||
                !instruction().trim() ||
                isGenerating() ||
                (tokenEstimate() !== null && !tokenEstimate()!.fitsInContext)
              }
            >
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
            <Button onClick={handleAccept}>Accept Changes</Button>
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
        <Show when={tokenEstimate() && selectedCharacter()}>
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

        {/* Character Selection */}
        <div class={styles.formSection}>
          <label class={styles.label}>Character</label>
          <select
            class={styles.select}
            value={selectedCharacterId()}
            onChange={(e) => setSelectedCharacterId(e.currentTarget.value)}
            disabled={isGenerating() || !!proposedDescription()}
          >
            <option value="">Select a character...</option>
            <For each={availableCharacters()}>
              {(character) => <option value={character.id}>{getCharacterDisplayName(character)}</option>}
            </For>
          </select>
        </div>

        {/* Instruction Input */}
        <Show when={!proposedDescription()}>
          <div class={styles.formSection}>
            <label class={styles.label}>Update Instructions</label>
            <textarea
              class={styles.textarea}
              value={instruction()}
              onInput={(e) => setInstruction(e.currentTarget.value)}
              placeholder="e.g., 'Add details about their experience in the recent battle' or 'Update their emotional state based on recent events'"
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
            <span>Generating updated description...</span>
          </div>
        </Show>

        {/* Diff Preview */}
        <Show when={proposedDescription() && diffResult()}>
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
