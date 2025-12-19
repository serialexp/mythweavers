import { Badge, Card, CardBody, IconButton, Input, Spinner } from '@mythweavers/ui'
import {
  BsCloudFill,
  BsExclamationTriangle,
  BsFilePdf,
  BsHddFill,
  BsPencil,
  BsServer,
  BsStars,
  BsTrash,
} from 'solid-icons/bs'
import { Component, For, Show, createSignal } from 'solid-js'
import { currentStoryStore } from '../stores/currentStoryStore'
import { storyManager } from '../utils/storyManager'

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
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.75rem' }}>
      <For each={props.stories}>
        {(story) => (
          <Card
            interactive
            variant={story.isCurrentStory ? 'elevated' : 'outlined'}
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
            style={{
              position: 'relative',
              cursor: loadingId() === story.id ? 'wait' : 'pointer',
              opacity: loadingId() === story.id ? '0.7' : '1',
              'border-color': story.isCurrentStory ? 'var(--primary-color)' : undefined,
            }}
          >
            {/* Loading Overlay */}
            <Show when={loadingId() === story.id}>
              <div
                style={{
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  right: '0',
                  bottom: '0',
                  background: 'rgba(0, 0, 0, 0.5)',
                  'backdrop-filter': 'blur(2px)',
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                  gap: '1rem',
                  'border-radius': '8px',
                  'z-index': '10',
                  color: 'var(--text-primary)',
                }}
              >
                <Spinner size="sm" />
                <span>Loading story...</span>
              </div>
            </Show>

            <CardBody padding="md">
              {/* Header Row */}
              <div
                style={{
                  display: 'flex',
                  'justify-content': 'space-between',
                  'align-items': 'center',
                  'margin-bottom': '0.5rem',
                }}
              >
                <Show
                  when={editingId() === story.id}
                  fallback={
                    <div
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        gap: '0.5rem',
                        'font-weight': '500',
                        'font-size': '1.1rem',
                        color: 'var(--text-primary)',
                      }}
                      onDblClick={() => props.editingEnabled && startEditing(story.id, story.name)}
                    >
                      {story.type === 'server' ? (
                        <BsCloudFill
                          style={{ width: '16px', height: '16px', color: 'var(--text-secondary)' }}
                          title="Server story"
                        />
                      ) : (
                        <BsHddFill
                          style={{ width: '16px', height: '16px', color: 'var(--text-secondary)' }}
                          title="Local story"
                        />
                      )}
                      <span>{story.name}</span>
                      {story.hasLocalDifferences && (
                        <BsExclamationTriangle
                          style={{ width: '16px', height: '16px', color: 'var(--warning-color)' }}
                          title="Local version differs from server"
                        />
                      )}
                      {story.isCurrentStory && (
                        <Badge variant="success" size="sm">
                          Current
                        </Badge>
                      )}
                    </div>
                  }
                >
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
                </Show>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.25rem' }} onClick={(e) => e.stopPropagation()}>
                  <Show when={props.editingEnabled && editingId() !== story.id}>
                    <IconButton
                      aria-label="Rename story"
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(story.id, story.name)}
                    >
                      <BsPencil />
                    </IconButton>
                  </Show>

                  <Show when={story.type === 'server' && story.hasLocalDifferences}>
                    <IconButton
                      aria-label="Load local version"
                      variant="ghost"
                      size="sm"
                      onClick={() => props.onLoadStory(story.id, 'local')}
                    >
                      <BsHddFill />
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
                      {props.syncing === story.id ? <Spinner size="sm" /> : <BsServer />}
                    </IconButton>
                  </Show>

                  <Show when={story.type === 'server' && props.onExportPdf}>
                    <IconButton
                      aria-label="Export as PDF"
                      variant="ghost"
                      size="sm"
                      onClick={() => props.onExportPdf!(story.id)}
                    >
                      <BsFilePdf />
                    </IconButton>
                  </Show>

                  <Show when={story.type === 'server' && props.onRefineStory}>
                    <IconButton
                      aria-label="Refine story with AI"
                      variant="ghost"
                      size="sm"
                      onClick={() => props.onRefineStory!(story.id)}
                      disabled={props.refining === story.id}
                    >
                      {props.refining === story.id ? <Spinner size="sm" /> : <BsStars />}
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
                      <BsTrash />
                    </IconButton>
                  </Show>
                </div>
              </div>

              {/* Meta Row */}
              <div
                style={{
                  display: 'flex',
                  gap: '1rem',
                  'font-size': '0.9rem',
                  color: 'var(--text-secondary)',
                  'margin-bottom': story.storySetting ? '0.5rem' : '0',
                  'flex-wrap': 'wrap',
                }}
              >
                <span>{story.messageCount} messages</span>
                <span>{story.characterCount} characters</span>
                <Show when={story.chapterCount > 0}>
                  <span>{story.chapterCount} chapters</span>
                </Show>
                <span style={{ 'margin-left': 'auto' }}>{formatDate(story.savedAt)}</span>
              </div>

              {/* Story Setting */}
              <Show when={story.storySetting}>
                <div
                  style={{
                    'font-size': '0.9rem',
                    color: 'var(--text-secondary)',
                    'font-style': 'italic',
                    overflow: 'hidden',
                    'text-overflow': 'ellipsis',
                    'white-space': 'nowrap',
                  }}
                >
                  {story.storySetting}
                </div>
              </Show>
            </CardBody>
          </Card>
        )}
      </For>
    </div>
  )
}
