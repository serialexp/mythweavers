import { Alert, Button, FormField, Input, Modal, Spinner, Stack } from '@mythweavers/ui'
import { Component, Show, createMemo, createSignal } from 'solid-js'
import { currentStoryStore } from '../stores/currentStoryStore'
import { saveService } from '../services/saveService'
import { PublishingBadge, classifyPublishing } from './PublishingBadge'
import * as styles from './StoryPublishingModal.css'

type Mode = 'draft' | 'live' | 'schedule'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Story-level publishing modal. Three mutually-exclusive intents:
 *
 *   - Draft    → unpublish   (publishedAt = null; all chapters become invisible
 *                             on the reader regardless of their own publishedAt)
 *   - Live now → publish-now (publishedAt = server now)
 *   - Schedule → publishing  (publishedAt = user-chosen future time)
 *
 * Chapter visibility on the reader is AND-gated: a chapter only appears if
 * its own publishedAt AND this story's publishedAt are both set and in the
 * past. The helper text in the modal restates this.
 */
export const StoryPublishingModal: Component<Props> = (props) => {
  const [mode, setMode] = createSignal<Mode>('draft')
  const [scheduledAtLocal, setScheduledAtLocal] = createSignal('')
  const [submitting, setSubmitting] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const currentState = createMemo(() => classifyPublishing(currentStoryStore.publishedAt))

  // When the modal opens, reset form to match current server-side state so
  // the user sees what's currently applied before picking a new intent.
  const syncFromStore = () => {
    setError(null)
    const pub = currentStoryStore.publishedAt
    const state = classifyPublishing(pub)
    if (state === 'draft') {
      setMode('draft')
      setScheduledAtLocal('')
    } else if (state === 'live') {
      setMode('live')
      setScheduledAtLocal('')
    } else {
      setMode('schedule')
      // Convert UTC ISO → local datetime-local string (yyyy-MM-ddTHH:mm).
      if (pub) {
        const d = new Date(pub)
        setScheduledAtLocal(toDatetimeLocal(d))
      } else {
        setScheduledAtLocal('')
      }
    }
  }

  // Re-sync each time modal transitions to open.
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
    if (!storyId) return

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
      // saveService.saveStoryPublishing returns a promise that resolves when
      // the WHOLE save queue drains — this is the guarantee that any pending
      // content edits settle before we flip publication state.
      await saveService.saveStoryPublishing(storyId, payload)
      props.onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update publishing state.')
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
      title="Story publishing"
      size="md"
      footer={
        <Stack direction="horizontal" gap="sm" justify="end">
          <Button variant="ghost" onClick={props.onClose} disabled={submitting()}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting()}>
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
          <PublishingBadge publishedAt={currentStoryStore.publishedAt} variant="pill" />
          <Show when={currentState() === 'scheduled' && currentStoryStore.publishedAt}>
            <span class={styles.currentStateDetail}>
              {new Date(currentStoryStore.publishedAt!).toLocaleString()}
            </span>
          </Show>
          <Show when={currentState() === 'live' && currentStoryStore.publishedAt}>
            <span class={styles.currentStateDetail}>
              since {new Date(currentStoryStore.publishedAt!).toLocaleString()}
            </span>
          </Show>
        </div>

        <Show when={currentStoryStore.firstChapterReleasedAt || currentStoryStore.lastChapterReleasedAt}>
          <div class={styles.releaseSummary}>
            <Show when={currentStoryStore.firstChapterReleasedAt}>
              <div>
                <span class={styles.releaseLabel}>First chapter released:</span>{' '}
                {new Date(currentStoryStore.firstChapterReleasedAt!).toLocaleDateString()}
              </div>
            </Show>
            <Show when={currentStoryStore.lastChapterReleasedAt}>
              <div>
                <span class={styles.releaseLabel}>Latest chapter released:</span>{' '}
                {new Date(currentStoryStore.lastChapterReleasedAt!).toLocaleDateString()}
              </div>
            </Show>
          </div>
        </Show>

        <div class={styles.optionList}>
          <label class={styles.option}>
            <input
              type="radio"
              name="story-publishing-mode"
              checked={mode() === 'draft'}
              onChange={() => setMode('draft')}
            />
            <div class={styles.optionBody}>
              <div class={styles.optionTitle}>Keep as draft</div>
              <div class={styles.optionDetail}>
                Story is invisible on the reader. All chapters are hidden regardless of
                their own publishing state.
              </div>
            </div>
          </label>

          <label class={styles.option}>
            <input
              type="radio"
              name="story-publishing-mode"
              checked={mode() === 'live'}
              onChange={() => setMode('live')}
            />
            <div class={styles.optionBody}>
              <div class={styles.optionTitle}>Publish now</div>
              <div class={styles.optionDetail}>
                Story becomes visible immediately. Individual chapters still only show
                if each one is itself published.
              </div>
            </div>
          </label>

          <label class={styles.option}>
            <input
              type="radio"
              name="story-publishing-mode"
              checked={mode() === 'schedule'}
              onChange={() => setMode('schedule')}
            />
            <div class={styles.optionBody}>
              <div class={styles.optionTitle}>Schedule</div>
              <div class={styles.optionDetail}>
                Pick a date/time (in your local timezone). The story goes live at that
                moment.
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

// Convert a Date to a yyyy-MM-ddTHH:mm string suitable for <input type="datetime-local">.
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}
