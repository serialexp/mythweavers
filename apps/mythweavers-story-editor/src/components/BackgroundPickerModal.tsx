import { Button, Modal } from '@mythweavers/ui'
import { Component } from 'solid-js'
import * as styles from './BackgroundPickerModal.css'
import { FilePicker } from './FilePicker'

interface BackgroundPickerModalProps {
  isOpen: boolean
  /** Currently-attached file id (so the matching tile is highlighted when the
   * modal opens to replace an existing background). Pass null when starting fresh. */
  selectedFileId: string | null
  /** Fired when the user picks an existing image or finishes uploading a new
   * one. The modal closes itself before this fires so the caller can
   * immediately mutate state without flicker. */
  onPick: (file: { id: string; path: string }) => void
  onClose: () => void
}

/**
 * Modal wrapper around `<FilePicker>` for inline "background image change"
 * embeds. Mirrors `AudioPickerModal` so authors can pick from previously
 * uploaded images as well as upload a new one — the previous native-input
 * flow forced a re-upload every time even when the same image was already
 * in the library.
 */
export const BackgroundPickerModal: Component<BackgroundPickerModalProps> = (props) => {
  const handlePicked = (file: { id: string; path: string }) => {
    // Close before bubbling so callers see the modal already gone when they
    // optimistically update the UI with the new selection.
    props.onClose()
    props.onPick(file)
  }

  return (
    <Modal
      open={props.isOpen}
      onClose={props.onClose}
      title="Pick background image"
      size="md"
      footer={
        <div class={styles.footer}>
          <Button variant="secondary" onClick={props.onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <div class={styles.body}>
        <p class={styles.help}>
          Choose an image from your library or upload a new one. The reader crossfades to it as
          they scroll past.
        </p>
        <FilePicker
          selectedFileId={props.selectedFileId}
          onSelect={handlePicked}
          onUpload={handlePicked}
          mimePrefix="image/"
        />
      </div>
    </Modal>
  )
}
