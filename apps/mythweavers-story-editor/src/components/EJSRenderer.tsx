import { Alert, Button, Card, CardBody } from '@mythweavers/ui'
import { BsExclamationTriangle, BsEye, BsEyeSlash } from 'solid-icons/bs'
import { Component, Show, createMemo, createSignal } from 'solid-js'
import { useContextMessage } from '../hooks/useContextMessage'
import { charactersStore } from '../stores/charactersStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { getTemplatePreview } from '../utils/scriptEngine'
import * as styles from './EJSRenderer.css'

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
    // Track character data changes (especially birthdates) to re-evaluate when they change
    // This is needed because character data is used in script context
    charactersStore.characters.forEach((c) => {
      c.birthdate
      c.isMainCharacter
    })

    if (!props.template) {
      return {
        result: '',
        data: {},
        error: null,
        evaluationTime: 0,
      }
    }

    // For inline mode without EJS, just return the template
    if (mode() === 'inline' && !hasEJS()) {
      return {
        result: props.template,
        data: {},
        error: null,
        evaluationTime: 0,
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
        evaluationTime: 0,
      }
    }

    // If no EJS tags, just return the template as-is
    if (!hasEJS()) {
      return {
        result: props.template,
        data: {},
        error: null,
        evaluationTime: 0,
      }
    }

    // Measure evaluation time and evaluate the template
    const startTime = performance.now()
    const previewResult = getTemplatePreview(
      props.template,
      messagesStore.messages,
      messageId,
      nodeStore.nodesArray,
      currentStoryStore.globalScript,
    )
    const endTime = performance.now()
    const evaluationTime = endTime - startTime

    return {
      ...previewResult,
      evaluationTime,
    }
  })

  // Inline mode - just display the evaluated text
  if (mode() === 'inline') {
    const result = evaluationResult()
    return (
      <span class={`${props.fallbackClassName || ''} ${styles.inlineText}`}>
        {result?.error ? props.template : result?.result}
      </span>
    )
  }

  // Preview toggle mode - show/hide preview with a button
  if (mode() === 'preview-toggle') {
    return (
      <Show when={hasEJS()}>
        <div class={styles.toggleContainer}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview())}
            title={showPreview() ? 'Hide EJS preview' : 'Show EJS preview'}
          >
            <Show when={showPreview()} fallback={<BsEye />}>
              <BsEyeSlash />
            </Show>
            {props.title || 'EJS Preview'}
          </Button>

          <Show when={showPreview() && evaluationResult()}>
            <Card class={styles.cardMargin}>
              <CardBody padding="sm">
                <Show when={evaluationResult()!.error}>
                  <Alert variant="error" class={styles.alertMargin}>
                    <BsExclamationTriangle /> {evaluationResult()!.error}
                  </Alert>
                </Show>

                <div>
                  <div class={styles.previewLabel}>
                    Preview:
                  </div>
                  <div class={styles.previewText}>{evaluationResult()!.result}</div>
                </div>

                <details class={styles.dataDetails}>
                  <summary class={styles.dataSummary}>
                    Available Data{' '}
                    <span class={styles.evalTime}>
                      (evaluated in {evaluationResult()!.evaluationTime.toFixed(2)}ms)
                    </span>
                  </summary>
                  <pre class={styles.dataContent}>{JSON.stringify(evaluationResult()!.data, null, 2)}</pre>
                </details>
              </CardBody>
            </Card>
          </Show>
        </div>
      </Show>
    )
  }

  // Preview always mode - always show preview (for edit forms)
  return (
    <div class={styles.previewAlwaysContainer}>
      <Show when={props.template !== undefined}>
        <Card variant="flat">
          <CardBody padding="sm">
            <div class={styles.previewHeader}>
              <span class={styles.previewTitle}>
                {hasEJS() ? 'EJS Preview' : 'Preview'}
              </span>
              <Show when={hasEJS() && evaluationResult()}>
                <span class={styles.evalTime}>
                  ({evaluationResult()!.evaluationTime.toFixed(2)}ms)
                </span>
              </Show>
            </div>

            <Show when={evaluationResult()?.error}>
              <Alert variant="error" class={styles.alertMargin}>
                <BsExclamationTriangle /> {evaluationResult()!.error}
              </Alert>
            </Show>

            <div class={styles.previewContent}>
              {evaluationResult()?.result !== undefined && evaluationResult()?.result !== '' ? (
                evaluationResult()?.result
              ) : (
                <span class={styles.emptyPlaceholder}>Empty description</span>
              )}
            </div>

            <Show
              when={
                hasEJS() &&
                evaluationResult() &&
                (props.showDataByDefault || Object.keys(evaluationResult()?.data || {}).length > 0)
              }
            >
              <details class={styles.dataDetails} open={props.showDataByDefault}>
                <summary class={styles.dataSummary}>Available Data</summary>
                <pre class={styles.dataContent}>{JSON.stringify(evaluationResult()?.data, null, 2)}</pre>
              </details>
            </Show>
          </CardBody>
        </Card>
      </Show>
    </div>
  )
}
