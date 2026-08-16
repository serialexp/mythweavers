import { Button, Modal } from '@mythweavers/ui'
import { Component, Show, createEffect, createSignal, on } from 'solid-js'
import { mapsStore } from '../../stores/mapsStore'
import { StoryMap } from '../../types/core'
import { EJSCodeEditor } from '../EJSCodeEditor'
import { MapImageField, MapImageValue } from './MapImageField'
import * as styles from './MapSettingsModal.css'

interface MapSettingsModalProps {
  isOpen: boolean
  map: StoryMap | null
  onClose: () => void
}

/**
 * Edits everything about a map that is not its contents: name, image and the
 * landmark border-colour template.
 *
 * The image was previously settable only at create time, which made a broken or
 * mistaken picture permanent -- the store even told users to "edit the map and
 * upload the image again", with no such affordance anywhere.
 */
export const MapSettingsModal: Component<MapSettingsModalProps> = (props) => {
  const [name, setName] = createSignal('')
  const [borderColor, setBorderColor] = createSignal('')
  const [image, setImage] = createSignal<MapImageValue>({ fileId: null, imageData: '', previewUrl: null })
  const [error, setError] = createSignal<string | null>(null)
  const [saving, setSaving] = createSignal(false)
  /**
   * Whether the user actually touched the picture. Without this, saving a rename
   * would also send whatever the form believes the image to be -- and a map
   * whose details failed to load believes it has none, which would clear a
   * perfectly good image on the server.
   */
  const [imageTouched, setImageTouched] = createSignal(false)

  const handleImageChange = (value: MapImageValue) => {
    setImageTouched(true)
    setImage(value)
  }

  // Seed the form whenever the modal opens, so a cancelled edit leaves nothing
  // behind for the next one to inherit.
  createEffect(
    on(
      () => props.isOpen,
      (isOpen) => {
        if (!isOpen) return
        const map = props.map
        setName(map?.name ?? '')
        setBorderColor(map?.borderColor ?? '')
        setImage({
          fileId: map?.fileId ?? null,
          // The map's live image is already a resolved object URL, so it can be
          // previewed directly -- there is no path to resolve.
          imageData: map?.imageData ?? '',
          previewUrl: null,
        })
        setImageTouched(false)
        setError(null)
        setSaving(false)
      },
    ),
  )

  const handleSave = async () => {
    const map = props.map
    if (!map) return

    const trimmedName = name().trim()
    if (!trimmedName) {
      setError('Name is required')
      return
    }

    const selected = image()
    setSaving(true)
    try {
      await mapsStore.updateMap(map.id, {
        name: trimmedName,
        borderColor: borderColor().trim() || undefined,
        // Omitted entirely unless the picture was edited, so an untouched image
        // is left exactly as the server has it.
        ...(imageTouched()
          ? {
              fileId: selected.fileId,
              // Only local stories carry their own bytes; a server story's
              // imageData is a resolved object URL that must not be sent back.
              ...(selected.imageData ? { imageData: selected.imageData } : {}),
            }
          : {}),
      })
      props.onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the map')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={props.isOpen}
      onClose={props.onClose}
      title="Map Settings"
      size="md"
      footer={
        <div class={styles.actions}>
          <Button variant="secondary" onClick={props.onClose} disabled={saving()}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving()}>
            {saving() ? 'Saving...' : 'Save'}
          </Button>
        </div>
      }
    >
      <div class={styles.modalContent}>
        <Show when={error()}>
          <div class={styles.errorBox}>{error()}</div>
        </Show>

        <div class={styles.formSection}>
          <label class={styles.label} for="map-settings-name">
            Name
          </label>
          <input
            id="map-settings-name"
            class={styles.input}
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            maxLength={200}
          />
        </div>

        <div class={styles.formSection}>
          <label class={styles.label}>Map Image</label>
          <MapImageField
            value={image()}
            onChange={handleImageChange}
            disabled={saving()}
            help="Pick an image from your library or upload a new one. Replacing it keeps every landmark, fleet and hyperlane where it is."
          />
        </div>

        <div class={styles.formSection}>
          <label class={styles.label}>Border Colour Template</label>
          <EJSCodeEditor
            value={borderColor()}
            onChange={setBorderColor}
            placeholder="Border color template (optional)"
            minHeight="100px"
          />
        </div>
      </div>
    </Modal>
  )
}
