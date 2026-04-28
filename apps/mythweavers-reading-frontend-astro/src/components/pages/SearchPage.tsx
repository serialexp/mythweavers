import { For, Show, createSignal } from 'solid-js'
import { Button, Card, CardBody, CardTitle, LinkButton } from '@mythweavers/ui'
import { Layout } from '../Layout'
import StoryCard from '../StoryCard'
import { resolveCoverArtUrl, type PublicStory, type User } from '../../lib/api'
import * as pageStyles from '../../styles/pages.css'

type StatusFilter = '' | 'ONGOING' | 'COMPLETED' | 'HIATUS'
type TypeFilter = '' | 'ORIGINAL' | 'FANFICTION'

export interface SearchPageProps {
  user: User | null
  stories: PublicStory[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  query: string
  status: StatusFilter
  type: TypeFilter
  buildPageUrl: (page: number) => string
  initialTheme?: 'chronicle' | 'starlight'
}

export const SearchPage = (props: SearchPageProps) => {
  const [q, setQ] = createSignal(props.query)
  const [status, setStatus] = createSignal<StatusFilter>(props.status)
  const [type, setType] = createSignal<TypeFilter>(props.type)

  const submit = (e: Event) => {
    e.preventDefault()
    const url = new URL(window.location.href)
    if (q()) url.searchParams.set('q', q())
    else url.searchParams.delete('q')
    if (status()) url.searchParams.set('status', status())
    else url.searchParams.delete('status')
    if (type()) url.searchParams.set('type', type())
    else url.searchParams.delete('type')
    url.searchParams.delete('page')
    window.location.href = url.toString()
  }

  return (
    <Layout initialTheme={props.initialTheme} user={props.user}>
      <div class={pageStyles.pageContainer}>
        <Card>
          <CardBody padding="lg" gap="md">
            <CardTitle size="lg">Search Stories</CardTitle>

            <form
              onSubmit={submit}
              style={{ display: 'flex', 'flex-direction': 'column', gap: '0.75rem' }}
            >
              <input
                type="search"
                placeholder="Search by title or author…"
                value={q()}
                onInput={(e) => setQ(e.currentTarget.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  'border-radius': '6px',
                  border: '1px solid var(--color-border-default__1wxbrr2j)',
                  'background-color': 'var(--color-bg-elevated__1wxbrr2c)',
                  color: 'var(--color-text-primary__1wxbrr27)',
                }}
              />
              <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '0.5rem' }}>
                <select
                  value={status()}
                  onChange={(e) => setStatus(e.currentTarget.value as StatusFilter)}
                  style={{
                    padding: '0.4rem',
                    'border-radius': '6px',
                    border: '1px solid var(--color-border-default__1wxbrr2j)',
                    'background-color': 'var(--color-bg-elevated__1wxbrr2c)',
                    color: 'var(--color-text-primary__1wxbrr27)',
                  }}
                >
                  <option value="">Any status</option>
                  <option value="ONGOING">Ongoing</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="HIATUS">Hiatus</option>
                </select>
                <select
                  value={type()}
                  onChange={(e) => setType(e.currentTarget.value as TypeFilter)}
                  style={{
                    padding: '0.4rem',
                    'border-radius': '6px',
                    border: '1px solid var(--color-border-default__1wxbrr2j)',
                    'background-color': 'var(--color-bg-elevated__1wxbrr2c)',
                    color: 'var(--color-text-primary__1wxbrr27)',
                  }}
                >
                  <option value="">Any type</option>
                  <option value="ORIGINAL">Original</option>
                  <option value="FANFICTION">Fanfiction</option>
                </select>
                <Button type="submit" variant="primary" size="sm">
                  Search
                </Button>
              </div>
            </form>

            <div class={pageStyles.storyGrid}>
              <Show
                when={props.stories.length > 0}
                fallback={
                  <p class={pageStyles.textSecondary}>
                    {props.query || props.status || props.type
                      ? 'No stories match your search.'
                      : 'Enter a search term or pick a filter to find stories.'}
                  </p>
                }
              >
                <For each={props.stories}>
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
                      canAddToLibrary={!!props.user}
                    />
                  )}
                </For>
              </Show>
            </div>

            <Show when={props.pagination.totalPages > 1}>
              <div
                style={{
                  display: 'flex',
                  'justify-content': 'center',
                  gap: '1rem',
                  'align-items': 'center',
                  'margin-top': '1rem',
                }}
              >
                <Show when={props.pagination.page > 1}>
                  <LinkButton href={props.buildPageUrl(props.pagination.page - 1)} variant="secondary">
                    Previous
                  </LinkButton>
                </Show>
                <span class={pageStyles.textSecondary}>
                  Page {props.pagination.page} of {props.pagination.totalPages}
                </span>
                <Show when={props.pagination.page < props.pagination.totalPages}>
                  <LinkButton href={props.buildPageUrl(props.pagination.page + 1)} variant="secondary">
                    Next
                  </LinkButton>
                </Show>
              </div>
            </Show>
          </CardBody>
        </Card>
      </div>
    </Layout>
  )
}
