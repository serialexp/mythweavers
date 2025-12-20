import { Button, IconButton, Modal, Stack } from '@mythweavers/ui'
import { BsExclamationTriangle, BsTrash } from 'solid-icons/bs'
import { Component, For, Show, createEffect, createSignal } from 'solid-js'
import { storage } from '../utils/storage'
import { storyManager } from '../utils/storyManager'
import * as styles from './StorageFullModal.css'

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
      setDeletedIds((prev) => new Set([...prev, id]))

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
    <Modal
      open={props.isOpen}
      onClose={props.onClose}
      title="Storage Full"
      size="lg"
      footer={
        <Button variant="primary" onClick={handleDone}>
          Done
        </Button>
      }
    >
      <Stack gap="md">
        {/* Warning Icon */}
        <div class={styles.warningIconContainer}>
          <BsExclamationTriangle size={48} color="#f59e0b" />
        </div>

        {/* Message */}
        <p class={styles.message}>
          Your browser's storage is full ({formatSize(storageInfo().total)} limit reached). Please delete some items to
          continue saving your story. Note: The story will continue to save to the server if available.
        </p>

        {/* Storage Bar */}
        <div class={styles.storageBar}>
          <div
            class={styles.storageBarFill}
            style={{ width: `${(storageInfo().used / storageInfo().total) * 100}%` }}
          />
          <span class={styles.storageBarLabel}>
            {formatSize(storageInfo().used)} / {formatSize(storageInfo().total)} used
          </span>
        </div>

        {/* Saved Stories Section */}
        <div>
          <h3 class={styles.sectionHeader}>Saved Stories</h3>
          <div class={styles.storyListContainer}>
            <For each={savedStories().filter((s) => !deletedIds().has(s.id))}>
              {(story) => (
                <div class={styles.storyItem}>
                  <div class={styles.storyItemContent}>
                    <span class={styles.storyName}>{story.name}</span>
                    <span class={styles.storyMeta}>
                      {story.messageCount} messages • {new Date(story.savedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <IconButton
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteStory(story.id)}
                    aria-label="Delete this story"
                  >
                    <BsTrash />
                  </IconButton>
                </div>
              )}
            </For>
            <Show when={savedStories().filter((s) => !deletedIds().has(s.id)).length === 0}>
              <p class={styles.emptyMessage}>No saved stories to delete</p>
            </Show>
          </div>
        </div>

        {/* Other Data Section */}
        <div>
          <h3 class={styles.sectionHeader}>Other Data</h3>
          <div class={styles.otherDataButtons}>
            <Button variant="secondary" onClick={handleClearCharacters}>
              Clear Characters
            </Button>
            <Button variant="secondary" onClick={handleClearContextItems}>
              Clear Context Items
            </Button>
          </div>
        </div>
      </Stack>
    </Modal>
  )
}
