import { IconButton } from '@mythweavers/ui'
import { Component, createSignal } from 'solid-js'
import { PhImageIcon } from 'solidjs-phosphor'
import { messagesStore } from '../stores/messagesStore'
import { BackgroundPickerModal } from './BackgroundPickerModal'

interface InsertBackgroundButtonProps {
  afterMessageId?: string | null
  nodeId?: string
}

/**
 * Insert a "background image change" message into the message flow. The
 * reader app crossfades to this image as the reader scrolls past it (and
 * uses the most-recent prior background as the chapter's entering image).
 *
 * Uses the unified `BackgroundPickerModal` (same pattern as `InsertAudioButton`)
 * so authors can reuse a previously-uploaded image from the library as well as
 * upload a new one — no more re-uploading the same file repeatedly.
 */
export const InsertBackgroundButton: Component<InsertBackgroundButtonProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false)

  const handlePicked = (file: { id: string; path: string }) => {
    if (props.afterMessageId === undefined) {
      throw new Error('afterMessageId must be defined (either a string or null)')
    }
    messagesStore.createBackgroundMessage(props.afterMessageId, file, props.nodeId)
  }

  return (
    <>
      <IconButton
        onClick={() => setIsOpen(true)}
        aria-label="Insert background image change"
        title="Insert background image change"
      >
        <PhImageIcon size={18} />
      </IconButton>
      <BackgroundPickerModal
        isOpen={isOpen()}
        selectedFileId={null}
        onPick={handlePicked}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}
