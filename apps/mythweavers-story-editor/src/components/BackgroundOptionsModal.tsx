import { Button, Modal } from '@mythweavers/ui'
import { Component, Show, createEffect, createSignal, on } from 'solid-js'
import { saveService } from '../services/saveService'
import { currentStoryStore } from '../stores/currentStoryStore'
import { resolveStoryImageUrl } from '../utils/uploadStoryImage'
import * as styles from './BackgroundOptionsModal.css'
import { FilePicker } from './FilePicker'

export type BackgroundTargetLevel = 'story' | 'book' | 'arc' | 'chapter' | 'scene'

export interface BackgroundTarget {
  level: BackgroundTargetLevel
  entityId: string
  /** Pre-fill: current default file id on the entity, if any. */
  initialFileId: string | null
  /** Pre-fill: resolved URL path for the current default file, if any. */
  initialUrl: string | null
  /** Display label, e.g. "Chapter 3" or the node title. */
  displayName?: string
}

interface BackgroundOptionsModalProps {
  isOpen: boolean
  target: BackgroundTarget | null
  onClose: () => void
}

/**
 * Generic modal for setting / clearing the default background image at any
 * node level (story, book, arc, chapter, scene). Only nodes that have an
 * explicit default fire a background change in the reader; everything else
 * inherits via narrative position.
 *
 * Uploads route through POST /my/files (multipart) and the resulting file ID
 * is patched onto the entity via the dedicated /background endpoint, queued
 * through saveService so it dedupes per-(entity, id) and drains in order.
 */
export const BackgroundOptionsModal: Component<BackgroundOptionsModalProps> = (props) => {
  const [fileId, setFileId] = createSignal<string | null>(null)
  const [url, setUrl] = createSignal<string | null>(null)
  const [isSaving, setIsSaving] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  // Seed form from the target whenever we reopen / switch targets.
  createEffect(
    on(
      () => [props.isOpen, props.target?.entityId, props.target?.level] as const,
      ([isOpen]) => {
        if (isOpen && props.target) {
          setFileId(props.target.initialFileId ?? null)
          setUrl(props.target.initialUrl ?? null)
          setError(null)
          setIsSaving(false)
        }
      },
    ),
  )

  const titleSuffix = () => {
    const t = props.target
    if (!t) return ''
    const levelLabel = t.level.charAt(0).toUpperCase() + t.level.slice(1)
    return t.displayName ? `${levelLabel}: ${t.displayName}` : levelLabel
  }

  const handlePicked = (file: { id: string; path: string }) => {
    setFileId(file.id)
    setUrl(file.path)
  }

  const handleRemove = () => {
    setFileId(null)
    setUrl(null)
  }

  const handleSave = async () => {
    const target = props.target
    if (!target) return
    const storyId = currentStoryStore.id
    if (!storyId) {
      setError('No story is currently loaded')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const fid = fileId()
      switch (target.level) {
        case 'story':
          await saveService.saveStoryBackground(storyId, fid)
          break
        case 'book':
          await saveService.saveBookBackground(storyId, target.entityId, fid)
          break
        case 'arc':
          await saveService.saveArcBackground(storyId, target.entityId, fid)
          break
        case 'chapter':
          await saveService.saveChapterBackground(storyId, target.entityId, fid)
          break
        case 'scene':
          await saveService.saveSceneBackground(storyId, target.entityId, fid)
          break
      }
      props.onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save background')
    } finally {
      setIsSaving(false)
    }
  }

  const displayUrl = () => resolveStoryImageUrl(url())

  return (
    <Modal
      open={props.isOpen}
      onClose={props.onClose}
      title={`Default Background — ${titleSuffix()}`}
      size="md"
      footer={
        <div class={styles.actions}>
          <Button variant="secondary" onClick={props.onClose} disabled={isSaving()}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving()}>
            {isSaving() ? 'Saving…' : 'Save'}
          </Button>
        </div>
      }
    >
      <div class={styles.modalContent}>
        <Show when={error()}>
          <div class={styles.errorBox}>{error()}</div>
        </Show>

        <div class={styles.formSection}>
          <span class={styles.help}>
            This background will be used at the start of this {props.target?.level ?? 'node'} in the
            reader. Inline background overrides inside this {props.target?.level ?? 'node'}'s
            descendants will persist until the next node that sets its own default.
          </span>
        </div>

        <div class={styles.formSection}>
          <label class={styles.label}>Current selection</label>
          <div class={styles.previewRow}>
            <div class={styles.preview}>
              <Show when={displayUrl()} fallback={<span>No background</span>}>
                <img class={styles.previewImage} src={displayUrl()!} alt="Background" />
              </Show>
            </div>
            <div class={styles.actionsCol}>
              <Show
                when={fileId()}
                fallback={
                  <div class={styles.help}>
                    Pick an image from your library below or upload a new one. Recommended aspect
                    ratio 16:9.
                  </div>
                }
              >
                <Button variant="secondary" onClick={handleRemove} disabled={isSaving()}>
                  Clear Background
                </Button>
                <div class={styles.help}>
                  This will be cleared if you press Save without picking another image.
                </div>
              </Show>
            </div>
          </div>
        </div>

        <div class={styles.formSection}>
          <label class={styles.label}>Choose from your library</label>
          <FilePicker
            selectedFileId={fileId()}
            onSelect={handlePicked}
            onUpload={handlePicked}
            mimePrefix="image/"
            disabled={isSaving()}
          />
        </div>
      </div>
    </Modal>
  )
}
