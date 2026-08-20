import { ActionRow, Button, IconButton, Input, Modal, Spinner, Text } from '@mythweavers/ui'
import { useNavigate } from '@solidjs/router'
import { Component, For, Show, createEffect, createSignal, onMount } from 'solid-js'
import { PhArrowsClockwiseIcon, PhPencilSimpleIcon, PhTrashIcon } from 'solidjs-phosphor'
import {
  deleteMyAdventuresById,
  getMyAdventures,
  getMyAdventuresById,
  postMyAdventures,
  putMyAdventuresById,
} from '../client/config'
import type { PersistedState } from '../hooks/useAdventurePersistence'
import { effectiveSettings } from '../stores/effectiveSettingsStore'
import { buildAdventureTitleMessages, cleanAdventureTitle } from '../utils/adventureTitle'
import { LLMClientFactory } from '../utils/llm/LLMClientFactory'
import { resolveModel } from '../utils/llm/resolveModel'
import * as styles from './AdventureList.css'
import { NewAdventureForm, type NewAdventureResult } from './NewAdventureForm'

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

interface AdventureListProps {
  onCountChange?: (count: number) => void
}

export const AdventureList: Component<AdventureListProps> = (props) => {
  const navigate = useNavigate()
  const [deletingId, setDeletingId] = createSignal<string | null>(null)
  const [regeneratingTitleIds, setRegeneratingTitleIds] = createSignal<Set<string>>(new Set())
  const [showNewAdventure, setShowNewAdventure] = createSignal(false)
  const [isCreatingAdventure, setIsCreatingAdventure] = createSignal(false)
  const [createError, setCreateError] = createSignal<string | null>(null)
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editingName, setEditingName] = createSignal('')
  const [adventures, setAdventures] = createSignal<
    Array<{
      id: string
      name: string
      createdAt: string
      updatedAt: string
      hasSetting: boolean
      settingPreview?: string
    }>
  >([])
  const [loading, setLoading] = createSignal(true)
  const [adventurePage, setAdventurePage] = createSignal(1)
  const [adventureTotalPages, setAdventureTotalPages] = createSignal(1)
  const [loadingMore, setLoadingMore] = createSignal(false)

  const hasMoreAdventures = () => adventurePage() < adventureTotalPages()

  const fetchAdventures = async (page: number) => {
    const { data } = await getMyAdventures({ query: { page, pageSize: 50 } })
    if (!data) return { adventures: [], pagination: null }
    return { adventures: data.adventures, pagination: data.pagination }
  }

  const loadFirstAdventurePage = async () => {
    setLoading(true)
    const { adventures: list, pagination } = await fetchAdventures(1)
    setAdventures(list)
    setAdventurePage(pagination?.page ?? 1)
    setAdventureTotalPages(pagination?.totalPages ?? 1)
    setLoading(false)
  }

  const loadMoreAdventures = async () => {
    if (loadingMore()) return
    setLoadingMore(true)
    try {
      const nextPage = adventurePage() + 1
      const { adventures: list, pagination } = await fetchAdventures(nextPage)
      // Dedupe by id in case of page-boundary shifts
      setAdventures((prev) => {
        const seen = new Set(prev.map((a) => a.id))
        return [...prev, ...list.filter((a) => !seen.has(a.id))]
      })
      if (pagination) {
        setAdventurePage(pagination.page)
        setAdventureTotalPages(pagination.totalPages)
      } else {
        setAdventurePage((p) => p + 1)
      }
    } catch (err) {
      console.error('Failed to load more adventures:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  // Load on mount
  onMount(() => {
    loadFirstAdventurePage()
  })

  // Report count to parent
  createEffect(() => {
    const list = adventures()
    if (props.onCountChange) {
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
      loadFirstAdventurePage()
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

  async function regenerateTitle(id: string) {
    if (!effectiveSettings.model || !effectiveSettings.provider) {
      alert('Configure an AI provider and model before regenerating a title.')
      return
    }

    if (regeneratingTitleIds().has(id)) return
    setRegeneratingTitleIds((current) => new Set(current).add(id))
    try {
      const { data } = await getMyAdventuresById({ path: { id } })
      const state = data?.adventure.data as Record<string, unknown> | undefined
      const worldSetting =
        (typeof state?.worldBible === 'string' && state.worldBible.trim()) ||
        (typeof state?.settingInput === 'string' && state.settingInput.trim()) ||
        ''
      const startPrompt =
        (typeof state?.startPrompt === 'string' && state.startPrompt.trim()) ||
        (typeof state?.settingDescription === 'string' && state.settingDescription.trim()) ||
        ''
      if (!worldSetting || !startPrompt) throw new Error('This adventure needs both a world setting and start prompt.')

      const resolved = resolveModel('adventure-title')
      const client = LLMClientFactory.getClient(resolved.provider)
      let accumulated = ''
      const response = client.generate({
        model: resolved.model,
        messages: buildAdventureTitleMessages(worldSetting, startPrompt),
        max_tokens: 30,
        metadata: { callType: 'adventure-title' },
      })
      for await (const event of response) {
        if (event.type === 'chunk') accumulated += event.text
      }

      const title = cleanAdventureTitle(accumulated)
      if (!title) throw new Error('The model returned an empty title.')
      await putMyAdventuresById({ path: { id }, body: { name: title } })
      setAdventures((current) =>
        current.map((adventure) => (adventure.id === id ? { ...adventure, name: title } : adventure)),
      )
    } catch (err) {
      console.error('Failed to regenerate adventure title:', err)
      alert(err instanceof Error ? err.message : 'Failed to regenerate adventure title')
    } finally {
      setRegeneratingTitleIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this adventure? This cannot be undone.')) return

    setDeletingId(id)
    try {
      await deleteMyAdventuresById({ path: { id } })
      loadFirstAdventurePage()
    } catch (err) {
      console.error('Failed to delete adventure:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleNewAdventure = async (result: NewAdventureResult) => {
    setIsCreatingAdventure(true)
    setCreateError(null)
    const worldSetting = result.worldSetting.trim()
    const startPrompt = result.startPrompt.trim()

    const initialState: PersistedState = {
      phase: 'playing',
      settingInput: worldSetting,
      protagonistInput: result.protagonistInput,
      deuteragonistInput: result.deuteragonistInput || undefined,
      settingDescription: startPrompt,
      startPrompt,
      worldBible: worldSetting,
      turns: [],
      directive: result.directive,
      ...result.settings,
    }

    const name = result.title.trim()

    try {
      const { data } = await postMyAdventures({
        body: {
          name: name || 'Untitled Adventure',
          data: initialState as any,
        },
      })

      if (!data?.adventure) throw new Error('The server returned no adventure.')
      setShowNewAdventure(false)
      navigate(`/adventure/${data.adventure.id}`)
    } catch (err) {
      console.error('Failed to create adventure:', err)
      setCreateError(err instanceof Error ? err.message : 'Failed to create adventure')
    } finally {
      setIsCreatingAdventure(false)
    }
  }

  return (
    <div>
      <div class={styles.newButton}>
        <Button
          variant="primary"
          onClick={() => {
            setCreateError(null)
            setShowNewAdventure(true)
          }}
        >
          New Adventure
        </Button>
      </div>

      <Show
        when={!loading()}
        fallback={
          <div style={{ display: 'flex', 'justify-content': 'center', padding: '2rem' }}>
            <Spinner size="sm" />
          </div>
        }
      >
        <Show
          when={adventures().length > 0}
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
                      <span onDblClick={() => startEditing(adventure.id, adventure.name)}>{adventure.name}</span>
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
                          aria-label="Regenerate adventure title"
                          title="Regenerate title from the world setting and adventure start"
                          variant="ghost"
                          size="sm"
                          onClick={() => void regenerateTitle(adventure.id)}
                          disabled={regeneratingTitleIds().has(adventure.id)}
                        >
                          {regeneratingTitleIds().has(adventure.id) ? <Spinner size="sm" /> : <PhArrowsClockwiseIcon />}
                        </IconButton>
                        <IconButton
                          aria-label="Rename adventure"
                          title="Change title"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(adventure.id, adventure.name)}
                        >
                          <PhPencilSimpleIcon />
                        </IconButton>
                      </Show>
                      <IconButton
                        aria-label="Delete adventure"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(adventure.id)}
                        disabled={deletingId() === adventure.id}
                      >
                        {deletingId() === adventure.id ? <Spinner size="sm" /> : <PhTrashIcon />}
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
          <Show when={hasMoreAdventures()}>
            <div class={styles.loadMoreRow}>
              <Button variant="secondary" onClick={loadMoreAdventures} disabled={loadingMore()}>
                {loadingMore() ? 'Loading...' : 'Load more adventures'}
              </Button>
            </div>
          </Show>
        </Show>
      </Show>

      <Modal open={showNewAdventure()} onClose={() => setShowNewAdventure(false)} title="New Adventure" size="lg">
        <NewAdventureForm
          onStart={handleNewAdventure}
          onCancel={() => setShowNewAdventure(false)}
          reusableSettings={adventures()
            .filter((adventure) => adventure.hasSetting)
            .map(({ id, name, settingPreview }) => ({ id, name, settingPreview }))}
          isCreating={isCreatingAdventure()}
          createError={createError()}
        />
      </Modal>
    </div>
  )
}
