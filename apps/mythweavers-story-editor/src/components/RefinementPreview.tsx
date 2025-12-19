import { Alert, Button, Modal } from '@mythweavers/ui'
import { BsPlay, BsStop } from 'solid-icons/bs'
import { Component, For, Show, createEffect, createSignal } from 'solid-js'
import { Model } from '../types/core'

export interface RefinementBatch {
  batchNumber: number
  totalBatches: number
  original: string[]
  refined: string[]
  criticism?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  startTime?: number
  endTime?: number
  duration?: number
}

interface RefinementPreviewProps {
  storyName: string
  storyId?: string
  show: boolean
  onClose: () => void
  batches: RefinementBatch[]
  overallProgress: number
  status: 'not_started' | 'processing' | 'completed' | 'failed'
  availableModels: Model[]
  currentModel: string
  onStartRefinement: (model: string) => void
  onStopRefinement: () => void
  estimatedTimeRemaining?: number
  averageBatchTime?: number
}

export const RefinementPreview: Component<RefinementPreviewProps> = (props) => {
  const [selectedBatch, setSelectedBatch] = createSignal(0)
  const [selectedModel, setSelectedModel] = createSignal(props.currentModel)
  const [viewMode, setViewMode] = createSignal<'refined' | 'criticism'>('refined')
  let originalScrollRef: HTMLDivElement | undefined
  let refinedScrollRef: HTMLDivElement | undefined
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null
  let activeScroller: 'original' | 'refined' | null = null

  // Update selected model when props change
  createEffect(() => {
    setSelectedModel(props.currentModel)
  })

  const currentBatch = () => props.batches[selectedBatch()]

  // Format time in human readable format
  const formatTime = (seconds: number | undefined): string => {
    if (!seconds || seconds < 0) return '--'
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    if (minutes === 0) return `${secs}s`
    return `${minutes}m ${secs}s`
  }

  // Synchronized scrolling handler
  const handleScroll = (source: 'original' | 'refined') => {
    // If we're already processing a scroll from the other side, ignore
    if (activeScroller && activeScroller !== source) return

    // Set the active scroller
    activeScroller = source

    // Clear any existing timeout
    if (scrollTimeout) {
      clearTimeout(scrollTimeout)
    }

    // Sync the scroll positions
    if (source === 'original' && originalScrollRef && refinedScrollRef) {
      const scrollPercentage =
        originalScrollRef.scrollTop / (originalScrollRef.scrollHeight - originalScrollRef.clientHeight)
      refinedScrollRef.scrollTop = scrollPercentage * (refinedScrollRef.scrollHeight - refinedScrollRef.clientHeight)
    } else if (source === 'refined' && originalScrollRef && refinedScrollRef) {
      const scrollPercentage =
        refinedScrollRef.scrollTop / (refinedScrollRef.scrollHeight - refinedScrollRef.clientHeight)
      originalScrollRef.scrollTop = scrollPercentage * (originalScrollRef.scrollHeight - originalScrollRef.clientHeight)
    }

    // Reset active scroller after a delay
    scrollTimeout = setTimeout(() => {
      activeScroller = null
      scrollTimeout = null
    }, 150)
  }

  const getBatchStyle = (batch: RefinementBatch, isSelected: boolean) => {
    const base: Record<string, string> = {
      padding: '0.5rem',
      border: '1px solid var(--border-color)',
      background: 'var(--bg-secondary)',
      'border-radius': '4px',
      cursor: 'pointer',
      'text-align': 'left',
      transition: 'all 0.2s',
      width: '100%',
    }
    if (isSelected) {
      base.background = 'var(--secondary-color)'
      base.color = 'black'
      base['border-color'] = '#6f42c1'
    }
    if (batch.status === 'processing') {
      base['border-color'] = '#ffc107'
      base.background = '#fff3cd'
    }
    if (batch.status === 'completed') {
      base['border-color'] = '#28a745'
    }
    if (batch.status === 'failed') {
      base['border-color'] = '#dc3545'
      base.background = '#f8d7da'
    }
    return base
  }

  return (
    <Modal open={props.show} onClose={props.onClose} title={`Refinement Preview: ${props.storyName}`} size="xl">
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          padding: '1rem',
          'border-bottom': '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
          <label style={{ 'font-weight': '600', color: 'var(--text-primary)' }}>Model:</label>
          <select
            value={selectedModel()}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={props.status === 'processing'}
            style={{
              padding: '0.5rem',
              border: '1px solid var(--border-color)',
              'border-radius': '4px',
              'font-size': '0.9rem',
              'min-width': '200px',
            }}
          >
            <For each={props.availableModels}>
              {(model) => (
                <option value={model.name}>
                  {model.name}
                  {model.context_length && ` (${(model.context_length / 1000).toFixed(0)}k ctx)`}
                </option>
              )}
            </For>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Show when={props.status === 'not_started' || props.status === 'failed'}>
            <Button
              variant="primary"
              onClick={() => props.onStartRefinement(selectedModel())}
              disabled={!selectedModel()}
            >
              <BsPlay /> Start Refinement
            </Button>
          </Show>

          <Show when={props.status === 'processing'}>
            <Button variant="danger" onClick={props.onStopRefinement}>
              <BsStop /> Stop Refinement
            </Button>
          </Show>
        </div>
      </div>

      <Show when={props.status !== 'not_started'}>
        <div style={{ 'border-bottom': '1px solid var(--border-color)' }}>
          <div style={{ height: '30px', background: '#f0f0f0', position: 'relative', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #6f42c1, #8b5cf6)',
                transition: 'width 0.3s ease',
                width: `${props.overallProgress}%`,
              }}
            />
            <span
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                'font-weight': 'bold',
                color: 'var(--text-primary)',
              }}
            >
              {props.overallProgress}% Complete
            </span>
          </div>
          <Show when={props.status === 'processing' && props.estimatedTimeRemaining}>
            <div
              style={{
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                gap: '1rem',
                padding: '0.5rem',
                background: 'var(--bg-secondary)',
                'font-size': '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              <span>Est. time remaining: {formatTime(props.estimatedTimeRemaining)}</span>
              <Show when={props.averageBatchTime}>
                <span style={{ color: '#ccc' }}>•</span>
                <span>Avg per batch: {formatTime(props.averageBatchTime)}</span>
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: '1rem',
          padding: '1rem',
          overflow: 'hidden',
          'max-height': 'calc(80vh - 250px)',
        }}
      >
        <div style={{ width: '200px', display: 'flex', 'flex-direction': 'column', gap: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Batches</h4>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.5rem', 'overflow-y': 'auto' }}>
            <For each={props.batches}>
              {(batch, index) => (
                <button
                  style={getBatchStyle(batch, selectedBatch() === index())}
                  onClick={() => setSelectedBatch(index())}
                  title={batch.duration ? `Completed in ${formatTime(batch.duration)}` : ''}
                >
                  <div
                    style={{
                      display: 'flex',
                      'align-items': 'center',
                      'justify-content': 'space-between',
                      gap: '0.5rem',
                      width: '100%',
                    }}
                  >
                    <span>
                      Batch {batch.batchNumber}/{batch.totalBatches}
                    </span>
                    <Show when={batch.status === 'processing'}>
                      <span
                        style={{
                          color: 'var(--warning-color)',
                          animation: 'pulse 1s infinite',
                          'margin-left': '0.25rem',
                        }}
                      >
                        ●
                      </span>
                    </Show>
                    <Show when={batch.duration}>
                      <span
                        style={{
                          'font-size': '0.75rem',
                          color: 'var(--text-secondary)',
                          'font-weight': 'normal',
                          'margin-left': 'auto',
                        }}
                      >
                        {formatTime(batch.duration)}
                      </span>
                    </Show>
                  </div>
                </button>
              )}
            </For>
          </div>
        </div>

        <Show
          when={currentBatch()}
          fallback={
            <div style={{ 'text-align': 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No batches processed yet
            </div>
          }
        >
          <div
            style={{ flex: 1, display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '1rem', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.5rem' }}>
              <h4 style={{ margin: 0, padding: '0.5rem', background: 'var(--bg-secondary)', 'border-radius': '4px' }}>
                Original
              </h4>
              <div
                style={{
                  flex: 1,
                  padding: '1rem',
                  border: '1px solid var(--border-color)',
                  'border-radius': '4px',
                  'overflow-y': 'auto',
                  background: '#fff5f5',
                  'line-height': '1.6',
                  'max-height': 'calc(80vh - 360px)',
                }}
                ref={originalScrollRef}
                onScroll={() => handleScroll('original')}
              >
                <For each={currentBatch()!.original}>
                  {(paragraph, index) => (
                    <p style={{ margin: 0, 'text-align': 'justify' }}>
                      {paragraph}
                      <Show when={index() < currentBatch()!.original.length - 1}>
                        <br />
                        <br />
                      </Show>
                    </p>
                  )}
                </For>
              </div>
            </div>

            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'space-between',
                  padding: '0.5rem',
                  background: 'var(--bg-secondary)',
                  'border-radius': '4px',
                }}
              >
                <h4 style={{ margin: 0 }}>Output</h4>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.25rem',
                    background: 'var(--bg-tertiary)',
                    padding: '0.25rem',
                    'border-radius': '4px',
                  }}
                >
                  <button
                    style={{
                      padding: '0.25rem 0.75rem',
                      border: 'none',
                      background: viewMode() === 'refined' ? 'white' : 'transparent',
                      color: viewMode() === 'refined' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      'font-size': '0.85rem',
                      cursor: 'pointer',
                      'border-radius': '3px',
                      transition: 'all 0.2s',
                      'box-shadow': viewMode() === 'refined' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                    }}
                    onClick={() => setViewMode('refined')}
                  >
                    Refined
                  </button>
                  <button
                    style={{
                      padding: '0.25rem 0.75rem',
                      border: 'none',
                      background: viewMode() === 'criticism' ? 'white' : 'transparent',
                      color: viewMode() === 'criticism' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      'font-size': '0.85rem',
                      cursor: !currentBatch()?.criticism ? 'not-allowed' : 'pointer',
                      'border-radius': '3px',
                      transition: 'all 0.2s',
                      opacity: !currentBatch()?.criticism ? '0.5' : '1',
                      'box-shadow': viewMode() === 'criticism' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                    }}
                    onClick={() => setViewMode('criticism')}
                    disabled={!currentBatch()?.criticism}
                  >
                    Criticism
                  </button>
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: '1rem',
                  border: '1px solid var(--border-color)',
                  'border-radius': '4px',
                  'overflow-y': 'auto',
                  background: '#f5fff5',
                  'line-height': '1.6',
                  'max-height': 'calc(80vh - 360px)',
                }}
                ref={refinedScrollRef}
                onScroll={() => handleScroll('refined')}
              >
                <Show
                  when={currentBatch()!.status === 'completed'}
                  fallback={
                    <Show
                      when={currentBatch()!.status === 'processing'}
                      fallback={
                        <Show when={currentBatch()!.status === 'failed'}>
                          <Alert variant="error">Failed: {currentBatch()!.error || 'Unknown error'}</Alert>
                        </Show>
                      }
                    >
                      <div
                        style={{
                          'text-align': 'center',
                          padding: '2rem',
                          color: 'var(--text-secondary)',
                          'font-style': 'italic',
                        }}
                      >
                        Processing...
                      </div>
                    </Show>
                  }
                >
                  <Show
                    when={viewMode() === 'refined'}
                    fallback={
                      <div>
                        <Show
                          when={currentBatch()!.criticism}
                          fallback={
                            <p
                              style={{ 'text-align': 'center', color: '#999', 'font-style': 'italic', padding: '2rem' }}
                            >
                              No criticism available for this batch.
                            </p>
                          }
                        >
                          <div
                            style={{
                              'white-space': 'pre-wrap',
                              'line-height': '1.8',
                              color: '#444',
                              'font-style': 'italic',
                            }}
                          >
                            {currentBatch()!.criticism}
                          </div>
                        </Show>
                      </div>
                    }
                  >
                    <For each={currentBatch()!.refined}>
                      {(paragraph, index) => (
                        <p style={{ margin: 0, 'text-align': 'justify' }}>
                          {paragraph}
                          <Show when={index() < currentBatch()!.refined.length - 1}>
                            <br />
                            <br />
                          </Show>
                        </p>
                      )}
                    </For>
                  </Show>
                </Show>
              </div>
            </div>
          </div>
        </Show>
      </div>

      <div style={{ padding: '1rem', 'border-top': '1px solid var(--border-color)', 'text-align': 'center' }}>
        <Show when={props.status === 'completed'}>
          <p style={{ color: 'var(--success-color)', margin: 0 }}>
            Refinement complete! The refined story has been saved.
          </p>
        </Show>
        <Show when={props.status === 'failed'}>
          <Alert variant="error">Refinement failed. Please check the console for details.</Alert>
        </Show>
      </div>
    </Modal>
  )
}
