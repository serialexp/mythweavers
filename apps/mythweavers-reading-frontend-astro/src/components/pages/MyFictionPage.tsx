import { For, Show } from 'solid-js'
import { Card, CardBody, CardTitle, LinkButton } from '@mythweavers/ui'
import { Layout } from '../Layout'
import { resolveCoverArtUrl, type MyFictionStory, type Pagination, type User } from '../../lib/api'
import { writerStoryUrl } from '../../lib/writer-url'
import * as pageStyles from '../../styles/pages.css'

export interface MyFictionPageProps {
  user: User | null
  stories: MyFictionStory[]
  pagination: Pagination
  buildPageUrl: (page: number) => string
  initialTheme?: 'chronicle' | 'starlight'
}

export const MyFictionPage = (props: MyFictionPageProps) => {
  return (
    <Layout initialTheme={props.initialTheme} user={props.user}>
      <div class={pageStyles.pageContainer}>
        <Card>
          <CardBody padding="lg" gap="md">
            <CardTitle size="lg">My Fiction</CardTitle>

            <Show
              when={props.user}
              fallback={
                <div>
                  <p class={pageStyles.textSecondary}>You need to log in to see your stories.</p>
                  <LinkButton href="/login" variant="primary">
                    Log in
                  </LinkButton>
                </div>
              }
            >
              <Show
                when={props.stories.length > 0}
                fallback={
                  <div>
                    <p class={pageStyles.textSecondary}>
                      You haven't created any stories yet.
                    </p>
                  </div>
                }
              >
                <div
                  style={{
                    display: 'grid',
                    'grid-template-columns': 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  <For each={props.stories}>
                    {(story) => {
                      const cover = resolveCoverArtUrl(story.coverArtUrl)
                      return (
                        <div
                          style={{
                            display: 'flex',
                            'flex-direction': 'column',
                            gap: '0.5rem',
                            padding: '1rem',
                            'border-radius': '8px',
                            'background-color': 'var(--color-bg-elevated__1wxbrr2c)',
                            border: '1px solid var(--color-border-default__1wxbrr2j)',
                          }}
                        >
                          <Show when={cover}>
                            <img
                              src={cover!}
                              alt={story.name}
                              style={{
                                width: '100%',
                                'aspect-ratio': '3/2',
                                'object-fit': 'cover',
                                'border-radius': '6px',
                              }}
                            />
                          </Show>
                          <strong style={{ color: 'var(--color-text-primary__1wxbrr27)' }}>
                            {story.name || 'Untitled'}
                          </strong>
                          <span class={pageStyles.textSecondary} style={{ 'font-size': '0.85rem' }}>
                            {story.chapterCount} chapter{story.chapterCount === 1 ? '' : 's'} •{' '}
                            {story.characterCount} character{story.characterCount === 1 ? '' : 's'}
                          </span>
                          <div style={{ display: 'flex', gap: '0.5rem', 'margin-top': 'auto' }}>
                            <LinkButton href={`/story/${story.id}`} variant="secondary" size="sm">
                              View
                            </LinkButton>
                            <LinkButton
                              href={writerStoryUrl(story.id)}
                              variant="primary"
                              size="sm"
                              target="_blank"
                              rel="noopener"
                            >
                              Edit in Writer
                            </LinkButton>
                          </div>
                        </div>
                      )
                    }}
                  </For>
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
              </Show>
            </Show>
          </CardBody>
        </Card>
      </div>
    </Layout>
  )
}
