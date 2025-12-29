import { Badge, Button, LinkButton, Prose } from '@mythweavers/ui'
import { Meta, Title } from '@solidjs/meta'
import { useParams } from '@solidjs/router'
import { For, Show, createResource } from 'solid-js'
import { Layout } from '~/components/Layout'
import { type StoryWithStructure, storiesApi } from '~/lib/api'
import * as pageStyles from '~/styles/pages.css'
import * as styles from './story.css'

export default function StoryDetail() {
  const params = useParams()

  // Fetch story details with structure
  const [story] = createResource(async () => {
    if (!params.id) return null

    try {
      const result = await storiesApi.getWithStructure(params.id)
      return result.story
    } catch (error) {
      console.error('Error fetching story:', error)
      return null
    }
  })

  // Find the first chapter ID for "Start Reading" button
  const getFirstChapterId = (storyData: StoryWithStructure | null | undefined) => {
    if (!storyData?.books?.length) return null
    const firstBook = storyData.books[0]
    if (!firstBook?.arcs?.length) return null
    const firstArc = firstBook.arcs[0]
    if (!firstArc?.chapters?.length) return null
    return firstArc.chapters[0].id
  }

  return (
    <Layout>
      <Show when={story()} fallback={<div>Loading story...</div>}>
        {(storyData) => (
          <>
            <Title>{storyData().name || 'Unknown Story'} - Reader</Title>
            <Meta name="description" content={`Read ${storyData().name} on Reader`} />

            <div class={styles.storyLayout}>
              {/* Cover image */}
              <div class={styles.coverSection}>
                <div
                  class={styles.coverImage}
                  style={{
                    'background-color': storyData().coverColor,
                    color: storyData().coverTextColor,
                  }}
                >
                  <span class={styles.coverTitle} style={{ 'font-family': storyData().coverFontFamily }}>
                    {storyData().name}
                  </span>
                </div>

                <div class={styles.coverActions}>
                  <Show when={getFirstChapterId(storyData())}>
                    {(chapterId) => (
                      <LinkButton href={`/story/${params.id}/chapter/${chapterId()}`} variant="primary" fullWidth>
                        Start Reading
                      </LinkButton>
                    )}
                  </Show>
                  <Button variant="secondary" fullWidth>
                    Add to Library
                  </Button>
                </div>
              </div>

              {/* Story details */}
              <div class={styles.detailsSection}>
                <h1 class={styles.storyTitle}>{storyData().name}</h1>
                <p class={styles.authorLine}>by {storyData().owner.username}</p>
                <div class={styles.badgeRow}>
                  <Badge variant="primary">{storyData().status}</Badge>
                  <Badge variant="secondary">{storyData().type}</Badge>
                  <Show when={storyData().pages}>
                    <Badge variant="default">{storyData().pages} pages</Badge>
                  </Show>
                </div>

                <div class={styles.summary}>
                  <Prose html={storyData().summary || 'No summary available'} />
                </div>

                <h2 class={pageStyles.sectionTitle}>Chapters</h2>
                <Show when={storyData().books?.length} fallback={<div>No chapters available</div>}>
                  <div class={styles.chaptersSection}>
                    <For each={storyData().books}>
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
                                    <a href={`/story/${params.id}/chapter/${chapter.id}`} class={styles.chapterLink}>
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
          </>
        )}
      </Show>
    </Layout>
  )
}
