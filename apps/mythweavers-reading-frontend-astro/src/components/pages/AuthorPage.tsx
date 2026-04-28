import { For, Show } from 'solid-js'
import { Card, CardBody, CardTitle } from '@mythweavers/ui'
import { Layout } from '../Layout'
import StoryCard from '../StoryCard'
import { resolveCoverArtUrl, type AuthorSummary, type PublicStory, type User } from '../../lib/api'
import * as pageStyles from '../../styles/pages.css'

export interface AuthorPageProps {
  user: User | null
  author: AuthorSummary | null
  stories: PublicStory[]
  initialTheme?: 'chronicle' | 'starlight'
}

export const AuthorPage = (props: AuthorPageProps) => {
  return (
    <Layout initialTheme={props.initialTheme} user={props.user}>
      <div class={pageStyles.pageContainer}>
        <Card>
          <CardBody padding="lg" gap="md">
            <Show
              when={props.author}
              fallback={<CardTitle size="lg">Author not found</CardTitle>}
            >
              {(author) => (
                <>
                  <CardTitle size="lg">{author().username}</CardTitle>
                  <p class={pageStyles.textSecondary}>
                    {author().storyCount} published {author().storyCount === 1 ? 'story' : 'stories'}
                  </p>

                  <div class={pageStyles.storyGrid}>
                    <Show
                      when={props.stories.length > 0}
                      fallback={<p class={pageStyles.textSecondary}>No published stories.</p>}
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
                </>
              )}
            </Show>
          </CardBody>
        </Card>
      </div>
    </Layout>
  )
}
