import { Button, LinkButton } from '@mythweavers/ui'
import { Show, createSignal, type Component, type JSX } from 'solid-js'
import AddToBookshelfModal from './AddToBookshelfModal'
import * as styles from './StoryCard.css'

interface StoryCardProps {
  id: string
  /** Resolved cover-art URL (already passed through `resolveCoverArtUrl`). */
  coverArtAsset?: string
  name: string
  /** Summary as HTML (rendered via innerHTML — backend trust required). */
  summary: string
  /** Cover background color, used for the spine gradient and as fallback. */
  color?: string
  /** Cover text color — used for the title fallback when there is no art. */
  textColor?: string
  /** Page count drives the visible book "thickness". */
  pages: number
  fontFamily?: string
  status?: string
  wordsPerWeek?: number
  /** Hides the "+ Library" button when false (e.g. logged-out users). */
  canAddToLibrary?: boolean
  /** Optional callback for when bookshelf state changes (parent can refresh). */
  onBookshelfChange?: () => void
}

/**
 * Visible thickness of the side-spine in pixels, driven by page count.
 * Mirrors the legacy reader-frontend's `pages / 20` heuristic with a
 * sensible floor so very short stories still have a book-edge.
 */
const computeThickness = (pages: number) => Math.max(Math.round(pages / 20), 6)

const statusEmoji = (status?: string) => {
  if (status === 'COMPLETED') return ' ✅'
  if (status === 'HIATUS') return ' ⏸️'
  return ' 🔥'
}

const statusTitle = (status?: string) => {
  if (status === 'COMPLETED') return 'Completed'
  if (status === 'HIATUS') return 'Hiatus'
  return 'Ongoing'
}

const StoryCard: Component<StoryCardProps> = (props) => {
  const [modalOpen, setModalOpen] = createSignal(false)

  const handleAddToLibraryClick = () => {
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    props.onBookshelfChange?.()
  }

  // Inline CSS variables for per-instance dynamic values. Vanilla Extract
  // is zero-runtime, so anything that varies per card (thickness, cover
  // color, text color) must be set via inline styles.
  const containerStyle = (): JSX.CSSProperties => {
    const thickness = computeThickness(props.pages)
    return {
      '--thickness': `${thickness}px`,
      '--half-thickness': `${thickness / 2}px`,
      '--cover-color': props.color ?? '#666',
      '--cover-text-color': props.textColor ?? '#fff',
    }
  }

  const faceStyle = (): JSX.CSSProperties => ({
    'background-color': props.color || undefined,
    color: props.textColor || undefined,
  })

  return (
    <div class={styles.cardContainer} style={containerStyle()}>
      {/* Decorative animated gradient ring; fades on hover. */}
      <div class={styles.cardGlow} aria-hidden="true">
        <div class={styles.cardGlowInner} />
      </div>

      <div class={styles.card}>
        {/* Side-spine slab — width comes from --thickness. */}
        <div class={styles.cardLeft} aria-hidden="true" />

        {/* FRONT: cover art or styled title fallback. */}
        <div class={styles.cardFront} style={faceStyle()}>
          <Show
            when={props.coverArtAsset}
            fallback={
              <p class={styles.titleFallback} style={{ 'font-family': props.fontFamily || 'inherit' }}>
                {props.name}
              </p>
            }
          >
            <img src={props.coverArtAsset} alt={props.name} class={styles.coverImage} />
          </Show>
        </div>

        {/* BACK: title, meta, blurb, actions. */}
        <div class={styles.cardBack} style={faceStyle()}>
          <h2 class={styles.backTitle}>{props.name}</h2>
          <p class={styles.backMeta} title={statusTitle(props.status)}>
            {props.pages} pages{statusEmoji(props.status)}
            <Show when={props.wordsPerWeek != null}> · {props.wordsPerWeek} W/W</Show>
          </p>
          <div class={styles.backSummary} innerHTML={props.summary} />
          <div class={styles.backActions}>
            <Show when={props.canAddToLibrary}>
              <Button variant="secondary" size="sm" onClick={handleAddToLibraryClick}>
                + Library
              </Button>
            </Show>
            <LinkButton href={`/story/${props.id}`} variant="primary" size="sm">
              Read
            </LinkButton>
          </div>
        </div>
      </div>

      <Show when={props.canAddToLibrary}>
        <AddToBookshelfModal
          open={modalOpen()}
          onClose={handleModalClose}
          storyId={props.id}
          storyName={props.name}
        />
      </Show>
    </div>
  )
}

export default StoryCard
