import { Button, LinkButton } from '@mythweavers/ui'
import { Component, Show } from 'solid-js'
import { openAddToBookshelf } from '../lib/stores/bookshelf'
import * as styles from './StoryCard.css'

interface StoryCardProps {
  id: string
  coverArtAsset?: string
  name: string
  summary: string
  color?: string
  textColor?: string
  pages: number
  fontFamily?: string
  lastChapterReleasedAt?: string
  spellingLevel?: number
  royalRoadId?: number
  status?: string
  wordsPerWeek?: number
  canAddToLibrary?: boolean
}

const StoryCard: Component<StoryCardProps> = (props) => {
  const handleAddToLibraryClick = () => {
    openAddToBookshelf(props.id)
  }

  const getStatusEmoji = () => {
    if (props.status === 'COMPLETED') return ' ✅'
    if (props.status === 'HIATUS') return ' ⏸️'
    return ' 🔥'
  }

  const getStatusTitle = () => {
    if (props.status === 'COMPLETED') return 'Completed'
    if (props.status === 'HIATUS') return 'Hiatus'
    return 'Ongoing'
  }

  return (
    <div class={styles.cardContainer}>
      <div
        class={styles.storyCard}
        style={{
          'background-color': props.color || undefined,
          color: props.textColor || undefined,
        }}
      >
        <div class={styles.cardFront}>
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

        <div class={styles.cardBody}>
          <h2 class={styles.cardTitle}>{props.name}</h2>
          <p class={styles.cardMeta}>
            {props.pages} pages
            {getStatusEmoji()} {props.wordsPerWeek ?? '?'} W/W
          </p>
          <div class={styles.cardSummary} innerHTML={props.summary} />

          <div class={styles.cardActions}>
            <Show when={props.canAddToLibrary}>
              <Button variant="secondary" size="sm" onClick={handleAddToLibraryClick}>
                + Library
              </Button>
            </Show>

            <Show
              when={props.royalRoadId}
              fallback={
                <LinkButton href={`/story/${props.id}`} variant="primary" size="sm">
                  Read
                </LinkButton>
              }
            >
              <LinkButton
                href={`https://www.royalroad.com/fiction/${props.royalRoadId}`}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
                size="sm"
              >
                Read on RR
              </LinkButton>
            </Show>
          </div>
        </div>
      </div>

      <div class={styles.statusFooter}>
        <span title={getStatusTitle()}>{getStatusEmoji()}</span>
      </div>
    </div>
  )
}

export default StoryCard
