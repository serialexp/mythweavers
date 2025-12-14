import { Component, createSignal, Show } from 'solid-js'
import { BsArrowRepeat, BsCheckCircle, BsExclamationTriangle } from 'solid-icons/bs'
import { generateTemplateChange } from '../utils/templateAI'
import { getTemplatePreview } from '../utils/scriptEngine'
import { messagesStore } from '../stores/messagesStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { nodeStore } from '../stores/nodeStore'
import { useContextMessage } from '../hooks/useContextMessage'
import styles from './TemplateChangeRequest.module.css'

interface TemplateChangeRequestProps {
  currentTemplate: string
  onTemplateChange: (newTemplate: string) => void
  placeholder?: string
}

export const TemplateChangeRequest: Component<TemplateChangeRequestProps> = (props) => {
  const [changeRequest, setChangeRequest] = createSignal('')
  const [isLoading, setIsLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [success, setSuccess] = createSignal(false)
  const contextMessageId = useContextMessage()

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
          currentStoryStore.globalScript
        )
        currentResolvedState = preview.data
      }

      // Generate new template using AI
      const newTemplate = await generateTemplateChange(
        props.currentTemplate,
        currentResolvedState,
        request
      )

      // Validate the new template by trying to evaluate it
      if (messageId) {
        const validationResult = getTemplatePreview(
          newTemplate,
          messages,
          messageId,
          nodeStore.nodesArray,
          currentStoryStore.globalScript
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
    <div class={styles.container}>
      <div class={styles.inputWrapper}>
        <input
          type="text"
          value={changeRequest()}
          onInput={(e) => setChangeRequest(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={props.placeholder || "e.g., 'Make the description more mysterious' or 'Add their current emotional state'"}
          class={styles.input}
          disabled={isLoading()}
        />
        <button
          onClick={handleSubmit}
          disabled={!changeRequest().trim() || isLoading()}
          class={styles.button}
          title="Generate new template with AI"
        >
          <Show when={isLoading()} fallback={<BsArrowRepeat />}>
            <span class={styles.spinner}>⟳</span>
          </Show>
        </button>
      </div>
      
      <Show when={error()}>
        <div class={styles.error}>
          <BsExclamationTriangle /> {error()}
        </div>
      </Show>
      
      <Show when={success()}>
        <div class={styles.success}>
          <BsCheckCircle /> Template updated successfully!
        </div>
      </Show>
    </div>
  )
}