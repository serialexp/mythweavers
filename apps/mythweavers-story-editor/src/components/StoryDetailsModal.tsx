import { Button, Modal } from '@mythweavers/ui'
import { Component, Show, createEffect, createSignal, on } from 'solid-js'
import { getApiBaseUrl } from '../client/config'
import { currentStoryStore } from '../stores/currentStoryStore'
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
  const [isUploading, setIsUploading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  let fileInputRef: HTMLInputElement | undefined

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

  const resolveImageUrl = (urlPath: string | null): string | null => {
    if (!urlPath) return null
    if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) return urlPath
    return `${getApiBaseUrl()}${urlPath}`
  }

  const handleFileSelected = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file, file.name)
      if (currentStoryStore.id) {
        formData.append('storyId', currentStoryStore.id)
      }

      const response = await fetch(`${getApiBaseUrl()}/my/files`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(body || 'Upload failed')
      }

      const result = await response.json()
      const uploadedId: string | undefined = result.file?.id
      const uploadedPath: string | undefined = result.file?.path
      if (!uploadedId) throw new Error('Upload response missing file id')

      setCoverArtFileId(uploadedId)
      setCoverArtUrl(uploadedPath ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload cover image')
    } finally {
      setIsUploading(false)
      // Reset the input so re-selecting the same file still fires change
      if (fileInputRef) fileInputRef.value = ''
    }
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

  const displayCoverUrl = () => resolveImageUrl(coverArtUrl())

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
          <Button onClick={handleSave} disabled={isUploading()}>
            Save
          </Button>
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
              <input
                ref={fileInputRef}
                class={styles.hiddenInput}
                type="file"
                accept="image/*"
                onChange={handleFileSelected}
              />
              <Button
                variant="secondary"
                onClick={() => fileInputRef?.click()}
                disabled={isUploading()}
              >
                {isUploading() ? 'Uploading…' : coverArtFileId() ? 'Replace Cover' : 'Upload Cover'}
              </Button>
              <Show when={coverArtFileId()}>
                <Button variant="secondary" onClick={handleRemoveCover} disabled={isUploading()}>
                  Remove Cover
                </Button>
              </Show>
              <div class={styles.coverHelp}>
                Images are uploaded as-is (no cropping). Recommended aspect ratio 2:3 (like a book cover).
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
