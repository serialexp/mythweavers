import { For, Show } from 'solid-js'
import { Card, CardBody, CardTitle, LinkButton } from '@mythweavers/ui'
import { Layout } from '../Layout'
import StoryCard from '../StoryCard'
import type { PublicStory, User } from '../../lib/api'
import * as pageStyles from '../../styles/pages.css'

export interface HomePageProps {
  user: User | null
  stories: PublicStory[]
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
