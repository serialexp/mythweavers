import { Alert, Button, Input, Spinner, Stack } from '@mythweavers/ui'
import { Component, Show, createMemo, createSignal } from 'solid-js'
import { PhArrowsClockwiseIcon, PhBooksIcon, PhCheckCircleIcon, PhWarningIcon } from 'solidjs-phosphor'
import { useContextMessage } from '../hooks/useContextMessage'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { buildNodeMarkdown } from '../utils/nodeContentExport'
import { getTemplatePreview } from '../utils/scriptEngine'
import { generateTemplateChange } from '../utils/templateAI'
import * as styles from './TemplateChangeRequest.css'

interface TemplateChangeRequestProps {
  currentTemplate: string
  onTemplateChange: (newTemplate: string) => void
  placeholder?: string
  /** What is being edited — used to label the AI task ('Character', 'Context Item'). */
  entityLabel?: string
}

type AdjustMode = 'plain' | 'context'

export const TemplateChangeRequest: Component<TemplateChangeRequestProps> = (props) => {
  const [changeRequest, setChangeRequest] = createSignal('')
  const [loadingMode, setLoadingMode] = createSignal<AdjustMode | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [success, setSuccess] = createSignal(false)
  const contextMessageId = useContextMessage()

  const isLoading = () => loadingMode() !== null

  // Get nodes marked for full content (includeInFull === 2)
  const fullContentNodes = createMemo(() =>
    nodeStore.nodesArray.filter((node) => node.includeInFull === 2).sort((a, b) => a.order - b.order),
  )

  // Get nodes marked for summary (includeInFull === 1)
  const summaryNodes = createMemo(() =>
    nodeStore.nodesArray.filter((node) => node.includeInFull === 1 && node.summary).sort((a, b) => a.order - b.order),
  )

  // Check if we have any context nodes
  const hasContextNodes = createMemo(() => fullContentNodes().length > 0 || summaryNodes().length > 0)

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

  const handleSubmit = async (mode: AdjustMode) => {
    const request = changeRequest().trim()
    if (!request || isLoading()) return

    setLoadingMode(mode)
    setError(null)
    setSuccess(false)

    try {
      // Get the current resolved state for context
      const messages = messagesStore.messages
      const messageId = contextMessageId()

      let currentResolvedState = {}
      if (messageId) {
        const preview = getTemplatePreview(
          props.currentTemplate,
          messages,
          messageId,
          nodeStore.nodesArray,
          currentStoryStore.globalScript,
        )
        currentResolvedState = preview.data
      }

      // Only the 'context' mode pulls in the marked scenes. A plain adjustment
      // sends just the template itself plus the instruction, which is what most
      // wording tweaks need — and is far cheaper.
      const storyContent = mode === 'context' ? getStoryContent() : undefined
      if (mode === 'context' && !storyContent) {
        setError('No scenes are marked for context. Mark scenes with the circle icons first.')
        return
      }

      // Generate new template using AI
      const newTemplate = await generateTemplateChange(
        props.currentTemplate,
        currentResolvedState,
        request,
        storyContent,
        {
          entityLabel: props.entityLabel,
        },
      )

      // Never let an empty result silently wipe the field the user was editing.
      if (!newTemplate.trim()) {
        setError('The model returned an empty template — your text was left unchanged.')
        return
      }

      // Validate the new template by trying to evaluate it
      if (messageId) {
        const validationResult = getTemplatePreview(
          newTemplate,
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

      // If valid, update the template
      props.onTemplateChange(newTemplate)
      setChangeRequest('')
      setSuccess(true)

      // Clear success message after 2 seconds
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate template')
    } finally {
      setLoadingMode(null)
    }
  }

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Enter runs the cheap adjustment; use the button for the context variant.
      handleSubmit('plain')
    }
  }

  return (
    <Stack direction="vertical" gap="xs" style={{ margin: '8px 0' }}>
      <Show when={hasContextNodes()}>
        <div class={styles.contextNodesInfo}>
          <Show when={fullContentNodes().length > 0}>
            <span class={styles.contextLabel}>Full:</span>
            <span class={styles.nodeList}>
              {fullContentNodes()
                .map((n) => n.title)
                .join(', ')}
            </span>
          </Show>
          <Show when={fullContentNodes().length > 0 && summaryNodes().length > 0}>
            <span class={styles.contextLabel}>&nbsp;|&nbsp;</span>
          </Show>
          <Show when={summaryNodes().length > 0}>
            <span class={styles.contextLabel}>Summary:</span>
            <span class={styles.nodeList}>
              {summaryNodes()
                .map((n) => n.title)
                .join(', ')}
            </span>
          </Show>
        </div>
      </Show>

      <Input
        value={changeRequest()}
        onInput={(e) => setChangeRequest(e.currentTarget.value)}
        onKeyDown={handleKeyPress}
        placeholder={
          props.placeholder || "e.g., 'Make the description more mysterious' or 'Add their current emotional state'"
        }
        disabled={isLoading()}
      />

      <Stack direction="horizontal" gap="sm" align="center">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handleSubmit('plain')}
          disabled={!changeRequest().trim() || isLoading()}
          title="Adjust using only the current text and your instruction"
        >
          <Show when={loadingMode() === 'plain'} fallback={<PhArrowsClockwiseIcon />}>
            <Spinner size="sm" />
          </Show>
          <span class={styles.buttonLabel}>Adjust</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handleSubmit('context')}
          disabled={!changeRequest().trim() || isLoading() || !hasContextNodes()}
          title={
            hasContextNodes()
              ? 'Adjust with the scenes marked for context included in the prompt'
              : 'No scenes marked for context — mark scenes with the circle icons first'
          }
        >
          <Show when={loadingMode() === 'context'} fallback={<PhBooksIcon />}>
            <Spinner size="sm" />
          </Show>
          <span class={styles.buttonLabel}>Adjust with context</span>
        </Button>
      </Stack>

      <Show when={error()}>
        <Alert variant="error">
          <PhWarningIcon style={{ 'margin-right': '6px' }} /> {error()}
        </Alert>
      </Show>

      <Show when={success()}>
        <Alert variant="success">
          <PhCheckCircleIcon style={{ 'margin-right': '6px' }} /> Template updated successfully!
        </Alert>
      </Show>
    </Stack>
  )
}
