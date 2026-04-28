import { Button, Card, CardBody, CardTitle, LinkButton } from '@mythweavers/ui'
import { For, Show, createMemo, createResource, createSignal, type Component } from 'solid-js'
import { Layout } from '../Layout'
import StoryCard from '../StoryCard'
import {
  bookshelfApi,
  resolveCoverArtUrl,
  type BookshelfStory,
  type SavedKind,
  type User,
} from '../../lib/api'
import * as pageStyles from '../../styles/pages.css'

export interface BookshelfPageProps {
  user: User
  /** Server-rendered initial bookshelf, used to avoid a client refetch on first paint. */
  initialStories: BookshelfStory[]
  initialTheme?: 'chronicle' | 'starlight'
}

type FilterKey = 'ALL' | SavedKind

interface FilterOption {
  key: FilterKey
  label: string
  emoji: string
}

const FILTERS: FilterOption[] = [
  { key: 'ALL', label: 'All', emoji: '📚' },
  { key: 'FAVORITE', label: 'Favorites', emoji: '⭐' },
  { key: 'FOLLOW', label: 'Following', emoji: '🚩' },
  { key: 'READ_LATER', label: 'Read later', emoji: '🔖' },
]

/**
 * The user's library, rendered as a filterable grid of the same 3D flip-cards
 * used elsewhere. Stories are tagged with their `kinds` so the same row can
 * appear under "Favorites" and "Following" simultaneously.
 *
 * Filtering happens client-side off the full list (the API also supports
 * `?kind=` server-side, but for typical libraries the dataset is small enough
 * that an in-memory filter avoids a round-trip per tab click).
 */
export const BookshelfPage: Component<BookshelfPageProps> = (props) => {
  const [activeFilter, setActiveFilter] = createSignal<FilterKey>('ALL')

  // Use SSR-fetched data as the initial value; refetch on demand (e.g. after
  // a card's modal closes and the shelf may have changed).
  const [stories, { refetch }] = createResource(
    async () => {
      try {
        const result = await bookshelfApi.list()
        return result.stories
      } catch (err) {
        console.error('Failed to refresh bookshelf', err)
        return props.initialStories
      }
    },
    { initialValue: props.initialStories },
  )

  const filtered = createMemo(() => {
    const filter = activeFilter()
    const all = stories()
    if (filter === 'ALL') return all
    return all.filter((s) => s.kinds.includes(filter))
  })

  const counts = createMemo(() => {
    const all = stories()
    const result: Record<FilterKey, number> = {
      ALL: all.length,
      FAVORITE: 0,
      FOLLOW: 0,
      READ_LATER: 0,
    }
    for (const story of all) {
      for (const kind of story.kinds) result[kind] += 1
    }
    return result
  })

  return (
    <Layout initialTheme={props.initialTheme} user={props.user}>
      <div class={pageStyles.pageContainer}>
        <Card>
          <CardBody padding="lg" gap="md">
            <CardTitle size="lg">My Bookshelf</CardTitle>

            <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '0.5rem' }}>
              <For each={FILTERS}>
                {(option) => {
                  const isActive = () => activeFilter() === option.key
                  const count = () => counts()[option.key]
                  return (
                    <Button
                      variant={isActive() ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setActiveFilter(option.key)}
                    >
                      {option.emoji} {option.label} ({count()})
                    </Button>
                  )
                }}
              </For>
            </div>

            <Show
              when={filtered().length > 0}
              fallback={
                <div style={{ 'text-align': 'center', padding: '2rem 0' }}>
                  <p style={{ color: 'var(--color-text-secondary__1wxbrr29)', 'margin-bottom': '1rem' }}>
                    <Show
                      when={stories().length === 0}
                      fallback={`No stories in this category yet.`}
                    >
                      Your bookshelf is empty. Start by saving a story you like!
                    </Show>
                  </p>
                  <LinkButton href="/stories" variant="primary">
                    Browse Stories
                  </LinkButton>
                </div>
              }
            >
              <div class={pageStyles.storyGrid}>
                <For each={filtered()}>
                  {(story) => (
                    <StoryCard
                      id={story.id}
                      name={story.name || 'Untitled'}
                      summary={story.summary || 'No summary available'}
                      pages={story.pages || 0}
                      status={story.status}
                      color={story.coverColor}
                      textColor={story.coverTextColor}
                      fontFamily={story.coverFontFamily}
                      coverArtAsset={resolveCoverArtUrl(story.coverArtUrl) ?? undefined}
                      canAddToLibrary={true}
                      onBookshelfChange={() => void refetch()}
                    />
                  )}
                </For>
              </div>
            </Show>
          </CardBody>
        </Card>
      </div>
    </Layout>
  )
}
