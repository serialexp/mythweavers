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

export const ModelSelector: Component<ModelSelectorProps> = (props) => {
  const [showModal, setShowModal] = createSignal(false)

  const formatPrice = (price: number) => {
    return price.toFixed(2)
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
          <div class={styles.tableWrapper}>
            <div class={styles.table}>
              <div class={styles.tableHeader}>
                <div class={styles.colModel}>Model</div>
                <div class={styles.colPrice}>Price (1M)</div>
                <div class={styles.colPrice}>Cached</div>
                <div class={styles.colContext}>Context</div>
              </div>
              <div class={styles.tableBody}>
                <For each={props.availableModels}>
                  {(model) => (
                    <div
                      class={`${styles.tableRow} ${props.model === model.name ? styles.tableRowSelected : ''}`}
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
                      <div class={styles.colContext}>
                        {model.context_length ? `${(model.context_length / 1000).toFixed(0)}k` : '-'}
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </Show>
      </Modal>
    </div>
  )
}
