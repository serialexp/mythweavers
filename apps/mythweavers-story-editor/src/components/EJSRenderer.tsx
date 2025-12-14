import { Component, createMemo, createSignal, Show } from 'solid-js'
import { BsEye, BsEyeSlash, BsExclamationTriangle } from 'solid-icons/bs'
import { messagesStore } from '../stores/messagesStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { nodeStore } from '../stores/nodeStore'
import { getTemplatePreview } from '../utils/scriptEngine'
import { useContextMessage } from '../hooks/useContextMessage'
import styles from './EJSRenderer.module.css'

export type EJSRendererMode = 'inline' | 'preview-toggle' | 'preview-always'

interface EJSRendererProps {
  template: string
  mode?: EJSRendererMode
  fallbackClassName?: string
  title?: string
  showDataByDefault?: boolean
}

export const EJSRenderer: Component<EJSRendererProps> = (props) => {
  const mode = () => props.mode || 'inline'
  const [showPreview, setShowPreview] = createSignal(false)
  const contextMessageId = useContextMessage()
  
  const hasEJS = createMemo(() => {
    return props.template?.includes('<%')
  })
  
  const evaluationResult = createMemo(() => {
    if (!props.template) {
      return {
        result: '',
        data: {},
        error: null,
        evaluationTime: 0
      }
    }
    
    // For inline mode without EJS, just return the template
    if (mode() === 'inline' && !hasEJS()) {
      return {
        result: props.template,
        data: {},
        error: null,
        evaluationTime: 0
      }
    }
    
    // For preview modes that are toggled off, don't evaluate
    if (mode() === 'preview-toggle' && !showPreview()) {
      return null
    }
    
    // Check if we have a context message
    const messageId = contextMessageId()
    if (!messageId) {
      return {
        result: props.template,
        data: {},
        error: hasEJS() ? 'No story messages yet for EJS preview' : null,
        evaluationTime: 0
      }
    }
    
    // If no EJS tags, just return the template as-is
    if (!hasEJS()) {
      return {
        result: props.template,
        data: {},
        error: null,
        evaluationTime: 0
      }
    }
    
    // Measure evaluation time and evaluate the template
    const startTime = performance.now()
    const previewResult = getTemplatePreview(
      props.template,
      messagesStore.messages,
      messageId,
      nodeStore.nodesArray,
      currentStoryStore.globalScript
    )
    const endTime = performance.now()
    const evaluationTime = endTime - startTime

    return {
      ...previewResult,
      evaluationTime
    }
  })
  
  // Inline mode - just display the evaluated text
  if (mode() === 'inline') {
    const result = evaluationResult()
    return (
      <span class={props.fallbackClassName || styles.inlineDisplay}>
        {result?.error ? props.template : result?.result}
      </span>
    )
  }
  
  // Preview toggle mode - show/hide preview with a button
  if (mode() === 'preview-toggle') {
    return (
      <Show when={hasEJS()}>
        <div class={styles.container}>
          <button
            type="button"
            class={styles.toggleButton}
            onClick={() => setShowPreview(!showPreview())}
            title={showPreview() ? 'Hide EJS preview' : 'Show EJS preview'}
          >
            <Show when={showPreview()} fallback={<BsEye />}>
              <BsEyeSlash />
            </Show>
            {props.title || 'EJS Preview'}
          </button>
          
          <Show when={showPreview() && evaluationResult()}>
            <div class={styles.preview}>
              <Show when={evaluationResult()!.error}>
                <div class={styles.error}>
                  <BsExclamationTriangle />
                  <div class={styles.errorContent}>
                    <pre class={styles.errorMessage}>{evaluationResult()!.error}</pre>
                  </div>
                </div>
              </Show>
              
              <div class={styles.result}>
                <div class={styles.label}>Preview:</div>
                <div class={styles.content}>{evaluationResult()!.result}</div>
              </div>
              
              <details class={styles.dataDetails}>
                <summary class={styles.dataSummary}>
                  Available Data <span class={styles.evaluationTime}>(evaluated in {evaluationResult()!.evaluationTime.toFixed(2)}ms)</span>
                </summary>
                <pre class={styles.dataContent}>
                  {JSON.stringify(evaluationResult()!.data, null, 2)}
                </pre>
              </details>
            </div>
          </Show>
        </div>
      </Show>
    )
  }
  
  // Preview always mode - always show preview (for edit forms)
  return (
    <div class={styles.alwaysContainer}>
      <Show when={props.template !== undefined}>
        <div class={styles.previewSection}>
          <div class={styles.previewHeader}>
            <span class={styles.previewTitle}>
              {hasEJS() ? 'EJS Preview' : 'Preview'}
            </span>
            <Show when={hasEJS() && evaluationResult()}>
              <span class={styles.evaluationTime}>
                ({evaluationResult()!.evaluationTime.toFixed(2)}ms)
              </span>
            </Show>
          </div>

          <Show when={evaluationResult()?.error}>
            <div class={styles.error}>
              <BsExclamationTriangle />
              <div class={styles.errorContent}>
                <pre class={styles.errorMessage}>{evaluationResult()!.error}</pre>
              </div>
            </div>
          </Show>

          <div class={styles.result}>
            {evaluationResult()?.result !== undefined && evaluationResult()?.result !== '' ? (
              evaluationResult()?.result
            ) : (
              <span class={styles.emptyPreview}>Empty description</span>
            )}
          </div>

          <Show when={hasEJS() && evaluationResult() && (props.showDataByDefault || Object.keys(evaluationResult()?.data || {}).length > 0)}>
            <details class={styles.dataDetails} open={props.showDataByDefault}>
              <summary class={styles.dataSummary}>
                Available Data
              </summary>
              <pre class={styles.dataContent}>
                {JSON.stringify(evaluationResult()?.data, null, 2)}
              </pre>
            </details>
          </Show>
        </div>
      </Show>
    </div>
  )
}