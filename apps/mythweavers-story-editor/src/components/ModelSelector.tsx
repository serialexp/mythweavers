import { Button, Modal } from '@mythweavers/ui'
import { BsArrowRepeat } from 'solid-icons/bs'
import { Component, For, Show, createSignal } from 'solid-js'
import { Model } from '../types/core'
import * as styles from './ModelSelector.css'

interface ModelSelectorProps {
  model: string
  setModel: (value: string) => void
  availableModels: Model[]
  isLoadingModels: boolean
  onRefreshModels: () => void
}

// Helper to compose class names
const cn = (...classes: (string | false | undefined | null)[]) => classes.filter(Boolean).join(' ')

export const ModelSelector: Component<ModelSelectorProps> = (props) => {
  const [showModal, setShowModal] = createSignal(false)

  const formatPrice = (price: number) => {
    return price.toFixed(2)
  }

  const getComparison = (model: Model, mobileOnly = false) => {
    // Find Sonnet cached price for comparison baseline
    const sonnetModel = props.availableModels.find(
      (m) =>
        m.name === 'anthropic/claude-3-5-sonnet-20241022' ||
        m.name === 'anthropic/claude-sonnet-4' ||
        (m.name.includes('anthropic/claude') && m.name.includes('sonnet')),
    )

    const sonnetBaselinePrice = sonnetModel?.pricing
      ? sonnetModel.pricing.input_cache_read || sonnetModel.pricing.input
      : null

    if (!sonnetBaselinePrice || !model.pricing || model.name === sonnetModel?.name) {
      return ''
    }

    const currentPrice = model.pricing.input_cache_read || model.pricing.input

    const percentage = (currentPrice / sonnetBaselinePrice) * 100

    if (mobileOnly) {
      return `${percentage.toFixed(0)}%`
    }

    if (percentage < 100) {
      return `${(100 - percentage).toFixed(0)}% cheaper`
    }
    if (percentage > 100) {
      return `${(percentage - 100).toFixed(0)}% more`
    }
    return 'Same price'
  }

  const selectModel = (modelName: string) => {
    props.setModel(modelName)
    setShowModal(false)
  }

  return (
    <div class={styles.container}>
      <div class={styles.modelDisplay} title={props.model}>
        {props.model || 'Select a model...'}
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setShowModal(true)}
        disabled={props.isLoadingModels}
      >
        Change
      </Button>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        onClick={props.onRefreshModels}
        disabled={props.isLoadingModels}
        title="Refresh models"
      >
        <BsArrowRepeat />
      </Button>

      <Modal
        open={showModal()}
        onClose={() => setShowModal(false)}
        title="Select Model"
        size="lg"
      >
        <Show
          when={props.availableModels.length > 0 && !props.isLoadingModels}
          fallback={<div class={styles.loadingMessage}>Loading models...</div>}
        >
          <div class={styles.table}>
            <div class={styles.tableHeader}>
              <div class={styles.colModel}>Model</div>
              <div class={styles.colPrice}>Price (1M)</div>
              <div class={styles.colPrice}>Cached</div>
              <div class={cn(styles.colComparison, styles.desktopComparison)}>vs Claude</div>
              <div class={styles.colContext}>Context</div>
            </div>
            <div class={styles.tableBody}>
              <For each={props.availableModels}>
                {(model) => (
                  <div
                    class={cn(styles.tableRow, props.model === model.name && styles.tableRowSelected)}
                    onClick={() => selectModel(model.name)}
                  >
                    <div class={styles.colModel} title={model.name}>
                      {model.name}
                    </div>
                    <div class={styles.colPrice}>
                      {model.pricing ? `$${formatPrice(model.pricing.input)}` : 'Free'}
                    </div>
                    <div class={styles.colPrice}>
                      {model.pricing?.input_cache_read ? `$${formatPrice(model.pricing.input_cache_read)}` : '-'}
                    </div>
                    <div class={cn(styles.colComparison, styles.desktopComparison)}>
                      {getComparison(model)}
                    </div>
                    <div class={cn(styles.colComparison, styles.mobileComparison)}>
                      {getComparison(model, true)}
                    </div>
                    <div class={styles.colContext}>
                      {model.context_length ? `${(model.context_length / 1000).toFixed(0)}k` : '-'}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </Modal>
    </div>
  )
}
