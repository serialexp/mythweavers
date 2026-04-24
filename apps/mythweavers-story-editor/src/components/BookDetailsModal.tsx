import { Button, Modal } from '@mythweavers/ui'
import { Component, Show, createEffect, createSignal, on } from 'solid-js'
import { getApiBaseUrl } from '../client/config'
import { currentStoryStore } from '../stores/currentStoryStore'
import { nodeStore } from '../stores/nodeStore'
import * as styles from './StoryDetailsModal.css'

interface BookDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  bookId: string | null
}

/**
 * Edits book metadata: name, summary, and cover art. Book cover falls back
 * to the parent story's cover in the preview when the book has no cover of
 * its own — but "Save" only persists an explicit upload.
 */
export const BookDetailsModal: Component<BookDetailsModalProps> = (props) => {
  const [name, setName] = createSignal('')
  const [summary, setSummary] = createSignal('')
  const [coverArtFileId, setCoverArtFileId] = createSignal<string | null>(null)
  const [coverArtUrl, setCoverArtUrl] = createSignal<string | null>(null)
  const [isUploading, setIsUploading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  let fileInputRef: HTMLInputElement | undefined

  const book = () => (props.bookId ? nodeStore.nodes[props.bookId] : undefined)

  createEffect(
    on(
      () => [props.isOpen, props.bookId] as const,
      ([isOpen]) => {
        if (isOpen) {
          const b = book()
          setName(b?.title ?? '')
          setSummary(b?.summary ?? '')
          setCoverArtFileId(b?.coverArtFileId ?? null)
          setCoverArtUrl(b?.coverArtUrl ?? null)
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
      if (fileInputRef) fileInputRef.value = ''
    }
  }

  const handleRemoveCover = () => {
    setCoverArtFileId(null)
    setCoverArtUrl(null)
  }

  const handleSave = () => {
    if (!props.bookId) return
    const trimmedName = name().trim()
    if (!trimmedName) {
      setError('Name is required')
      return
    }
    nodeStore.updateNode(props.bookId, {
      title: trimmedName,
      summary: summary().trim() ? summary() : undefined,
      coverArtFileId: coverArtFileId(),
      coverArtUrl: coverArtUrl(),
    })
    props.onClose()
  }

  /**
   * Preview falls back to the parent story cover when the book has no cover
   * of its own. The fallback is display-only — we never persist the story's
   * fileId onto the book.
   */
  const displayCoverUrl = () => {
    const bookCover = resolveImageUrl(coverArtUrl())
    if (bookCover) return bookCover
    return resolveImageUrl(currentStoryStore.coverArtUrl)
  }

  const isUsingFallback = () => !coverArtUrl() && !!currentStoryStore.coverArtUrl

  return (
    <Modal
      open={props.isOpen}
      onClose={props.onClose}
      title="Book Details"
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
          <label class={styles.label} for="book-details-name">
            Name
          </label>
          <input
            id="book-details-name"
            class={styles.input}
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            maxLength={200}
          />
        </div>

        <div class={styles.formSection}>
          <label class={styles.label} for="book-details-summary">
            Summary
          </label>
          <textarea
            id="book-details-summary"
            class={styles.textarea}
            value={summary()}
            onInput={(e) => setSummary(e.currentTarget.value)}
            placeholder="A short description of this book."
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
                  alt="Book cover"
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
                <Show
                  when={isUsingFallback()}
                  fallback="Images are uploaded as-is (no cropping). Recommended aspect ratio 2:3."
                >
                  Showing the story's cover as a fallback. Upload an image to override it for this book.
                </Show>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
