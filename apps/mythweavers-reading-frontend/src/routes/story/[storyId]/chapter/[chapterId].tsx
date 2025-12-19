import { LinkButton, Prose } from '@mythweavers/ui'
import { Meta, Title } from '@solidjs/meta'
import { useParams } from '@solidjs/router'
import { Show, createResource } from 'solid-js'
import { Layout } from '~/components/Layout'
import { storiesApi } from '~/lib/api'
import * as styles from '../../story.css'

export default function ChapterPage() {
  const params = useParams()

  // Fetch chapter content
  const [chapter] = createResource(async () => {
    if (!params.storyId || !params.chapterId) return null

    try {
      const result = await storiesApi.getChapter(params.storyId, params.chapterId)
      return result.chapter
    } catch (error) {
      console.error('Error fetching chapter:', error)
      return null
    }
  })

  return (
    <Layout>
      <Show when={chapter()} fallback={<div>Loading chapter...</div>}>
        {(chapterData) => (
          <>
            <Title>{chapterData().name || 'Chapter'} - Reader</Title>
            <Meta name="description" content={`Reading ${chapterData().name}`} />

            <div class={styles.chapterNav}>
              <LinkButton href={`/story/${params.storyId}`} variant="secondary">
                Back to Story
              </LinkButton>
              <div class={styles.chapterNavButtons}>
                <Show when={chapterData().previousChapterId}>
                  {(prevId) => (
                    <LinkButton href={`/story/${params.storyId}/chapter/${prevId()}`} variant="secondary" size="sm">
                      Previous
                    </LinkButton>
                  )}
                </Show>
                <Show when={chapterData().nextChapterId}>
                  {(nextId) => (
                    <LinkButton href={`/story/${params.storyId}/chapter/${nextId()}`} variant="secondary" size="sm">
                      Next
                    </LinkButton>
                  )}
                </Show>
              </div>
            </div>

            <div class={styles.chapterContent}>
              <h1 class={styles.chapterTitle}>{chapterData().name}</h1>

              <Prose html={chapterData().content || 'No content available'} size="lg" center />
            </div>

            <div class={styles.chapterFooterNav}>
              <Show when={chapterData().previousChapterId} fallback={<div />}>
                {(prevId) => (
                  <LinkButton href={`/story/${params.storyId}/chapter/${prevId()}`} variant="secondary">
                    Previous Chapter
                  </LinkButton>
                )}
              </Show>
              <Show when={chapterData().nextChapterId} fallback={<div />}>
                {(nextId) => (
                  <LinkButton href={`/story/${params.storyId}/chapter/${nextId()}`} variant="primary">
                    Next Chapter
                  </LinkButton>
                )}
              </Show>
            </div>
          </>
        )}
      </Show>
    </Layout>
  )
}
