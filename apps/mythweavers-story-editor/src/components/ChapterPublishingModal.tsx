import { Alert, Button, FormField, Input, Modal, Spinner, Stack } from '@mythweavers/ui'
import { Component, Show, createMemo, createSignal } from 'solid-js'
import { currentStoryStore } from '../stores/currentStoryStore'
import { nodeStore } from '../stores/nodeStore'
import { saveService } from '../services/saveService'
import { PublishingBadge, classifyPublishing } from './PublishingBadge'
import * as styles from './StoryPublishingModal.css'

type Mode = 'draft' | 'live' | 'schedule'

interface Props {
  open: boolean
  chapterId: string | null
  onClose: () => void
}

/**
 * Chapter-level publishing modal. Mirrors StoryPublishingModal but applies
 * to a single chapter via saveService.saveChapterPublishing(...). Shows an
 * inline warning if the parent story isn't yet live, since chapter
 * visibility is AND-gated with the story's publishedAt.
 */
export const ChapterPublishingModal: Component<Props> = (props) => {
  const [mode, setMode] = createSignal<Mode>('draft')
  const [scheduledAtLocal, setScheduledAtLocal] = createSignal('')
  const [submitting, setSubmitting] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const chapter = createMemo(() => {
    const id = props.chapterId
    return id ? nodeStore.nodes[id] : null
  })

  const currentState = createMemo(() => classifyPublishing(chapter()?.publishedAt))
  const storyState = createMemo(() => classifyPublishing(currentStoryStore.publishedAt))

  const syncFromStore = () => {
    setError(null)
    const ch = chapter()
    const pub = ch?.publishedAt ?? null
    const state = classifyPublishing(pub)
    if (state === 'draft') {
      setMode('draft')
      setScheduledAtLocal('')
    } else if (state === 'live') {
      setMode('live')
      setScheduledAtLocal('')
    } else {
      setMode('schedule')
      if (pub) {
        setScheduledAtLocal(toDatetimeLocal(new Date(pub)))
      } else {
        setScheduledAtLocal('')
      }
    }
  }

  let wasOpen = false
  const reactToOpen = () => {
    if (props.open && !wasOpen) {
      syncFromStore()
    }
    wasOpen = props.open
    return props.open
  }

  const handleSave = async () => {
    setError(null)
    const storyId = currentStoryStore.id
    const chapterId = props.chapterId
    if (!storyId || !chapterId) return

    let payload:
      | { mode: 'publish-now' }
      | { mode: 'unpublish' }
      | { mode: 'schedule'; publishedAt: string }

    if (mode() === 'draft') {
      payload = { mode: 'unpublish' }
    } else if (mode() === 'live') {
      payload = { mode: 'publish-now' }
    } else {
      const local = scheduledAtLocal().trim()
      if (!local) {
        setError('Pick a date and time to schedule publication.')
        return
      }
      const d = new Date(local)
      if (Number.isNaN(d.getTime())) {
        setError('That date/time is invalid.')
        return
      }
      payload = { mode: 'schedule', publishedAt: d.toISOString() }
    }

    try {
      setSubmitting(true)
      await saveService.saveChapterPublishing(storyId, chapterId, payload)
      props.onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update chapter publishing state.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={reactToOpen()}
      onClose={() => {
        if (!submitting()) props.onClose()
      }}
      title={chapter()?.title ? `Publishing — ${chapter()!.title}` : 'Chapter publishing'}
      size="md"
      footer={
        <Stack direction="horizontal" gap="sm" justify="end">
          <Button variant="ghost" onClick={props.onClose} disabled={submitting()}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting() || !props.chapterId}>
            <Show when={submitting()}>
              <Spinner size="sm" />
            </Show>
            Save
          </Button>
        </Stack>
      }
    >
      <Stack direction="vertical" gap="md">
        <div class={styles.currentState}>
          <span class={styles.currentStateLabel}>Current:</span>
          <PublishingBadge publishedAt={chapter()?.publishedAt} variant="pill" />
          <Show when={currentState() === 'scheduled' && chapter()?.publishedAt}>
            <span class={styles.currentStateDetail}>
              {new Date(chapter()!.publishedAt!).toLocaleString()}
            </span>
          </Show>
          <Show when={currentState() === 'live' && chapter()?.publishedAt}>
            <span class={styles.currentStateDetail}>
              since {new Date(chapter()!.publishedAt!).toLocaleString()}
            </span>
          </Show>
        </div>

        <Show when={storyState() !== 'live'}>
          <Alert variant="warning">
            The parent story is {storyState() === 'draft' ? 'still a draft' : 'scheduled for a future date'}.
            Publishing this chapter now will have no effect — readers won't see it until the story itself is live.
          </Alert>
        </Show>

        <div class={styles.optionList}>
          <label class={styles.option}>
            <input
              type="radio"
              name="chapter-publishing-mode"
              checked={mode() === 'draft'}
              onChange={() => setMode('draft')}
            />
            <div class={styles.optionBody}>
              <div class={styles.optionTitle}>Keep as draft</div>
              <div class={styles.optionDetail}>
                Chapter is invisible on the reader and excluded from the chapter list.
              </div>
            </div>
          </label>

          <label class={styles.option}>
            <input
              type="radio"
              name="chapter-publishing-mode"
              checked={mode() === 'live'}
              onChange={() => setMode('live')}
            />
            <div class={styles.optionBody}>
              <div class={styles.optionTitle}>Publish now</div>
              <div class={styles.optionDetail}>
                {storyState() === 'live'
                  ? 'Chapter becomes visible to readers immediately.'
                  : "Marks the chapter as published, but it won't appear to readers until the story itself is live."}
              </div>
            </div>
          </label>

          <label class={styles.option}>
            <input
              type="radio"
              name="chapter-publishing-mode"
              checked={mode() === 'schedule'}
              onChange={() => setMode('schedule')}
            />
            <div class={styles.optionBody}>
              <div class={styles.optionTitle}>Schedule</div>
              <div class={styles.optionDetail}>
                Pick a date/time (in your local timezone). The chapter goes live at that moment.
              </div>
              <Show when={mode() === 'schedule'}>
                <FormField label="Publish at" class={styles.scheduleInput}>
                  <Input
                    type="datetime-local"
                    value={scheduledAtLocal()}
                    onInput={(e) => setScheduledAtLocal(e.currentTarget.value)}
                  />
                </FormField>
              </Show>
            </div>
          </label>
        </div>

        <Show when={error()}>
          <Alert variant="error">{error()}</Alert>
        </Show>
      </Stack>
    </Modal>
  )
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}
