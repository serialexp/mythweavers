import { Button, Modal, Spinner } from '@mythweavers/ui'
import { Component, For, Show, createResource } from 'solid-js'
import { getMyFilesById } from '../client/config'
import { resolveStoryImageUrl } from '../utils/uploadStoryImage'
import * as styles from './FileDeleteConfirmModal.css'

export interface FileDeleteConfirmModalProps {
  /** File the user clicked the delete button on, or null when the modal is closed.
   * `path` is consumed by the URL resolver; `mimeType` toggles thumbnail vs icon. */
  file: { id: string; path: string; mimeType: string } | null
  /** Caller closes the modal (cancel button, backdrop click, or after a successful delete). */
  onClose: () => void
  /** Caller performs the actual DELETE request and updates its own state.
   * The modal only confirms intent — it deliberately doesn't fire the delete
   * itself so callers can stay in charge of optimistic list updates. */
  onConfirm: () => Promise<void> | void
  /** When true, the confirm button shows a spinner and is disabled. The modal
   * stays open until the parent flips this back to false (or unmounts). */
  isDeleting: boolean
}

/**
 * Each entry on the breakdown list. The label is human-friendly text shown in
 * the modal body — keeping the mapping table-driven means adding a new File
 * relation in the future is one line of code.
 */
const USAGE_LABELS: Array<{
  key:
    | 'storyCoverArt'
    | 'bookCoverArt'
    | 'bookSpineArt'
    | 'characterPicture'
    | 'messageBackground'
    | 'messageAudio'
    | 'storyDefaultBackground'
    | 'bookDefaultBackground'
    | 'arcDefaultBackground'
    | 'chapterDefaultBackground'
    | 'sceneDefaultBackground'
  singular: string
  plural: string
}> = [
  { key: 'storyCoverArt', singular: 'story cover', plural: 'story covers' },
  { key: 'bookCoverArt', singular: 'book cover', plural: 'book covers' },
  { key: 'bookSpineArt', singular: 'book spine', plural: 'book spines' },
  { key: 'characterPicture', singular: 'character picture', plural: 'character pictures' },
  { key: 'storyDefaultBackground', singular: 'story default background', plural: 'story default backgrounds' },
  { key: 'bookDefaultBackground', singular: 'book default background', plural: 'book default backgrounds' },
  { key: 'arcDefaultBackground', singular: 'arc default background', plural: 'arc default backgrounds' },
  { key: 'chapterDefaultBackground', singular: 'chapter default background', plural: 'chapter default backgrounds' },
  { key: 'sceneDefaultBackground', singular: 'scene default background', plural: 'scene default backgrounds' },
  { key: 'messageBackground', singular: 'inline scene background', plural: 'inline scene backgrounds' },
  { key: 'messageAudio', singular: 'inline scene audio embed', plural: 'inline scene audio embeds' },
]

/**
 * Confirmation modal shown when the user clicks the × on a file tile.
 *
 * Fetches usage counts from `GET /my/files/:id` so the user can see exactly
 * what will be unlinked before they commit. All File FKs are SetNull, so
 * confirming here nulls every reference rather than orphaning anything —
 * the body copy spells that out explicitly so deleting an in-use file
 * isn't a surprise.
 */
export const FileDeleteConfirmModal: Component<FileDeleteConfirmModalProps> = (props) => {
  // Re-fetch every time a new file is opened. The signal source returns the
  // file id (or false to suspend), so the resource auto-reloads on file change
  // and clears when the modal closes.
  const [usage] = createResource(
    () => (props.file ? props.file.id : null),
    async (fileId) => {
      const { data, error } = await getMyFilesById({ path: { id: fileId } })
      if (error) {
        throw new Error((error as { error?: string }).error || 'Failed to load file usage')
      }
      return data?.usage ?? null
    },
  )

  const filename = () => props.file?.path.split('/').pop() ?? props.file?.id ?? ''
  const isImage = () => (props.file?.mimeType ?? '').startsWith('image/')
  const thumbUrl = () => (props.file ? resolveStoryImageUrl(props.file.path) : null)

  return (
    <Modal
      open={props.file !== null}
      onClose={props.onClose}
      title="Delete file?"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={props.onClose} disabled={props.isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void props.onConfirm()} disabled={props.isDeleting || usage.loading}>
            {props.isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </>
      }
    >
      <div class={styles.body}>
        <Show when={props.file}>
          <div class={styles.previewRow}>
            <Show when={isImage() && thumbUrl()} fallback={<div class={styles.previewFallback}>{filename()}</div>}>
              <img class={styles.preview} src={thumbUrl()!} alt="" />
            </Show>
            <div class={styles.filename} title={filename()}>{filename()}</div>
          </div>
        </Show>

        <Show
          when={!usage.loading}
          fallback={
            <div class={styles.usageLoading}>
              <Spinner size="sm" /> <span>Checking where this file is used…</span>
            </div>
          }
        >
          <Show
            when={usage() && usage()!.total > 0}
            fallback={
              <p class={styles.usageNone}>
                This file isn't currently used anywhere. Deleting it will remove it from your library.
              </p>
            }
          >
            <p class={styles.usageHeading}>
              This file is still in use in {usage()!.total} place{usage()!.total === 1 ? '' : 's'}:
            </p>
            <ul class={styles.usageList}>
              <For each={USAGE_LABELS}>
                {(entry) => {
                  const count = () => usage()?.[entry.key] ?? 0
                  return (
                    <Show when={count() > 0}>
                      <li>
                        <strong>{count()}</strong> {count() === 1 ? entry.singular : entry.plural}
                      </li>
                    </Show>
                  )
                }}
              </For>
            </ul>
            <p class={styles.usageWarning}>
              Deleting will clear the file from each of these — they'll keep working but show no image/audio until you
              attach something else.
            </p>
          </Show>
        </Show>
      </div>
    </Modal>
  )
}
