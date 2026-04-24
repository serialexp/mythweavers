import { ActionRow, Badge, IconButton, Input, Spinner } from '@mythweavers/ui'
import { Component, For, Show, createSignal } from 'solid-js'
import { getApiBaseUrl } from '../client/config'
import { currentStoryStore } from '../stores/currentStoryStore'
import { storyManager } from '../utils/storyManager'
import * as styles from './StoryList.css'
import { PhCloudIcon, PhDownloadSimpleIcon, PhFilePdfIcon, PhHardDriveIcon, PhHardDrivesIcon, PhPencilSimpleIcon, PhTrashIcon, PhWarningIcon } from 'solidjs-phosphor'

export interface StoryListItem {
  id: string
  name: string
  savedAt: Date
  updatedAt?: string
  messageCount: number
  characterCount: number
  storySetting?: string
  type: 'local' | 'server'
  isCurrentStory: boolean
  hasLocalDifferences?: boolean // True if local version differs from server
  coverArtUrl?: string | null
}

const resolveCoverUrl = (urlPath: string | null | undefined): string | null => {
  if (!urlPath) return null
  if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) return urlPath
  return `${getApiBaseUrl()}${urlPath}`
}

interface StoryListProps {
  stories: StoryListItem[]
  onLoadStory: (storyId: string, type: 'local' | 'server') => void | Promise<void>
  onDeleteStory?: (storyId: string, type: 'local' | 'server') => void
  onExportPdf?: (storyId: string) => void
  onExportZip?: (storyId: string) => void
  onSyncToServer?: (storyId: string) => void
  onRename?: () => void
  syncing?: string | null
  editingEnabled?: boolean
  serverAvailable?: boolean
}

