import { Component, For, Show, createSignal } from 'solid-js'
import { BsCloudFill, BsHddFill, BsTrash, BsPencil, BsServer, BsFilePdf, BsStars, BsExclamationTriangle } from 'solid-icons/bs'
import { storyManager } from '../utils/storyManager'
import { currentStoryStore } from '../stores/currentStoryStore'
import styles from './StoryList.module.css'

export interface StoryListItem {
  id: string
  name: string
  savedAt: Date
  updatedAt?: string
  messageCount: number
  characterCount: number
  chapterCount: number
  storySetting?: string
  type: 'local' | 'server'
  isCurrentStory: boolean
  hasLocalDifferences?: boolean // True if local version differs from server
}

interface StoryListProps {
  stories: StoryListItem[]
  onLoadStory: (storyId: string, type: 'local' | 'server') => void | Promise<void>
  onDeleteStory?: (storyId: string, type: 'local' | 'server') => void
  onExportPdf?: (storyId: string) => void
  onRefineStory?: (storyId: string) => void
  onSyncToServer?: (storyId: string) => void
  onRename?: () => void
  syncing?: string | null
  refining?: string | null
  editingEnabled?: boolean
  serverAvailable?: boolean
}

export const StoryList: Component<StoryListProps> = (props) => {
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editingName, setEditingName] = createSignal('')
  const [loadingId, setLoadingId] = createSignal<string | null>(null)

  const startEditing = (id: string, currentName: string) => {
    console.log('Starting edit for story:', id, currentName)
    setEditingId(id)
    setEditingName(currentName)
    // Focus the input after a short delay to ensure it's rendered
    setTimeout(() => {
      const input = document.querySelector(`.${styles.storyNameEdit}`) as HTMLInputElement
      if (input) {
        input.focus()
        input.select()
      }
    }, 50)
  }

  const saveRename = async () => {
    const id = editingId()
    const newName = editingName().trim()
    if (!id || !newName) return
    
    const story = props.stories.find(s => s.id === id)
    if (!story) return
    
    // Use storyManager for both local and server stories
    const success = await storyManager.renameStory(id, newName, story.type)
    if (!success) {
      alert('Failed to rename story')
      cancelEdit()
      return
    }
    
    // If this is the current story, update its name
    if (id === currentStoryStore.id) {
      currentStoryStore.setName(newName, false)
    }
    
    setEditingId(null)
    
    // Refresh the story list
    if (props.onRename) {
      props.onRename()
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const formatDate = (date: Date) => {
    // Check if mobile based on screen width
    const isMobile = window.innerWidth <= 768

    if (isMobile) {
      // Shorter format for mobile: "Jan 5" or "Jan 5 '24" for older dates
      const now = new Date()
      const isCurrentYear = date.getFullYear() === now.getFullYear()

      if (isCurrentYear) {
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric'
        })
      } else {
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: '2-digit'
        })
      }
    } else {
      // Full format for desktop
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }
  }

  return (
    <div class={styles.storyList}>
      <For each={props.stories}>
        {(story) => (
          <div
            class={`${styles.storyItem} ${story.isCurrentStory ? styles.currentStory : ''} ${loadingId() === story.id ? styles.loading : ''}`}
            onClick={async () => {
              if (!editingId() && loadingId() !== story.id) {
                setLoadingId(story.id)
                try {
                  await props.onLoadStory(story.id, story.type)
                } catch (error) {
                  console.error('Failed to load story:', error)
                  setLoadingId(null) // Clear loading state on error
                }
              }
            }}
          >
            <Show when={loadingId() === story.id}>
              <div class={styles.loadingOverlay}>
                <div class={styles.loadingSpinner}></div>
                <span>Loading story...</span>
              </div>
            </Show>

            <div class={styles.storyHeader}>
              <Show 
                when={editingId() === story.id} 
                fallback={
                  <div class={styles.storyName} onDblClick={() => props.editingEnabled && startEditing(story.id, story.name)}>
                    {story.type === 'server' ? (
                      <BsCloudFill class={styles.storyTypeIcon} title="Server story" />
                    ) : (
                      <BsHddFill class={styles.storyTypeIcon} title="Local story" />
                    )}
                    <span>{story.name}</span>
                    {story.hasLocalDifferences && (
                      <BsExclamationTriangle class={styles.differencesIcon} title="Local version differs from server" />
                    )}
                    {story.isCurrentStory && <span class={styles.currentIndicator} title="Currently loaded"> ✓</span>}
                  </div>
                }
              >
                <input
                  type="text"
                  value={editingName()}
                  onInput={(e) => setEditingName(e.target.value)}
                  class={styles.storyNameEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRename()
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  onBlur={saveRename}
                  onClick={(e) => e.stopPropagation()}
                />
              </Show>

              <div class={styles.storyActions}>
                <Show when={props.editingEnabled && editingId() !== story.id}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      startEditing(story.id, story.name)
                    }}
                    class={styles.actionButton}
                    title="Rename story"
                  >
                    <BsPencil />
                  </button>
                </Show>

                <Show when={story.type === 'server' && story.hasLocalDifferences}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onLoadStory(story.id, 'local')
                    }}
                    class={styles.actionButton}
                    title="Load local version"
                  >
                    <BsHddFill />
                  </button>
                </Show>

                <Show when={props.serverAvailable && story.type === 'local' && props.onSyncToServer && !story.isCurrentStory}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onSyncToServer!(story.id)
                    }}
                    class={styles.actionButton}
                    title="Upload to server"
                    disabled={props.syncing === story.id}
                  >
                    {props.syncing === story.id ? '⏳' : <BsServer />}
                  </button>
                </Show>

                <Show when={story.type === 'server' && props.onExportPdf}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onExportPdf!(story.id)
                    }}
                    class={styles.actionButton}
                    title="Export as PDF"
                  >
                    <BsFilePdf />
                  </button>
                </Show>

                <Show when={story.type === 'server' && props.onRefineStory}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onRefineStory!(story.id)
                    }}
                    class={styles.actionButton}
                    title="Refine story with AI"
                    disabled={props.refining === story.id}
                  >
                    {props.refining === story.id ? '⏳' : <BsStars />}
                  </button>
                </Show>

                <Show when={props.onDeleteStory}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!story.isCurrentStory && confirm(`Are you sure you want to delete "${story.name}"?`)) {
                        props.onDeleteStory!(story.id, story.type)
                      }
                    }}
                    class={styles.actionButton}
                    title={story.isCurrentStory ? "Cannot delete currently loaded story" : "Delete story"}
                    disabled={story.isCurrentStory}
                  >
                    <BsTrash />
                  </button>
                </Show>
              </div>
            </div>

            <div class={styles.storyMeta}>
              <span>{story.messageCount} messages</span>
              <span>{story.characterCount} characters</span>
              <Show when={story.chapterCount > 0}>
                <span>{story.chapterCount} chapters</span>
              </Show>
              <span class={styles.storyDate}>{formatDate(story.savedAt)}</span>
            </div>

            <Show when={story.storySetting}>
              <div class={styles.storySetting}>{story.storySetting}</div>
            </Show>
          </div>
        )}
      </For>
    </div>
  )
}