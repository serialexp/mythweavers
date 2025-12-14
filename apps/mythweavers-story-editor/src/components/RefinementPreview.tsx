import { Component, Show, For, createSignal, createEffect } from 'solid-js'
import { BsX, BsPlay, BsStop } from 'solid-icons/bs'
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
      const scrollPercentage = originalScrollRef.scrollTop / (originalScrollRef.scrollHeight - originalScrollRef.clientHeight)
      refinedScrollRef.scrollTop = scrollPercentage * (refinedScrollRef.scrollHeight - refinedScrollRef.clientHeight)
    } else if (source === 'refined' && originalScrollRef && refinedScrollRef) {
      const scrollPercentage = refinedScrollRef.scrollTop / (refinedScrollRef.scrollHeight - refinedScrollRef.clientHeight)
      originalScrollRef.scrollTop = scrollPercentage * (originalScrollRef.scrollHeight - originalScrollRef.clientHeight)
    }
    
    // Reset active scroller after a delay
    scrollTimeout = setTimeout(() => {
      activeScroller = null
      scrollTimeout = null
    }, 150)
  }

  return (
    <Show when={props.show}>
      <div class="modal-overlay" onClick={props.onClose}>
        <div class="refinement-preview-modal" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h3>Refinement Preview: {props.storyName}</h3>
            <button class="modal-close" onClick={props.onClose}><BsX /></button>
          </div>

          <div class="refinement-controls">
            <div class="model-selector-inline">
              <label>Model:</label>
              <select 
                value={selectedModel()} 
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={props.status === 'processing'}
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
            
            <div class="refinement-actions">
              <Show when={props.status === 'not_started' || props.status === 'failed'}>
                <button 
                  class="start-button"
                  onClick={() => props.onStartRefinement(selectedModel())}
                  disabled={!selectedModel()}
                >
                  <BsPlay /> Start Refinement
                </button>
              </Show>
              
              <Show when={props.status === 'processing'}>
                <button 
                  class="stop-button"
                  onClick={props.onStopRefinement}
                >
                  <BsStop /> Stop Refinement
                </button>
              </Show>
            </div>
          </div>

          <Show when={props.status !== 'not_started'}>
            <div class="refinement-progress-section">
              <div class="refinement-progress-bar">
                <div class="progress-fill" style={{ width: `${props.overallProgress}%` }} />
                <span class="progress-text">{props.overallProgress}% Complete</span>
              </div>
              <Show when={props.status === 'processing' && props.estimatedTimeRemaining}>
                <div class="timing-info">
                  <span>Est. time remaining: {formatTime(props.estimatedTimeRemaining)}</span>
                  <Show when={props.averageBatchTime}>
                    <span class="separator">•</span>
                    <span>Avg per batch: {formatTime(props.averageBatchTime)}</span>
                  </Show>
                </div>
              </Show>
            </div>
          </Show>

          <div class="refinement-content">
            <div class="batch-selector">
              <h4>Batches</h4>
              <div class="batch-list">
                <For each={props.batches}>
                  {(batch, index) => (
                    <button
                      class={`batch-button ${selectedBatch() === index() ? 'selected' : ''} ${batch.status}`}
                      onClick={() => setSelectedBatch(index())}
                      title={batch.duration ? `Completed in ${formatTime(batch.duration)}` : ''}
                    >
                      <div class="batch-button-content">
                        <span>Batch {batch.batchNumber}/{batch.totalBatches}</span>
                        <Show when={batch.status === 'processing'}>
                          <span class="processing-indicator">●</span>
                        </Show>
                        <Show when={batch.duration}>
                          <span class="batch-duration">{formatTime(batch.duration)}</span>
                        </Show>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </div>

            <Show when={currentBatch()} fallback={<div class="no-batch">No batches processed yet</div>}>
              <div class="comparison-view">
                <div class="comparison-column">
                  <h4>Original</h4>
                  <div 
                    class="text-content original"
                    ref={originalScrollRef}
                    onScroll={() => handleScroll('original')}
                  >
                    <For each={currentBatch()!.original}>
                      {(paragraph, index) => (
                        <p class="comparison-paragraph">
                          {paragraph}
                          <Show when={index() < currentBatch()!.original.length - 1}>
                            <br /><br />
                          </Show>
                        </p>
                      )}
                    </For>
                  </div>
                </div>

                <div class="comparison-column">
                  <div class="column-header">
                    <h4>Output</h4>
                    <div class="view-mode-toggle">
                      <button 
                        class={`toggle-btn ${viewMode() === 'refined' ? 'active' : ''}`}
                        onClick={() => setViewMode('refined')}
                      >
                        Refined
                      </button>
                      <button 
                        class={`toggle-btn ${viewMode() === 'criticism' ? 'active' : ''}`}
                        onClick={() => setViewMode('criticism')}
                        disabled={!currentBatch()?.criticism}
                      >
                        Criticism
                      </button>
                    </div>
                  </div>
                  <div 
                    class="text-content refined"
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
                              <div class="error-message">
                                Failed: {currentBatch()!.error || 'Unknown error'}
                              </div>
                            </Show>
                          }
                        >
                          <div class="processing-message">Processing...</div>
                        </Show>
                      }
                    >
                      <Show when={viewMode() === 'refined'} fallback={
                        <div class="criticism-content">
                          <Show when={currentBatch()!.criticism} fallback={
                            <p class="no-criticism">No criticism available for this batch.</p>
                          }>
                            <div class="criticism-text">
                              {currentBatch()!.criticism}
                            </div>
                          </Show>
                        </div>
                      }>
                        <For each={currentBatch()!.refined}>
                          {(paragraph, index) => (
                            <p class="comparison-paragraph">
                              {paragraph}
                              <Show when={index() < currentBatch()!.refined.length - 1}>
                                <br /><br />
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

          <div class="modal-footer">
            <Show when={props.status === 'completed'}>
              <p class="completion-message">
                Refinement complete! The refined story has been saved.
              </p>
            </Show>
            <Show when={props.status === 'failed'}>
              <p class="error-message">
                Refinement failed. Please check the console for details.
              </p>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}