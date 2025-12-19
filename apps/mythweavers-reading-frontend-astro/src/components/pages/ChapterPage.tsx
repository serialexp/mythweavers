import { Show } from 'solid-js'
import { Card, CardBody, LinkButton, Prose } from '@mythweavers/ui'
import { Layout } from '../Layout'
import type { ChapterContent, User } from '../../lib/api'
import * as pageStyles from '../../styles/pages.css'
import * as styles from '../../styles/story.css'

export interface ChapterPageProps {
  user: User | null
  chapter: ChapterContent | null
  storyId: string
  error: string | null
  initialTheme?: 'chronicle' | 'starlight'
}

export const ChapterPage = (props: ChapterPageProps) => {
  return (
    <Layout initialTheme={props.initialTheme} user={props.user}>
      <div class={pageStyles.pageContainer}>
        <Card>
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
                  <Prose html={chapter().content || 'No content available'} size="lg" center />

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
