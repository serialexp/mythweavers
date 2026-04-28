import { For, Show } from 'solid-js'
import { Card, CardBody, CardTitle, LinkButton } from '@mythweavers/ui'
import { Layout } from '../Layout'
import StoryCard from '../StoryCard'
import {
  resolveCoverArtUrl,
  type PublicStory,
  type ReadingStatusEntry,
  type User,
} from '../../lib/api'
import * as pageStyles from '../../styles/pages.css'

export interface HomePageProps {
  user: User | null
  stories: PublicStory[]
  continueReading?: ReadingStatusEntry[]
  initialTheme?: 'chronicle' | 'starlight'
}

export const HomePage = (props: HomePageProps) => {
  return (
    <Layout initialTheme={props.initialTheme} user={props.user}>
      <div class={pageStyles.pageContainer}>
        <Card style={{ 'max-width': '800px' }}>
          <CardBody padding="lg" gap="md">
            <div style={{ display: 'flex', 'align-items': 'center', gap: '1.5rem' }}>
              <img
                src="/mythweavers.png"
                alt="MythWeavers Logo"
                style={{ width: '200px', height: 'auto' }}
              />
              <div>
                <CardTitle size="lg">Welcome to MythWeavers</CardTitle>
                <p style={{ color: 'var(--color-text-secondary__1wxbrr29)', 'line-height': '1.6', margin: 0 }}>
                  MythWeavers is a platform for reading and writing web novels.
                  Discover stories from talented authors, or start writing your own.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Show when={props.continueReading && props.continueReading.length > 0}>
          <div style={{ 'margin-top': '1.5rem', 'max-width': '800px' }}>
            <Card>
              <CardBody padding="lg" gap="md">
                <CardTitle size="lg">Continue Reading</CardTitle>
                <div
                  style={{
                    display: 'flex',
                    'flex-direction': 'column',
                    gap: '0.5rem',
                  }}
                >
                  <For each={props.continueReading}>
                    {(entry) => (
                      <a
                        href={
                          entry.lastChapterId
                            ? `/story/${entry.story.id}/chapter/${entry.lastChapterId}`
                            : `/story/${entry.story.id}`
                        }
                        style={{
                          display: 'flex',
                          'justify-content': 'space-between',
                          'align-items': 'center',
                          padding: '0.75rem 1rem',
                          'border-radius': '8px',
                          'background-color': 'var(--color-bg-elevated__1wxbrr2c)',
                          border: '1px solid var(--color-border-default__1wxbrr2j)',
                          'text-decoration': 'none',
                          color: 'inherit',
                        }}
                      >
                        <strong style={{ color: 'var(--color-text-primary__1wxbrr27)' }}>
                          {entry.story.name || 'Untitled'}
                        </strong>
                        <span class={pageStyles.textSecondary} style={{ 'font-size': '0.85rem' }}>
                          by {entry.story.owner.username}
                        </span>
                      </a>
                    )}
                  </For>
                </div>
              </CardBody>
            </Card>
          </div>
        </Show>

        <div style={{ 'margin-top': '1.5rem', 'max-width': '800px' }}>
          <Card>
            <CardBody padding="lg" gap="md">
              <CardTitle size="lg">Discover Stories</CardTitle>

              <Show
                when={props.stories.length > 0}
                fallback={<p style={{ color: 'var(--color-text-secondary__1wxbrr29)' }}>No stories available yet.</p>}
              >
                <div class={pageStyles.storyGrid}>
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
                </div>
                <div style={{ 'text-align': 'center', 'margin-top': '1rem' }}>
                  <LinkButton href="/stories" variant="primary">
                    Browse All Stories
                  </LinkButton>
                </div>
              </Show>
            </CardBody>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