export const StoryList: Component<StoryListProps> = (props) => {
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editingName, setEditingName] = createSignal('')
  const [loadingId, setLoadingId] = createSignal<string | null>(null)

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id)
    setEditingName(currentName)
    // Focus the input after a short delay to ensure it's rendered
    setTimeout(() => {
      const input = document.querySelector('[data-edit-input]') as HTMLInputElement
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

    const story = props.stories.find((s) => s.id === id)
    if (!story) return

    const success = await storyManager.renameStory(id, newName, story.type)
    if (!success) {
      alert('Failed to rename story')
      cancelEdit()
      return
    }

    if (id === currentStoryStore.id) {
      currentStoryStore.setName(newName, false)
    }

    setEditingId(null)

    if (props.onRename) {
      props.onRename()
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const formatDate = (date: Date) => {
    const isMobile = window.innerWidth <= 768

    if (isMobile) {
      const now = new Date()
      const isCurrentYear = date.getFullYear() === now.getFullYear()

      if (isCurrentYear) {
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric' })
      }
      return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div class={styles.container}>
      <For each={props.stories}>
        {(story) => (
          <div
            style={{
              position: 'relative',
              cursor: loadingId() === story.id ? 'wait' : undefined,
              opacity: loadingId() === story.id ? '0.7' : undefined,
            }}
            class={story.isCurrentStory ? styles.currentStoryBorder : undefined}
          >
            {/* Loading Overlay */}
            <Show when={loadingId() === story.id}>
              <div class={styles.loadingOverlay}>
                <Spinner size="sm" />
                <span>Loading story...</span>
              </div>
            </Show>

            <ActionRow
              title={
                <Show
                  when={editingId() !== story.id}
                  fallback={
                    <Input
                      type="text"
                      value={editingName()}
                      onInput={(e) => setEditingName(e.currentTarget.value)}
                      data-edit-input
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename()
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      onBlur={saveRename}
                      onClick={(e) => e.stopPropagation()}
                      style={{ flex: '1' }}
                    />
                  }
                >
                  <div class={styles.titleWithThumb}>
                    <Show when={resolveCoverUrl(story.coverArtUrl)}>
                      <img
                        src={resolveCoverUrl(story.coverArtUrl)!}
                        alt=""
                        class={styles.thumbnail}
                      />
                    </Show>
                    <div
                      class={styles.storyName}
                      onDblClick={() => props.editingEnabled && startEditing(story.id, story.name)}
                    >
                    {story.type === 'server' ? (
                      <span title="Server story" style={{ display: 'inline-flex' }}>
                        <PhCloudIcon weight="fill" class={styles.storyTypeIcon} />
                      </span>
                    ) : (
                      <span title="Local story" style={{ display: 'inline-flex' }}>
                        <PhHardDriveIcon weight="fill" class={styles.storyTypeIcon} />
                      </span>
                    )}
                    <span>{story.name}</span>
                    {story.hasLocalDifferences && (
                      <span title="Local version differs from server" style={{ display: 'inline-flex' }}>
                        <PhWarningIcon class={styles.warningIcon} />
                      </span>
                    )}
                    {story.isCurrentStory && (
                      <Badge variant="success" size="sm">
                        Current
                      </Badge>
                    )}
                    </div>
                  </div>
                </Show>
              }
              description={
                <>
                  <span>{story.messageCount} messages</span>
                  <span>{story.characterCount} characters</span>
                  <span>{formatDate(story.savedAt)}</span>
                </>
              }
              actions={
                <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: '0.25rem' }}>
                  <Show when={props.editingEnabled && editingId() !== story.id}>
                    <IconButton
                      aria-label="Rename story"
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(story.id, story.name)}
                    >
                      <PhPencilSimpleIcon />
                    </IconButton>
                  </Show>

                  <Show when={story.type === 'server' && story.hasLocalDifferences}>
                    <IconButton
                      aria-label="Load local version"
                      variant="ghost"
                      size="sm"
                      onClick={() => props.onLoadStory(story.id, 'local')}
                    >
                      <PhHardDriveIcon weight="fill" />
                    </IconButton>
                  </Show>

                  <Show
                    when={
                      props.serverAvailable && story.type === 'local' && props.onSyncToServer && !story.isCurrentStory
                    }
                  >
                    <IconButton
                      aria-label="Upload to server"
                      variant="ghost"
                      size="sm"
                      onClick={() => props.onSyncToServer!(story.id)}
                      disabled={props.syncing === story.id}
                    >
                      {props.syncing === story.id ? <Spinner size="sm" /> : <PhHardDrivesIcon />}
                    </IconButton>
                  </Show>

                  <Show when={story.type === 'server' && props.onExportPdf}>
                    <IconButton
                      aria-label="Export as PDF"
                      variant="ghost"
                      size="sm"
                      onClick={() => props.onExportPdf!(story.id)}
                    >
                      <PhFilePdfIcon />
                    </IconButton>
                  </Show>

                  <Show when={story.type === 'server' && props.onExportZip}>
                    <IconButton
                      aria-label="Export as ZIP"
                      variant="ghost"
                      size="sm"
                      onClick={() => props.onExportZip!(story.id)}
                    >
                      <PhDownloadSimpleIcon />
                    </IconButton>
                  </Show>

                  <Show when={props.onDeleteStory}>
                    <IconButton
                      aria-label={story.isCurrentStory ? 'Cannot delete currently loaded story' : 'Delete story'}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!story.isCurrentStory && confirm(`Are you sure you want to delete "${story.name}"?`)) {
                          props.onDeleteStory!(story.id, story.type)
                        }
                      }}
                      disabled={story.isCurrentStory}
                    >
                      <PhTrashIcon />
                    </IconButton>
                  </Show>
                </div>
              }
              onClick={async () => {
                if (!editingId() && loadingId() !== story.id) {
                  setLoadingId(story.id)
                  try {
                    await props.onLoadStory(story.id, story.type)
                  } catch (error) {
                    console.error('Failed to load story:', error)
                    setLoadingId(null)
                  }
                }
              }}
            />
          </div>
        )}
      </For>
    </div>
  )
}
