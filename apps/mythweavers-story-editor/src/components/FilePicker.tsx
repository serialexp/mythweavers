import { Button } from '@mythweavers/ui'
import { Component, For, Show, createEffect, createSignal, on } from 'solid-js'
import { PhFileAudioIcon, PhFileIcon, PhImageBrokenIcon, PhTrashIcon } from 'solidjs-phosphor'
import { deleteMyFilesById, getMyFiles } from '../client/config'
import { currentStoryStore } from '../stores/currentStoryStore'
import { resolveStoryImageUrl, uploadStoryImage } from '../utils/uploadStoryImage'
import { FileDeleteConfirmModal } from './FileDeleteConfirmModal'
import * as styles from './FilePicker.css'
import { ImageCropModal } from './ImageCropModal'

/** Optional crop step performed before an uploaded file is sent to the server.
 * Only applies to image uploads — audio uploads always bypass cropping
 * regardless of this prop. Existing files picked from the grid are never
 * re-cropped. */
export interface FilePickerCropConfig {
  /** Aspect ratio of the crop area (default: 1). */
  aspectRatio?: number
  /** Whether the crop area is rendered as a circle (default: true). */
  circular?: boolean
  /** Output edge size in pixels (default: 256). */
  outputSize?: number
}

/** Convert a data URL produced by the cropper into a File ready for upload. */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const mimeMatch = dataUrl.match(/data:([^;]+);/)
  const mimeType = mimeMatch?.[1] ?? 'image/jpeg'
  const base64 = dataUrl.split(',')[1] ?? ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], filename, { type: mimeType })
}

/** A file row as returned by GET /my/files. We only consume what we display. */
export interface PickableFile {
  id: string
  path: string
  mimeType: string
  storyId: string | null
  createdAt: string
}

interface FilePickerProps {
  /** Currently-selected file id (so the matching tile gets highlighted). */
  selectedFileId: string | null
  /** Called when the user clicks an existing tile. The file's resolved URL
   * `path` is included so the caller can mirror it into a preview without a
   * second fetch. */
  onSelect: (file: { id: string; path: string }) => void
  /** Called when an upload completes. Same shape as onSelect — callers usually
   * route both through the same setter. */
  onUpload: (file: { id: string; path: string }) => void
  /** When set, only files whose `mimeType` starts with this prefix render
   * (e.g. "image/", "audio/"). Drives the file input's `accept` attribute and
   * the empty-state copy. Defaults to "image/" so existing image-only callers
   * keep their behaviour without specifying anything. */
  mimePrefix?: string
  /** Disable interactions while parent is saving. */
  disabled?: boolean
  /** When set AND the upload is an image, route the file through a cropper
   * before uploading. Audio uploads ignore this — there's no meaningful crop
   * for non-visual media. */
  cropConfig?: FilePickerCropConfig
}

const PAGE_SIZE = 24

const isImageMime = (mime: string) => mime.startsWith('image/')
const isAudioMime = (mime: string) => mime.startsWith('audio/')

/**
 * Reusable browser for files the user has already uploaded. Defaults to
 * showing only files associated with the current story; a toggle reveals
 * everything across the user's account so assets can be reused across stories.
 *
 * Mime-aware tile rendering: image files render as cover-fitted thumbnails,
 * audio files render as a card with an icon + filename. The grid layout is
 * shared so a mixed-media library would still work, but in practice each
 * caller passes a `mimePrefix` to scope the picker.
 *
 * This component is purely a "pick or upload" surface — it doesn't persist
 * anything. The caller is responsible for taking the selected/uploaded file
 * and writing it to the relevant entity through saveService.
 */
