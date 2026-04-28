import { IconButton } from '@mythweavers/ui'
import { Component, createSignal } from 'solid-js'
import { PhMusicNoteIcon } from 'solidjs-phosphor'
import { messagesStore } from '../stores/messagesStore'
import { AudioPickerModal } from './AudioPickerModal'

interface InsertAudioButtonProps {
  afterMessageId?: string | null
  nodeId?: string
}

/**
 * Insert an inline audio embed message into the message flow. Unlike
 * `InsertBackgroundButton` (which uses a native file picker because background
 * images carry forward and re-use is rare), audio embeds are picked through
 * the unified `AudioPickerModal` so the author can reuse a previously
 * uploaded track from the library or upload a new one.
 *
 * The reader renders an inline `<audio controls>` element wherever this
 * message lands — playback is reader-initiated, never autoplay.
 */
export const InsertAudioButton: Component<InsertAudioButtonProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false)

  const handlePicked = (file: { id: string; path: string }) => {
    if (props.afterMessageId === undefined) {
      throw new Error('afterMessageId must be defined (either a string or null)')
    }
    messagesStore.createAudioMessage(props.afterMessageId, file, props.nodeId)
  }

  return (
    <>
      <IconButton
        onClick={() => setIsOpen(true)}
        aria-label="Insert audio embed"
        title="Insert audio embed"
      >
        <PhMusicNoteIcon size={18} />
      </IconButton>
      <AudioPickerModal
        isOpen={isOpen()}
        selectedFileId={null}
        onPick={handlePicked}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}
