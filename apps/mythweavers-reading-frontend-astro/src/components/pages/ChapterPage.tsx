import { Show, createEffect } from 'solid-js'
import { Card, CardBody, LinkButton } from '@mythweavers/ui'
import { Layout } from '../Layout'
import { readingStatusApi, type ChapterContent, type User } from '../../lib/api'
import * as pageStyles from '../../styles/pages.css'
import * as styles from '../../styles/story.css'
import { ChapterScenes } from './ChapterScenes'

export interface ChapterPageProps {
  user: User | null
  chapter: ChapterContent | null
  storyId: string
  error: string | null
  initialTheme?: 'chronicle' | 'starlight'
}

export const ChapterPage = (props: ChapterPageProps) => {
  // Record this chapter as the user's most-recently-read for the story.
  // Fire-and-forget: failures (e.g. unauthenticated, story unpublished mid-read)
  // shouldn't break the reading experience.
  createEffect(() => {
    if (!props.user || !props.chapter) return
    const chapterId = props.chapter.id
    void readingStatusApi.record(props.storyId, chapterId).catch((err) => {
      console.warn('Failed to record reading status', err)
    })
  })

  return (
    <Layout initialTheme={props.initialTheme} user={props.user}>
      <div class={pageStyles.pageContainer}>
        <Card size="full">
          <CardBody padding="lg">
            <Show when={props.error}>
              <div>{props.error}</div>
            </Show>

            <Show when={!props.error && !props.chapter}>
              <div>Chapter not found</div>
            </Show>

            <Show when={!props.error && props.chapter}>
              {(chapter) => (
                <>
                  <div class={styles.chapterNav}>
                    <LinkButton href={`/story/${props.storyId}`} variant="secondary">
                      Back to Story
                    </LinkButton>
                    <div class={styles.chapterNavButtons}>
                      <Show when={chapter().previousChapterId}>
                        <LinkButton href={`/story/${props.storyId}/chapter/${chapter().previousChapterId}`} variant="secondary" size="sm">
                          Previous
                        </LinkButton>
                      </Show>
                      <Show when={chapter().nextChapterId}>
                        <LinkButton href={`/story/${props.storyId}/chapter/${chapter().nextChapterId}`} variant="secondary" size="sm">
                          Next
                        </LinkButton>
                      </Show>
                    </div>
                  </div>

                  <h1 class={styles.chapterTitle}>{chapter().name}</h1>
                  <ChapterScenes
                    scenes={chapter().scenes}
                    enteringBackgroundUrl={chapter().enteringBackgroundUrl}
                  />

                  <div class={styles.chapterFooterNav}>
                    <Show when={chapter().previousChapterId} fallback={<div />}>
                      <LinkButton href={`/story/${props.storyId}/chapter/${chapter().previousChapterId}`} variant="secondary">
                        Previous Chapter
                      </LinkButton>
                    </Show>
                    <Show when={chapter().nextChapterId} fallback={<div />}>
                      <LinkButton href={`/story/${props.storyId}/chapter/${chapter().nextChapterId}`} variant="primary">
                        Next Chapter
                      </LinkButton>
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