export const FilePicker: Component<FilePickerProps> = (props) => {
  const [scope, setScope] = createSignal<'story' | 'all'>('story')
  const [files, setFiles] = createSignal<PickableFile[]>([])
  const [page, setPage] = createSignal(1)
  const [totalPages, setTotalPages] = createSignal(1)
  const [isLoading, setIsLoading] = createSignal(false)
  const [isUploading, setIsUploading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  // Holds the data URL handed to <ImageCropModal> while the user adjusts the
  // crop. Null means the modal is closed.
  const [cropSource, setCropSource] = createSignal<string | null>(null)
  // Original filename of the file currently being cropped. We preserve it on
  // the resulting upload so the server-side path remains recognisable.
  const [cropFilename, setCropFilename] = createSignal<string>('upload.jpg')
  // The file the user is actively considering deleting. Drives the confirm
  // modal — null means the modal is closed.
  const [pendingDelete, setPendingDelete] = createSignal<PickableFile | null>(null)
  const [isDeleting, setIsDeleting] = createSignal(false)

  let fileInputRef: HTMLInputElement | undefined

  // Effective prefix used for both file input `accept` and the /my/files
  // mime-filter. Image-by-default keeps existing callers backwards compatible.
  const mimePrefix = () => props.mimePrefix ?? 'image/'
  const isAudioPicker = () => mimePrefix().startsWith('audio/')

  const loadPage = async (targetPage: number, append: boolean) => {
    const storyId = currentStoryStore.id
    setIsLoading(true)
    setError(null)
    try {
      const query: { page: number; limit: number; storyId?: string } = {
        page: targetPage,
        limit: PAGE_SIZE,
      }
      if (scope() === 'story' && storyId) {
        query.storyId = storyId
      }
      const res = await getMyFiles({ query })
      if (res.error) {
        throw new Error((res.error as { error?: string }).error || 'Failed to load files')
      }
      const incoming = res.data?.files ?? []
      const filtered = incoming.filter((f) => f.mimeType.startsWith(mimePrefix()))
      setFiles((prev) => (append ? [...prev, ...filtered] : filtered))
      setPage(res.data?.pagination.page ?? targetPage)
      setTotalPages(res.data?.pagination.totalPages ?? 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
    } finally {
      setIsLoading(false)
    }
  }

  // Reload from page 1 whenever scope flips. (Initial load also runs because
  // scope() is read at mount.)
  createEffect(
    on(scope, () => {
      void loadPage(1, false)
    }),
  )

  /** Upload an already-finalized File (post-crop, or raw) and emit `onUpload`.
   * Optimistically prepends the new file to the grid. */
  const performUpload = async (file: File) => {
    setIsUploading(true)
    setError(null)
    try {
      const uploaded = await uploadStoryImage(file, currentStoryStore.id ?? undefined)
      // Optimistically prepend the new file so the user sees it without a
      // round-trip to /my/files. The next reload (e.g. scope change) will
      // pick it up canonically.
      const optimistic: PickableFile = {
        id: uploaded.id,
        path: uploaded.path,
        mimeType: file.type || `${mimePrefix()}*`,
        storyId: currentStoryStore.id ?? null,
        createdAt: new Date().toISOString(),
      }
      setFiles((prev) => [optimistic, ...prev.filter((f) => f.id !== uploaded.id)])
      props.onUpload({ id: uploaded.id, path: uploaded.path })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  const handleUpload = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    // Cropping only makes sense for images. Even if the caller passed a
    // cropConfig, audio uploads bypass it.
    const shouldCrop = props.cropConfig && isImageMime(file.type || '')
    if (shouldCrop) {
      // Read into a data URL so the cropper can render it. We defer the
      // actual upload until the user confirms the crop in the modal.
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCropFilename(file.name || 'upload.jpg')
          setCropSource(reader.result)
        }
      }
      reader.onerror = () => setError('Failed to read file for cropping')
      reader.readAsDataURL(file)
      // Reset the input now so picking the same file again still re-triggers.
      if (fileInputRef) fileInputRef.value = ''
      return
    }

    try {
      await performUpload(file)
    } finally {
      if (fileInputRef) fileInputRef.value = ''
    }
  }

  const handleCropConfirm = async (dataUrl: string) => {
    const filename = cropFilename()
    setCropSource(null)
    const file = dataUrlToFile(dataUrl, filename)
    await performUpload(file)
  }

  const handleCropCancel = () => {
    setCropSource(null)
  }

  /** Confirmed delete from the modal: hit the API, then remove the row from
   * the local grid. The modal owns the confirmation flow; we own the list. */
  const handleConfirmDelete = async () => {
    const target = pendingDelete()
    if (!target) return
    setIsDeleting(true)
    setError(null)
    try {
      const { error: apiError } = await deleteMyFilesById({ path: { id: target.id } })
      if (apiError) {
        throw new Error((apiError as { error?: string }).error || 'Failed to delete file')
      }
      setFiles((prev) => prev.filter((f) => f.id !== target.id))
      setPendingDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file')
    } finally {
      setIsDeleting(false)
    }
  }

  const canShowStoryToggle = () => Boolean(currentStoryStore.id)

  // Empty-state copy adjusts to whatever media is being browsed.
  const emptyMessage = () => {
    const noun = isAudioPicker() ? 'audio files' : 'images'
    if (scope() === 'story') {
      return `No ${noun} uploaded for this story yet. Upload one above to get started.`
    }
    return `You have not uploaded any ${noun} yet.`
  }

  return (
    <div class={styles.root}>
      <div class={styles.toolbar}>
        <Show when={canShowStoryToggle()}>
          <div class={styles.toggleGroup} role="tablist" aria-label="File scope">
            <button
              type="button"
              class={`${styles.toggleButton} ${scope() === 'story' ? styles.toggleButtonActive : ''}`}
              onClick={() => setScope('story')}
              aria-pressed={scope() === 'story'}
              disabled={props.disabled}
            >
              This story
            </button>
            <button
              type="button"
              class={`${styles.toggleButton} ${scope() === 'all' ? styles.toggleButtonActive : ''}`}
              onClick={() => setScope('all')}
              aria-pressed={scope() === 'all'}
              disabled={props.disabled}
            >
              All files
            </button>
          </div>
        </Show>

        <div class={styles.uploadRow}>
          <input
            ref={fileInputRef}
            class={styles.hiddenInput}
            type="file"
            accept={`${mimePrefix()}*`}
            onChange={handleUpload}
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef?.click()}
            disabled={isUploading() || props.disabled}
          >
            {isUploading() ? 'Uploading…' : 'Upload new'}
          </Button>
        </div>
      </div>

      <Show when={error()}>
        <div class={styles.errorBox}>{error()}</div>
      </Show>

      <Show
        when={files().length > 0 || !isLoading()}
        fallback={<div class={styles.status}>Loading…</div>}
      >
        <Show
          when={files().length > 0}
          fallback={<div class={styles.empty}>{emptyMessage()}</div>}
        >
          <div class={styles.grid}>
            <For each={files()}>
              {(file) => {
                const isSelected = () => props.selectedFileId === file.id
                const url = () => resolveStoryImageUrl(file.path)
                const filename = () => file.path.split('/').pop() ?? file.id
                // Per-tile error flag: image elements with broken/404 srcs render
                // as zero-content, which (combined with the surrounding button)
                // looks like a blank tile. Track failure here and swap to an
                // explicit broken-image placeholder so the user can still see
                // the tile, click to select, or hit the delete button on it.
                const [imageErrored, setImageErrored] = createSignal(false)
                // Tile is a wrapping <div> instead of a <button> so the delete
                // overlay can host its own <button> without nesting interactive
                // elements (which is invalid HTML and breaks keyboard nav).
                return (
                  <div
                    class={`${styles.tile} ${isSelected() ? styles.tileSelected : ''}`}
                    title={filename()}
                  >
                    <button
                      type="button"
                      class={styles.tileSelectButton}
                      onClick={() => props.onSelect({ id: file.id, path: file.path })}
                      disabled={props.disabled}
                      aria-label={`Select ${filename()}`}
                    >
                      <Show
                        when={isImageMime(file.mimeType) && !imageErrored()}
                        fallback={
                          <div class={styles.fileTileBody}>
                            <Show
                              when={isImageMime(file.mimeType) && imageErrored()}
                              fallback={
                                <Show when={isAudioMime(file.mimeType)} fallback={<PhFileIcon size={28} />}>
                                  <PhFileAudioIcon size={28} />
                                </Show>
                              }
                            >
                              <PhImageBrokenIcon size={28} />
                            </Show>
                            <span class={styles.fileTileLabel}>{filename()}</span>
                          </div>
                        }
                      >
                        <Show when={url()}>
                          <img
                            class={styles.tileImage}
                            src={url()!}
                            alt=""
                            loading="lazy"
                            onError={() => setImageErrored(true)}
                          />
                        </Show>
                      </Show>
                    </button>
                    <button
                      type="button"
                      class={styles.tileDeleteButton}
                      data-tile-delete=""
                      onClick={(event) => {
                        // Prevent the click from bubbling to the parent select
                        // handler — picking and deleting are different intents.
                        event.stopPropagation()
                        setPendingDelete(file)
                      }}
                      disabled={props.disabled || isDeleting()}
                      aria-label={`Delete ${filename()}`}
                      title="Delete file"
                    >
                      <PhTrashIcon size={14} />
                    </button>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>
      </Show>

      <Show when={page() < totalPages()}>
        <div class={styles.loadMoreRow}>
          <Button
            variant="secondary"
            onClick={() => loadPage(page() + 1, true)}
            disabled={isLoading() || props.disabled}
          >
            {isLoading() ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      </Show>

      <Show when={props.cropConfig}>
        <ImageCropModal
          isOpen={cropSource() !== null}
          imageSrc={cropSource()}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
          aspectRatio={props.cropConfig?.aspectRatio ?? 1}
          circular={props.cropConfig?.circular ?? true}
          outputSize={props.cropConfig?.outputSize ?? 256}
        />
      </Show>

      <FileDeleteConfirmModal
        file={pendingDelete()}
        onClose={() => {
          if (!isDeleting()) setPendingDelete(null)
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting()}
      />
    </div>
  )
}
