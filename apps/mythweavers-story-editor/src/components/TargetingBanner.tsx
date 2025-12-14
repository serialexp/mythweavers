import { Component } from 'solid-js'
import { uiStore } from '../stores/uiStore'
import { BsX } from 'solid-icons/bs'
import styles from './TargetingBanner.module.css'

export const TargetingBanner: Component = () => {
  const handleCancel = () => {
    uiStore.cancelTargeting()
  }

  return (
    <div class={styles.banner}>
      <div class={styles.content}>
        <span class={styles.icon}>🎯</span>
        <div class={styles.text}>
          <strong>Targeting Mode Active</strong>
          <p>Click "Set as Target" on any message to set it as the branch target</p>
        </div>
      </div>
      <button
        class={styles.cancelButton}
        onClick={handleCancel}
        title="Cancel targeting"
      >
        <BsX size={24} /> Cancel
      </button>
    </div>
  )
}
