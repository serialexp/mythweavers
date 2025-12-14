import { Component, Show, For, createSignal } from 'solid-js'
import { Model } from '../types/core'

interface ModelSelectorProps {
  model: string
  setModel: (value: string) => void
  availableModels: Model[]
  isLoadingModels: boolean
  onRefreshModels: () => void
}

export const ModelSelector: Component<ModelSelectorProps> = (props) => {
  const [showModal, setShowModal] = createSignal(false)

  const formatPrice = (price: number) => {
    return price.toFixed(2)
  }

  const getComparison = (model: Model, mobileOnly: boolean = false) => {
    // Find Sonnet cached price for comparison baseline
    const sonnetModel = props.availableModels.find(m => 
      m.name === 'anthropic/claude-3-5-sonnet-20241022' || 
      m.name === 'anthropic/claude-sonnet-4' ||
      m.name.includes('anthropic/claude') && m.name.includes('sonnet')
    )
    
    const sonnetBaselinePrice = sonnetModel?.pricing ? 
      (sonnetModel.pricing.input_cache_read || sonnetModel.pricing.input) : null

    if (!sonnetBaselinePrice || !model.pricing || model.name === sonnetModel?.name) {
      return ''
    }

    const currentPrice = model.pricing.input_cache_read || model.pricing.input
    
    const percentage = ((currentPrice / sonnetBaselinePrice) * 100)
    
    if (mobileOnly) {
      return `${percentage.toFixed(0)}%`
    }
    
    if (percentage < 100) {
      return `${(100 - percentage).toFixed(0)}% cheaper`
    } else if (percentage > 100) {
      return `${(percentage - 100).toFixed(0)}% more`
    }
    return 'Same price'
  }

  const selectModel = (modelName: string) => {
    props.setModel(modelName)
    setShowModal(false)
  }

  return (
    <div class="model-selector">
      <div class="model-input-group">
        <input
          type="text"
          value={props.model || 'Select a model...'}
          readonly
          class="model-input"
          placeholder="Select a model..."
        />
        <button
          onClick={() => setShowModal(true)}
          class="model-select-button"
          disabled={props.isLoadingModels}
        >
          Change
        </button>
        <button
          onClick={props.onRefreshModels}
          class="refresh-button"
          disabled={props.isLoadingModels}
          title="Refresh models"
        >
          ↻
        </button>
      </div>

      <Show when={showModal()}>
        <div class="modal-overlay" onClick={() => setShowModal(false)}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Select Model</h3>
              <button class="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <Show when={props.availableModels.length > 0 && !props.isLoadingModels} fallback={
              <div class="modal-body">
                <div class="loading-message">Loading models...</div>
              </div>
            }>
              <div class="modal-body">
                <div class="model-table">
                  <div class="model-table-header">
                    <div class="col-model">Model</div>
                    <div class="col-price">Price (1M tokens)</div>
                    <div class="col-cache">Cached</div>
                    <div class="col-comparison">vs Claude</div>
                    <div class="col-context">Context</div>
                  </div>
                  <div class="model-table-body">
                    <For each={props.availableModels}>
                      {(model) => (
                        <div 
                          class={`model-row ${props.model === model.name ? 'selected' : ''}`}
                          onClick={() => selectModel(model.name)}
                        >
                          <div class="col-model" title={model.name}>{model.name}</div>
                          <div class="col-price">
                            {model.pricing ? `$${formatPrice(model.pricing.input)}` : 'Free'}
                          </div>
                          <div class="col-cache">
                            {model.pricing?.input_cache_read ? `$${formatPrice(model.pricing.input_cache_read)}` : '-'}
                          </div>
                          <div class="col-comparison">
                            {getComparison(model)}
                          </div>
                          <div class="col-comparison-mobile">
                            {getComparison(model, true)}
                          </div>
                          <div class="col-context">
                            {model.context_length ? `${(model.context_length / 1000).toFixed(0)}k` : '-'}
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}