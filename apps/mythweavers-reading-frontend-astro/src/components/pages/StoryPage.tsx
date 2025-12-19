import { For, Show } from 'solid-js'
import { Badge, Button, Card, CardBody, LinkButton, Prose } from '@mythweavers/ui'
import { Layout } from '../Layout'
import type { StoryWithStructure, User } from '../../lib/api'
import * as pageStyles from '../../styles/pages.css'
import * as styles from '../../styles/story.css'

export interface StoryPageProps {
  user: User | null
  story: StoryWithStructure | null
  storyId: string
  firstChapterId: string | null
  error: string | null
  initialTheme?: 'chronicle' | 'starlight'
}

export const StoryPage = (props: StoryPageProps) => {
  return (
    <Layout initialTheme={props.initialTheme} user={props.user}>
      <div class={pageStyles.pageContainer}>
        <Card>
          <CardBody padding="lg">
            <Show when={props.error}>
              <div>{props.error}</div>
            </Show>

            <Show when={!props.error && !props.story}>
              <div>Story not found</div>
            </Show>

            <Show when={!props.error && props.story}>
              {(story) => (
                <div class={styles.storyLayout}>
                  {/* Cover image */}
                  <div class={styles.coverSection}>
                    <div
                      class={styles.coverImage}
                      style={{
                        'background-color': story().coverColor,
                        color: story().coverTextColor,
                      }}
                    >
                      <span class={styles.coverTitle} style={{ 'font-family': story().coverFontFamily }}>
                        {story().name}
                      </span>
                    </div>

                    <div class={styles.coverActions}>
                      <Show when={props.firstChapterId}>
                        <LinkButton href={`/story/${props.storyId}/chapter/${props.firstChapterId}`} variant="primary" fullWidth>
                          Start Reading
                        </LinkButton>
                      </Show>
                      <Button variant="secondary" fullWidth>
                        Add to Library
                      </Button>
                    </div>
                  </div>

                  {/* Story details */}
                  <div class={styles.detailsSection}>
                    <h1 class={styles.storyTitle}>{story().name}</h1>
                    <p class={styles.authorLine}>by {story().owner.username}</p>
                    <div class={styles.badgeRow}>
                      <Badge variant="primary">{story().status}</Badge>
                      <Badge variant="secondary">{story().type}</Badge>
                      <Show when={story().pages}>
                        <Badge variant="default">{story().pages} pages</Badge>
                      </Show>
                    </div>

                    <div class={styles.summary}>
                      <Prose html={story().summary || 'No summary available'} />
                    </div>

                    <h2 class={pageStyles.sectionTitle}>Chapters</h2>
                    <Show
                      when={story().books?.length}
                      fallback={<div>No chapters available</div>}
                    >
                      <div class={styles.chaptersSection}>
                        <For each={story().books}>
                          {(book) => (
                            <div class={styles.bookCard}>
                              <h3 class={styles.bookTitle}>{book.name}</h3>
                              <For each={book.arcs}>
                                {(arc) => (
                                  <div class={styles.arcSection}>
                                    <Show when={arc.name}>
                                      <h4 class={styles.arcTitle}>{arc.name}</h4>
                                    </Show>
                                    <For each={arc.chapters}>
                                      {(chapter) => (
                                        <a href={`/story/${props.storyId}/chapter/${chapter.id}`} class={styles.chapterLink}>
                                          {chapter.name}
                                        </a>
                                      )}
                                    </For>
                                  </div>
                                )}
                              </For>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </Show>
          </CardBody>
        </Card>
      </div>
    </Layout>
  )
}
