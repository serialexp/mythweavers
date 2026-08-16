import { Button } from '@mythweavers/ui'
import { Component, Show, createSignal } from 'solid-js'
import { currentStoryStore } from '../../stores/currentStoryStore'
import { resolveStoryImageUrl } from '../../utils/uploadStoryImage'
import { FilePicker } from '../FilePicker'
import * as styles from './MapImageField.css'

/**
 * The image a map should use, in whichever form its story can persist.
 *
 * Server stories reference an uploaded File row; local stories have nowhere to
 * put a file, so they keep the bytes inline as they always have. Both carry a
 * `previewUrl` so the caller can show the choice back without re-reading it.
 */
export interface MapImageValue {
  fileId: string | null
  imageData: string
  previewUrl: string | null
}

interface MapImageFieldProps {
  /** Current selection. `previewUrl` may be null while a map's image is still loading. */
  value: MapImageValue
  onChange: (value: MapImageValue) => void
  disabled?: boolean
  /** Shown above the picker; the create form and the settings modal word it differently. */
  help?: string
}

const EMPTY: MapImageValue = { fileId: null, imageData: '', previewUrl: null }

/**
 * Picks the image for a map, for both the create form and the settings modal.
 *
 * Split out rather than written twice because the two contexts have to agree on
 * how an image is stored -- a create path that produced base64 and an edit path
 * that produced a fileId would leave maps in two different shapes depending on
 * how they were last touched.
 */
export const MapImageField: Component<MapImageFieldProps> = (props) => {
  const [localError, setLocalError] = createSignal<string | null>(null)

  const isServerStory = () => currentStoryStore.storageMode === 'server'
  const previewSrc = () => resolveStoryImageUrl(props.value.previewUrl) ?? props.value.imageData ?? null

  const handlePicked = (file: { id: string; path: string }) => {
    setLocalError(null)
    props.onChange({ fileId: file.id, imageData: '', previewUrl: file.path })
  }

  const handleRemove = () => {
    setLocalError(null)
    props.onChange({ ...EMPTY })
  }

  // Local stories have no file store to upload to, so the bytes travel with the
  // map itself. Reading the file here (rather than at save time) means the
  // preview and the saved value can never disagree.
  const handleLocalFile = (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setLocalError('That file is not an image.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const imageData = e.target?.result as string
      setLocalError(null)
      props.onChange({ fileId: null, imageData, previewUrl: null })
    }
    reader.onerror = () => setLocalError('That file could not be read.')
    reader.readAsDataURL(file)
  }

  const hasImage = () => Boolean(props.value.fileId || props.value.imageData)

  return (
    <div class={styles.field}>
      <div class={styles.row}>
        <div class={styles.preview}>
          <Show when={previewSrc()} fallback={<span>No image</span>}>
            <img class={styles.previewImage} src={previewSrc()!} alt="Map" />
          </Show>
        </div>
        <div class={styles.actions}>
          <Show when={hasImage()}>
            <Button variant="secondary" onClick={handleRemove} disabled={props.disabled}>
              Remove Image
            </Button>
          </Show>
          <Show when={props.help}>
            <div class={styles.help}>{props.help}</div>
          </Show>
          <Show when={localError()}>
            <div class={styles.error}>{localError()}</div>
          </Show>
        </div>
      </div>

      <Show
        when={isServerStory()}
        fallback={
          <label class={styles.localUpload}>
            <input
              type="file"
              accept="image/*"
              class={styles.hiddenInput}
              onChange={handleLocalFile}
              disabled={props.disabled}
            />
            <span class={styles.localUploadLabel}>Choose map image...</span>
          </label>
        }
      >
        <FilePicker
          selectedFileId={props.value.fileId}
          onSelect={handlePicked}
          onUpload={handlePicked}
          mimePrefix="image/"
          disabled={props.disabled}
        />
      </Show>
    </div>
  )
}
