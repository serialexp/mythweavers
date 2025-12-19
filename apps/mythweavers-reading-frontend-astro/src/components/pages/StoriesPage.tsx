import { For, Show } from 'solid-js'
import { Card, CardBody, CardTitle, LinkButton } from '@mythweavers/ui'
import { Layout } from '../Layout'
import StoryCard from '../StoryCard'
import StoriesFilter from '../StoriesFilter'
import type { PublicStory, User } from '../../lib/api'
import * as pageStyles from '../../styles/pages.css'

export interface StoriesPageProps {
  user: User | null
  stories: PublicStory[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  currentGenre?: string
  filterAbandoned: boolean
  buildPageUrl: (page: number) => string
  initialTheme?: 'chronicle' | 'starlight'
}

export const StoriesPage = (props: StoriesPageProps) => {
  return (
    <Layout initialTheme={props.initialTheme} user={props.user}>
      <div class={pageStyles.pageContainer}>
        <Card>
          <CardBody padding="lg" gap="md">
            <CardTitle size="lg">Browse Stories</CardTitle>

            <StoriesFilter
              currentGenre={props.currentGenre}
              filterAbandoned={props.filterAbandoned}
            />

            <div class={pageStyles.storyGrid}>
              <Show
                when={props.stories.length > 0}
                fallback={<p style={{ color: 'var(--color-text-secondary__1wxbrr29)' }}>No stories found</p>}
              >
                <For each={props.stories}>
                  {(story) => (
                    <StoryCard
                      id={story.id}
                      name={story.name || 'Untitled'}
                      summary={story.summary || 'No summary available'}
                      pages={story.pages || 0}
                      status={story.status}
                      wordsPerWeek={story.wordsPerWeek}
                      color={story.coverColor}
                      textColor={story.coverTextColor}
                      fontFamily={story.coverFontFamily}
                      canAddToLibrary={!!props.user}
                    />
                  )}
                </For>
              </Show>
            </div>

            {/* Pagination */}
            <Show when={props.pagination.totalPages > 1}>
              <div style={{ display: 'flex', 'justify-content': 'center', gap: '1rem', 'align-items': 'center', 'margin-top': '1rem' }}>
                <Show when={props.pagination.page > 1}>
                  <LinkButton href={props.buildPageUrl(props.pagination.page - 1)} variant="secondary">
                    Previous
                  </LinkButton>
                </Show>

                <span style={{ color: 'var(--color-text-secondary__1wxbrr29)' }}>
                  Page {props.pagination.page} of {props.pagination.totalPages}
                </span>

                <Show when={props.pagination.page < props.pagination.totalPages}>
                  <LinkButton href={props.buildPageUrl(props.pagination.page + 1)} variant="secondary">
                    Next
                  </LinkButton>
                </Show>
              </div>
            </Show>

            <Show when={props.stories.length === 0}>
              <div style={{ 'text-align': 'center' }}>
                <p style={{ 'margin-bottom': '1rem', color: 'var(--color-text-secondary__1wxbrr29)' }}>
                  No stories found matching your criteria.
                </p>
                <LinkButton href="/stories" variant="primary">
                  View All Stories
                </LinkButton>
              </div>
            </Show>
          </CardBody>
        </Card>
      </div>
    </Layout>
  )
}
