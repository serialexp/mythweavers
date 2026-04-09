import { Component, For, Show, createEffect, createResource, createSignal } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { ActionRow, Button, IconButton, Input, Modal, Spinner, Text } from '@mythweavers/ui'
import { BsPencil, BsTrash } from 'solid-icons/bs'
import { deleteMyAdventuresById, getMyAdventures, postMyAdventures, putMyAdventuresById } from '../client/config'
import { NewAdventureForm, type NewAdventureResult } from './NewAdventureForm'
import type { PersistedState } from '../hooks/useAdventurePersistence'
import { settingsStore } from '../stores/settingsStore'
import { LLMClientFactory } from '../utils/llm/LLMClientFactory'
import { resolveModel } from '../utils/llm/resolveModel'
import type { LLMMessage } from '../types/llm'
import * as styles from './AdventureList.css'

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  // Less than a minute
  if (diff < 60_000) return 'just now'
  // Less than an hour
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  // Less than a day
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  // Less than a week
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

async function generateAdventureTitle(settingDescription: string): Promise<string> {
  const resolved = resolveModel('adventure-title')
  const client = LLMClientFactory.getClient(resolved.provider)

  const prompt = `Here is the setting description for an interactive adventure:

${settingDescription.substring(0, 1000)}

Based on the above, generate a short, evocative title (2-5 words) that captures the essence of this adventure's setting. Be creative — don't just restate the location or era. Only respond with the title, nothing else.`

  const messages: LLMMessage[] = [{ role: 'user', content: prompt }]

  let title = ''
  const response = client.generate({
    model: resolved.model,
    messages,
    max_tokens: 20,
    metadata: { callType: 'adventure-title' },
  })

  for await (const event of response) {
    if (event.type === 'chunk') {
      title += event.text
    }
  }

  return title
    .trim()
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^Title:?\s*/i, '')
    .substring(0, 60) || 'Untitled Adventure'
}

interface AdventureListProps {
  onCountChange?: (count: number) => void
}

export const AdventureList: Component<AdventureListProps> = (props) => {
  const navigate = useNavigate()
  const [deletingId, setDeletingId] = createSignal<string | null>(null)
  const [showNewAdventure, setShowNewAdventure] = createSignal(false)
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editingName, setEditingName] = createSignal('')

  const fetchAdventures = async () => {
    const { data } = await getMyAdventures()
    return data?.adventures ?? []
  }

  const [adventures, { refetch }] = createResource(fetchAdventures)

  // Report count to parent
  createEffect(() => {
    const list = adventures()
    if (list && props.onCountChange) {
      props.onCountChange(list.length)
    }
  })

  function startEditing(id: string, currentName: string) {
    setEditingId(id)
    setEditingName(currentName)
    setTimeout(() => {
      const input = document.querySelector('[data-adventure-edit-input]') as HTMLInputElement
      if (input) {
        input.focus()
        input.select()
      }
    }, 50)
  }

  async function saveRename() {
    const id = editingId()
    const newName = editingName().trim()
    if (!id || !newName) {
      setEditingId(null)
      return
    }

    try {
      await putMyAdventuresById({
        path: { id },
        body: { name: newName },
      })
      refetch()
    } catch (err) {
      console.error('Failed to rename adventure:', err)
    } finally {
      setEditingId(null)
    }
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingName('')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this adventure? This cannot be undone.')) return

    setDeletingId(id)
    try {
      await deleteMyAdventuresById({ path: { id } })
      refetch()
    } catch (err) {
      console.error('Failed to delete adventure:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleNewAdventure = async (result: NewAdventureResult) => {
    // Build the initial state
    let settingDescription = result.settingInput.trim()
    if (result.protagonistInput.trim()) {
      settingDescription += `\n\nPROTAGONIST: ${result.protagonistInput.trim()}`
    }

    const initialState: PersistedState = {
      phase: 'playing',
      settingInput: result.settingInput,
      protagonistInput: result.protagonistInput,
      settingDescription,
      turns: [],
      directive: result.directive,
    }

    // Generate a title via LLM, fall back to truncated setting text
    let name: string
    if (settingsStore.model && settingsStore.provider) {
      try {
        name = await generateAdventureTitle(settingDescription)
      } catch (err) {
        console.error('Failed to generate adventure title:', err)
        const firstLine = result.settingInput.split('\n')[0].trim()
        name = firstLine.length <= 60 ? firstLine : `${firstLine.slice(0, 57)}...`
      }
    } else {
      const firstLine = result.settingInput.split('\n')[0].trim()
      name = firstLine.length <= 60 ? firstLine : `${firstLine.slice(0, 57)}...`
    }

    try {
      const { data } = await postMyAdventures({
        body: {
          name: name || 'Untitled Adventure',
          data: initialState as any,
        },
      })

      if (data?.adventure) {
        setShowNewAdventure(false)
        navigate(`/adventure/${data.adventure.id}`)
      }
    } catch (err) {
      console.error('Failed to create adventure:', err)
      // Fall back to client-side navigation
      setShowNewAdventure(false)
      navigate('/adventure/new')
    }
  }

  return (
    <div>
      <div class={styles.newButton}>
        <Button variant="primary" onClick={() => setShowNewAdventure(true)}>
          New Adventure
        </Button>
      </div>

      <Show when={!adventures.loading} fallback={
        <div style={{ display: 'flex', 'justify-content': 'center', padding: '2rem' }}>
          <Spinner size="sm" />
        </div>
      }>
        <Show
          when={adventures() && adventures()!.length > 0}
          fallback={
            <div class={styles.emptyState}>
              <Text size="lg" color="secondary">
                No adventures yet. Start a new one!
              </Text>
            </div>
          }
        >
          <div class={styles.list}>
            <For each={adventures()}>
              {(adventure) => (
                <ActionRow
                  title={
                    <Show
                      when={editingId() !== adventure.id}
                      fallback={
                        <Input
                          type="text"
                          value={editingName()}
                          onInput={(e) => setEditingName(e.currentTarget.value)}
                          data-adventure-edit-input
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
                      <span onDblClick={() => startEditing(adventure.id, adventure.name)}>
                        {adventure.name}
                      </span>
                    </Show>
                  }
                  description={
                    <>
                      <span>Updated {formatDate(adventure.updatedAt)}</span>
                      <span>Created {formatDate(adventure.createdAt)}</span>
                    </>
                  }
                  actions={
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: '0.25rem' }}>
                      <Show when={editingId() !== adventure.id}>
                        <IconButton
                          aria-label="Rename adventure"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(adventure.id, adventure.name)}
                        >
                          <BsPencil />
                        </IconButton>
                      </Show>
                      <IconButton
                        aria-label="Delete adventure"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(adventure.id)}
                        disabled={deletingId() === adventure.id}
                      >
                        {deletingId() === adventure.id ? <Spinner size="sm" /> : <BsTrash />}
                      </IconButton>
                    </div>
                  }
                  onClick={() => {
                    if (!editingId()) navigate(`/adventure/${adventure.id}`)
                  }}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>

      <Modal
        open={showNewAdventure()}
        onClose={() => setShowNewAdventure(false)}
        title="New Adventure"
        size="lg"
      >
        <NewAdventureForm
          onStart={handleNewAdventure}
          onCancel={() => setShowNewAdventure(false)}
        />
      </Modal>
    </div>
  )
}
