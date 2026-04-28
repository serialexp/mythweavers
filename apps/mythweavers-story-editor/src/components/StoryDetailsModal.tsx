import { Button, Modal } from '@mythweavers/ui'
import { Component, Show, createEffect, createSignal, on } from 'solid-js'
import { currentStoryStore } from '../stores/currentStoryStore'
import { resolveStoryImageUrl } from '../utils/uploadStoryImage'
import { FilePicker } from './FilePicker'
import * as styles from './StoryDetailsModal.css'

interface StoryDetailsModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Edits story metadata used for publishing: name, summary, and cover art.
 *
 * Cover art is uploaded via POST /my/files (multipart) and then referenced
 * by `coverArtFileId` on the story row. An explicit "Remove" button clears
 * the cover (PATCH with coverArtFileId=null).
 */
export const StoryDetailsModal: Component<StoryDetailsModalProps> = (props) => {
  const [name, setName] = createSignal('')
  const [summary, setSummary] = createSignal('')
  const [coverArtFileId, setCoverArtFileId] = createSignal<string | null>(null)
  const [coverArtUrl, setCoverArtUrl] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)

  // Seed form from current story when the modal opens.
  createEffect(
    on(
      () => props.isOpen,
      (isOpen) => {
        if (isOpen) {
          setName(currentStoryStore.name ?? '')
          setSummary(currentStoryStore.summary ?? '')
          setCoverArtFileId(currentStoryStore.coverArtFileId ?? null)
          setCoverArtUrl(currentStoryStore.coverArtUrl ?? null)
          setError(null)
        }
      },
    ),
  )

  const handlePickedCover = (file: { id: string; path: string }) => {
    setCoverArtFileId(file.id)
    setCoverArtUrl(file.path)
  }

  const handleRemoveCover = () => {
    setCoverArtFileId(null)
    setCoverArtUrl(null)
  }

  const handleSave = () => {
    const trimmedName = name().trim()
    if (!trimmedName) {
      setError('Name is required')
      return
    }
    currentStoryStore.updateDetails({
      name: trimmedName,
      summary: summary().trim() ? summary() : null,
      coverArtFileId: coverArtFileId(),
      coverArtUrl: coverArtUrl(),
    })
    props.onClose()
  }

  const displayCoverUrl = () => resolveStoryImageUrl(coverArtUrl())

  return (
    <Modal
      open={props.isOpen}
      onClose={props.onClose}
      title="Story Details"
      size="md"
      footer={
        <div class={styles.actions}>
          <Button variant="secondary" onClick={props.onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      }
    >
      <div class={styles.modalContent}>
        <Show when={error()}>
          <div class={styles.errorBox}>{error()}</div>
        </Show>

        <div class={styles.formSection}>
          <label class={styles.label} for="story-details-name">
            Name
          </label>
          <input
            id="story-details-name"
            class={styles.input}
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            maxLength={200}
          />
        </div>

        <div class={styles.formSection}>
          <label class={styles.label} for="story-details-summary">
            Summary
          </label>
          <textarea
            id="story-details-summary"
            class={styles.textarea}
            value={summary()}
            onInput={(e) => setSummary(e.currentTarget.value)}
            placeholder="A short description shown on the reading frontend and in your story list."
          />
        </div>

        <div class={styles.formSection}>
          <label class={styles.label}>Cover Image</label>
          <div class={styles.coverRow}>
            <div class={styles.coverPreview}>
              <Show when={displayCoverUrl()} fallback={<span>No cover</span>}>
                <img
                  class={styles.coverImage}
                  src={displayCoverUrl()!}
                  alt="Story cover"
                />
              </Show>
            </div>
            <div class={styles.coverActions}>
              <Show when={coverArtFileId()}>
                <Button variant="secondary" onClick={handleRemoveCover}>
                  Remove Cover
                </Button>
              </Show>
              <div class={styles.coverHelp}>
                Pick from your library below or upload a new image. Recommended aspect ratio 2:3
                (like a book cover).
              </div>
            </div>
          </div>
          <FilePicker
            selectedFileId={coverArtFileId()}
            onSelect={handlePickedCover}
            onUpload={handlePickedCover}
            mimePrefix="image/"
          />
        </div>
      </div>
    </Modal>
  )
}
