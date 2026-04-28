import { Button, Modal } from '@mythweavers/ui'
import { Component } from 'solid-js'
import * as styles from './AudioPickerModal.css'
import { FilePicker } from './FilePicker'

interface AudioPickerModalProps {
  isOpen: boolean
  /** Currently-attached file id (so the matching tile is highlighted when the
   * modal opens to replace an existing embed). Pass null when starting fresh. */
  selectedFileId: string | null
  /** Fired when the user picks an existing track or finishes uploading a new
   * one. The modal closes itself before this fires so the caller can
   * immediately mutate state without flicker. */
  onPick: (file: { id: string; path: string }) => void
  onClose: () => void
}

/**
 * Modal wrapper around `<FilePicker>` for audio embeds. Used by both
 * `InsertAudioButton` (when the author wants to insert a new audio embed) and
 * `AudioMessage` (when they hit Replace on an existing one). We could re-use
 * `BackgroundOptionsModal` if we generalised it, but its scope (defaults vs.
 * inline) is different enough that a small dedicated wrapper is clearer.
 */
export const AudioPickerModal: Component<AudioPickerModalProps> = (props) => {
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
      title="Pick audio"
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
          Choose a track from your library or upload a new one. Readers see standard playback
          controls — audio never autoplays.
        </p>
        <FilePicker
          selectedFileId={props.selectedFileId}
          onSelect={handlePicked}
          onUpload={handlePicked}
          mimePrefix="audio/"
        />
      </div>
    </Modal>
  )
}
