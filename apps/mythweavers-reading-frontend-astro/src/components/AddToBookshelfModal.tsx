import { Button, Modal } from '@mythweavers/ui'
import { For, Show, createResource, createSignal, type Component } from 'solid-js'
import { bookshelfApi, type BookshelfStatus, type SavedKind } from '../lib/api'

interface AddToBookshelfModalProps {
  open: boolean
  onClose: () => void
  storyId: string
  storyName: string
}

interface KindOption {
  kind: SavedKind
  label: string
  emoji: string
  description: string
}

const KIND_OPTIONS: KindOption[] = [
  { kind: 'FAVORITE', label: 'Favorite', emoji: '⭐', description: 'Mark this story as a favorite.' },
  { kind: 'FOLLOW', label: 'Follow', emoji: '🚩', description: 'Get this story near the top of your library.' },
  {
    kind: 'READ_LATER',
    label: 'Read later',
    emoji: '🔖',
    description: 'Save this story for later reading.',
  },
]

/**
 * Modal that lets the user toggle which "kinds" they have saved this story
 * under. Shows three switches (Favorite / Follow / Read later) and fires the
 * matching POST/DELETE for each toggled kind.
 *
 * State strategy: we fetch the current status when the modal opens, then
 * track local optimistic state. Each toggle fires its own request — the
 * endpoints are idempotent so retries are safe.
 */
const AddToBookshelfModal: Component<AddToBookshelfModalProps> = (props) => {
  // Re-fetch every time `open` flips to true so a stale signal doesn't show
  // wrong toggle state after navigating between cards.
  const [status, { mutate, refetch }] = createResource(
    () => (props.open ? props.storyId : null),
    async (storyId) => {
      if (!storyId) return null
      try {
        return await bookshelfApi.status(storyId)
      } catch (err) {
        console.error('Failed to load bookshelf status', err)
        return { FAVORITE: false, FOLLOW: false, READ_LATER: false } satisfies BookshelfStatus
      }
    },
  )

  const [pendingKind, setPendingKind] = createSignal<SavedKind | null>(null)
  const [error, setError] = createSignal<string | null>(null)

  const toggle = async (kind: SavedKind) => {
    const current = status()
    if (!current) return
    const isOn = current[kind]

    setPendingKind(kind)
    setError(null)

    // Optimistic update.
    mutate({ ...current, [kind]: !isOn })

    try {
      if (isOn) {
        await bookshelfApi.remove(props.storyId, kind)
      } else {
        await bookshelfApi.add(props.storyId, kind)
      }
    } catch (err) {
      console.error('Bookshelf toggle failed', err)
      // Revert and surface error.
      mutate(current)
      setError('Could not update your library. Please try again.')
      // Refetch to be safe.
      void refetch()
    } finally {
      setPendingKind(null)
    }
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={`Save "${props.storyName}"`}
      size="sm"
      footer={
        <Button variant="secondary" onClick={props.onClose}>
          Done
        </Button>
      }
    >
      <Show when={error()}>
        <p style={{ color: 'crimson', 'margin-bottom': '0.75rem', 'font-size': '0.875rem' }}>{error()}</p>
      </Show>

      <Show
        when={status() != null}
        fallback={<p style={{ color: 'var(--color-text-secondary__1wxbrr29)' }}>Loading…</p>}
      >
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.5rem' }}>
          <For each={KIND_OPTIONS}>
            {(option) => {
              const isOn = () => !!status()?.[option.kind]
              const isPending = () => pendingKind() === option.kind
              return (
                <Button
                  variant={isOn() ? 'primary' : 'secondary'}
                  onClick={() => toggle(option.kind)}
                  disabled={isPending()}
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    gap: '0.75rem',
                    'justify-content': 'flex-start',
                    'text-align': 'left',
                  }}
                >
                  <span style={{ 'font-size': '1.25rem' }}>{option.emoji}</span>
                  <span style={{ display: 'flex', 'flex-direction': 'column' }}>
                    <span>
                      {option.label}
                      {isOn() ? ' ✓' : ''}
                    </span>
                    <span style={{ 'font-size': '0.75rem', opacity: 0.8 }}>{option.description}</span>
                  </span>
                </Button>
              )
            }}
          </For>
        </div>
      </Show>
    </Modal>
  )
}

export default AddToBookshelfModal
