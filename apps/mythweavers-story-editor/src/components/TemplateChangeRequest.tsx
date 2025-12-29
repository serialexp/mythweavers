import { Alert, IconButton, Input, Spinner, Stack } from '@mythweavers/ui'
import { BsArrowRepeat, BsCheckCircle, BsExclamationTriangle } from 'solid-icons/bs'
import { Component, Show, createMemo, createSignal } from 'solid-js'
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
  includeStoryContent?: boolean
}

export const TemplateChangeRequest: Component<TemplateChangeRequestProps> = (props) => {
  const [changeRequest, setChangeRequest] = createSignal('')
  const [isLoading, setIsLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [success, setSuccess] = createSignal(false)
  const contextMessageId = useContextMessage()

  // Get nodes marked for full content (includeInFull === 2)
  const fullContentNodes = createMemo(() => {
    if (!props.includeStoryContent) return []
    return nodeStore.nodesArray
      .filter((node) => node.includeInFull === 2)
      .sort((a, b) => a.order - b.order)
  })

  // Get nodes marked for summary (includeInFull === 1)
  const summaryNodes = createMemo(() => {
    if (!props.includeStoryContent) return []
    return nodeStore.nodesArray
      .filter((node) => node.includeInFull === 1 && node.summary)
      .sort((a, b) => a.order - b.order)
  })

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

  const handleSubmit = async () => {
    const request = changeRequest().trim()
    if (!request || isLoading()) return

    setIsLoading(true)
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

      // Get story content if enabled
      const storyContent = props.includeStoryContent ? getStoryContent() : undefined

      // Generate new template using AI
      const newTemplate = await generateTemplateChange(props.currentTemplate, currentResolvedState, request, storyContent)

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
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Stack direction="vertical" gap="xs" style={{ margin: '8px 0' }}>
      <Show when={props.includeStoryContent && hasContextNodes()}>
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

      <Show when={props.includeStoryContent && !hasContextNodes()}>
        <div class={styles.noContextWarning}>
          <BsExclamationTriangle />
          <span>No scenes marked for context. Mark scenes with the circle icons to use as context.</span>
        </div>
      </Show>

      <Stack direction="horizontal" gap="sm" align="center">
        <Input
          value={changeRequest()}
          onInput={(e) => setChangeRequest(e.currentTarget.value)}
          onKeyDown={handleKeyPress}
          placeholder={
            props.placeholder || "e.g., 'Make the description more mysterious' or 'Add their current emotional state'"
          }
          disabled={isLoading()}
          style={{ flex: 1 }}
        />
        <IconButton
          onClick={handleSubmit}
          disabled={!changeRequest().trim() || isLoading()}
          title="Generate new template with AI"
          aria-label="Generate template"
        >
          <Show when={isLoading()} fallback={<BsArrowRepeat />}>
            <Spinner size="sm" />
          </Show>
        </IconButton>
      </Stack>

      <Show when={error()}>
        <Alert variant="error">
          <BsExclamationTriangle style={{ 'margin-right': '6px' }} /> {error()}
        </Alert>
      </Show>

      <Show when={success()}>
        <Alert variant="success">
          <BsCheckCircle style={{ 'margin-right': '6px' }} /> Template updated successfully!
        </Alert>
      </Show>
    </Stack>
  )
}
