import { Component, Show, createSignal, createEffect, For } from 'solid-js'
import { BsTrash, BsExclamationTriangle } from 'solid-icons/bs'
import { storyManager } from '../utils/storyManager'
import { storage } from '../utils/storage'
import styles from './StorageFullModal.module.css'

interface StorageFullModalProps {
  isOpen: boolean
  onClose: () => void
}

export const StorageFullModal: Component<StorageFullModalProps> = (props) => {
  const [savedStories, setSavedStories] = createSignal<Awaited<ReturnType<typeof storyManager.getSavedStories>>>([])
  const [storageInfo, setStorageInfo] = createSignal({ used: 0, total: 0 })
  const [deletedIds, setDeletedIds] = createSignal<Set<string>>(new Set())

  // Load saved stories and calculate storage
  createEffect(async () => {
    if (props.isOpen) {
      const stories = await storyManager.getSavedStories()
      setSavedStories(stories)
      
      // Calculate storage usage
      const { usedKB, totalKB } = await storyManager.getStorageInfo()
      setStorageInfo({ used: usedKB, total: totalKB })
      
      // Reset deleted IDs
      setDeletedIds(new Set<string>())
    }
  })

  const formatSize = (kb: number) => {
    if (kb < 1024) return `${kb.toFixed(0)} KB`
    return `${(kb / 1024).toFixed(1)} MB`
  }

  const handleDeleteStory = async (id: string) => {
    const success = await storyManager.deleteStory(id)
    if (success) {
      setDeletedIds(prev => new Set([...prev, id]))
      
      // Recalculate storage
      const info = await storyManager.getStorageInfo()
      setStorageInfo({ used: info.usedKB, total: info.totalKB })
    }
  }

  const handleClearCharacters = async () => {
    await storage.remove('story-characters')
    // Recalculate storage
    const { usedKB, totalKB } = await storyManager.getStorageInfo()
    setStorageInfo({ used: usedKB, total: totalKB })
  }

  const handleClearContextItems = async () => {
    await storage.remove('story-context-items')
    // Recalculate storage
    const { usedKB, totalKB } = await storyManager.getStorageInfo()
    setStorageInfo({ used: usedKB, total: totalKB })
  }

  const handleDone = () => {
    // Simply close the modal - the messages will be saved automatically
    // when the modal closes since storage space should now be available
    props.onClose()
  }

  return (
    <Show when={props.isOpen}>
      <div class={styles.modalOverlay}>
        <div class={styles.modal}>
          <div class={styles.header}>
            <BsExclamationTriangle class={styles.warningIcon} />
            <h2>Storage Full</h2>
          </div>

          <div class={styles.content}>
            <p class={styles.message}>
              Your browser's storage is full ({formatSize(storageInfo().total)} limit reached). 
              Please delete some items to continue saving your story.
              Note: The story will continue to save to the server if available.
            </p>

            <div class={styles.storageBar}>
              <div class={styles.storageUsed} style={{ width: `${(storageInfo().used / storageInfo().total) * 100}%` }} />
              <span class={styles.storageText}>
                {formatSize(storageInfo().used)} / {formatSize(storageInfo().total)} used
              </span>
            </div>

            <div class={styles.section}>
              <h3>Saved Stories</h3>
              <div class={styles.storyList}>
                <For each={savedStories().filter(s => !deletedIds().has(s.id))}>
                  {(story) => (
                    <div class={styles.storyItem}>
                      <div class={styles.storyInfo}>
                        <span class={styles.storyName}>{story.name}</span>
                        <span class={styles.storyMeta}>
                          {story.messageCount} messages • {new Date(story.savedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        class={styles.deleteButton}
                        onClick={() => handleDeleteStory(story.id)}
                        title="Delete this story"
                      >
                        <BsTrash />
                      </button>
                    </div>
                  )}
                </For>
                <Show when={savedStories().filter(s => !deletedIds().has(s.id)).length === 0}>
                  <p class={styles.emptyMessage}>No saved stories to delete</p>
                </Show>
              </div>
            </div>

            <div class={styles.section}>
              <h3>Other Data</h3>
              <div class={styles.otherActions}>
                <button
                  class={styles.actionButton}
                  onClick={handleClearCharacters}
                >
                  Clear Characters
                </button>
                <button
                  class={styles.actionButton}
                  onClick={handleClearContextItems}
                >
                  Clear Context Items
                </button>
              </div>
            </div>
          </div>

          <div class={styles.footer}>
            <button
              class={styles.doneButton}
              onClick={handleDone}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}