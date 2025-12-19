import { Button, IconButton, Modal, Stack } from '@mythweavers/ui'
import { BsExclamationTriangle, BsTrash } from 'solid-icons/bs'
import { Component, For, Show, createEffect, createSignal } from 'solid-js'
import { storage } from '../utils/storage'
import { storyManager } from '../utils/storyManager'

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
        <div style={{ display: 'flex', 'justify-content': 'center' }}>
          <BsExclamationTriangle size={48} color="#f59e0b" />
        </div>

        {/* Message */}
        <p
          style={{
            margin: '0',
            color: 'var(--text-secondary)',
            'line-height': '1.5',
            'text-align': 'center',
          }}
        >
          Your browser's storage is full ({formatSize(storageInfo().total)} limit reached). Please delete some items to
          continue saving your story. Note: The story will continue to save to the server if available.
        </p>

        {/* Storage Bar */}
        <div
          style={{
            position: 'relative',
            height: '24px',
            background: 'var(--bg-tertiary)',
            'border-radius': '12px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '0',
              left: '0',
              height: '100%',
              background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
              transition: 'width 0.3s ease',
              width: `${(storageInfo().used / storageInfo().total) * 100}%`,
            }}
          />
          <span
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              'font-size': '0.875rem',
              'font-weight': '500',
              color: 'var(--text-primary)',
              'z-index': '1',
            }}
          >
            {formatSize(storageInfo().used)} / {formatSize(storageInfo().total)} used
          </span>
        </div>

        {/* Saved Stories Section */}
        <div>
          <h3 style={{ margin: '0 0 12px 0', 'font-size': '1.125rem', color: 'var(--text-primary)' }}>Saved Stories</h3>
          <div
            style={{
              display: 'flex',
              'flex-direction': 'column',
              gap: '8px',
              'max-height': '300px',
              'overflow-y': 'auto',
              padding: '4px',
            }}
          >
            <For each={savedStories().filter((s) => !deletedIds().has(s.id))}>
              {(story) => (
                <div
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content': 'space-between',
                    padding: '12px',
                    background: 'var(--bg-secondary)',
                    'border-radius': '8px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px', 'min-width': '0' }}>
                    <span
                      style={{
                        'font-weight': '500',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        'text-overflow': 'ellipsis',
                        'white-space': 'nowrap',
                      }}
                    >
                      {story.name}
                    </span>
                    <span style={{ 'font-size': '0.75rem', color: 'var(--text-secondary)' }}>
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
              <p style={{ 'text-align': 'center', color: 'var(--text-secondary)', padding: '20px' }}>
                No saved stories to delete
              </p>
            </Show>
          </div>
        </div>

        {/* Other Data Section */}
        <div>
          <h3 style={{ margin: '0 0 12px 0', 'font-size': '1.125rem', color: 'var(--text-primary)' }}>Other Data</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
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
