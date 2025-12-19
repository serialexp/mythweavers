import { Alert, Button, Card, CardBody } from '@mythweavers/ui'
import { BsExclamationTriangle, BsEye, BsEyeSlash } from 'solid-icons/bs'
import { Component, Show, createMemo, createSignal } from 'solid-js'
import { useContextMessage } from '../hooks/useContextMessage'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { getTemplatePreview } from '../utils/scriptEngine'

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

  const dataDetailsStyle = {
    'margin-top': '0.75rem',
    background: 'var(--bg-tertiary)',
    'border-radius': 'var(--radius-sm)',
    padding: '0.5rem',
  }

  const dataSummaryStyle = {
    cursor: 'pointer',
    'font-size': '0.85rem',
    color: 'var(--text-secondary)',
    'font-weight': '500',
  }

  const dataContentStyle = {
    'margin-top': '0.5rem',
    'font-family': 'monospace',
    'font-size': '0.8rem',
    'white-space': 'pre-wrap' as const,
    color: 'var(--text-primary)',
    'max-height': '200px',
    'overflow-y': 'auto' as const,
  }

  // Inline mode - just display the evaluated text
  if (mode() === 'inline') {
    const result = evaluationResult()
    return (
      <span class={props.fallbackClassName} style={{ color: 'var(--text-primary)' }}>
        {result?.error ? props.template : result?.result}
      </span>
    )
  }

  // Preview toggle mode - show/hide preview with a button
  if (mode() === 'preview-toggle') {
    return (
      <Show when={hasEJS()}>
        <div style={{ 'margin-top': '0.5rem' }}>
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
            <Card style={{ 'margin-top': '0.5rem' }}>
              <CardBody padding="sm">
                <Show when={evaluationResult()!.error}>
                  <Alert variant="error" style={{ 'margin-bottom': '0.5rem' }}>
                    <BsExclamationTriangle /> {evaluationResult()!.error}
                  </Alert>
                </Show>

                <div>
                  <div style={{ 'font-size': '0.85rem', color: 'var(--text-secondary)', 'margin-bottom': '0.25rem' }}>
                    Preview:
                  </div>
                  <div style={{ color: 'var(--text-primary)', 'line-height': '1.5' }}>{evaluationResult()!.result}</div>
                </div>

                <details style={dataDetailsStyle}>
                  <summary style={dataSummaryStyle}>
                    Available Data{' '}
                    <span style={{ color: 'var(--text-muted)', 'font-size': '0.8rem' }}>
                      (evaluated in {evaluationResult()!.evaluationTime.toFixed(2)}ms)
                    </span>
                  </summary>
                  <pre style={dataContentStyle}>{JSON.stringify(evaluationResult()!.data, null, 2)}</pre>
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
    <div style={{ 'margin-top': '0.75rem' }}>
      <Show when={props.template !== undefined}>
        <Card variant="flat">
          <CardBody padding="sm">
            <div
              style={{
                display: 'flex',
                'justify-content': 'space-between',
                'align-items': 'center',
                'margin-bottom': '0.5rem',
              }}
            >
              <span style={{ 'font-weight': '600', color: 'var(--text-primary)', 'font-size': '0.9rem' }}>
                {hasEJS() ? 'EJS Preview' : 'Preview'}
              </span>
              <Show when={hasEJS() && evaluationResult()}>
                <span style={{ color: 'var(--text-muted)', 'font-size': '0.8rem' }}>
                  ({evaluationResult()!.evaluationTime.toFixed(2)}ms)
                </span>
              </Show>
            </div>

            <Show when={evaluationResult()?.error}>
              <Alert variant="error" style={{ 'margin-bottom': '0.5rem' }}>
                <BsExclamationTriangle /> {evaluationResult()!.error}
              </Alert>
            </Show>

            <div style={{ color: 'var(--text-primary)', 'line-height': '1.5', 'min-height': '1.5em' }}>
              {evaluationResult()?.result !== undefined && evaluationResult()?.result !== '' ? (
                evaluationResult()?.result
              ) : (
                <span style={{ color: 'var(--text-muted)', 'font-style': 'italic' }}>Empty description</span>
              )}
            </div>

            <Show
              when={
                hasEJS() &&
                evaluationResult() &&
                (props.showDataByDefault || Object.keys(evaluationResult()?.data || {}).length > 0)
              }
            >
              <details style={dataDetailsStyle} open={props.showDataByDefault}>
                <summary style={dataSummaryStyle}>Available Data</summary>
                <pre style={dataContentStyle}>{JSON.stringify(evaluationResult()?.data, null, 2)}</pre>
              </details>
            </Show>
          </CardBody>
        </Card>
      </Show>
    </div>
  )
}
