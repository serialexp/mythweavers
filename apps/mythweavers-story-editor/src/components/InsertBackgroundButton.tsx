import { IconButton } from '@mythweavers/ui'
import { Component, createSignal } from 'solid-js'
import { PhImageIcon } from 'solidjs-phosphor'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { uploadStoryImage } from '../utils/uploadStoryImage'

interface InsertBackgroundButtonProps {
  afterMessageId?: string | null
  nodeId?: string
}

/**
 * Insert a "background image change" message into the message flow. The
 * reader app crossfades to this image as the reader scrolls past it (and
 * uses the most-recent prior background as the chapter's entering image).
 *
 * The flow is intentionally one-shot: open file picker → upload → insert
 * a message of type 'background' carrying the uploaded fileId. There's no
 * preview modal because the message itself renders a thumbnail in the
 * message stream once inserted (handled by Message.tsx).
 */
export const InsertBackgroundButton: Component<InsertBackgroundButtonProps> = (props) => {
  const [isUploading, setIsUploading] = createSignal(false)
  let fileInputRef: HTMLInputElement | undefined

  const handleClick = () => {
    if (isUploading()) return
    fileInputRef?.click()
  }

  const handleFileSelected = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    if (props.afterMessageId === undefined) {
      throw new Error('afterMessageId must be defined (either a string or null)')
    }

    setIsUploading(true)
    try {
      const uploaded = await uploadStoryImage(file, currentStoryStore.id ?? undefined)
      messagesStore.createBackgroundMessage(props.afterMessageId, uploaded, props.nodeId)
    } catch (err) {
      // TODO: route through a shared toast/notification system once one exists.
      console.error('[InsertBackgroundButton] Failed to upload background image:', err)
      alert(err instanceof Error ? err.message : 'Failed to upload background image')
    } finally {
      setIsUploading(false)
      // Reset so re-selecting the same file still fires change.
      if (fileInputRef) fileInputRef.value = ''
    }
  }

  return (
    <>
      <IconButton
        onClick={handleClick}
        aria-label="Insert background image change"
        title={isUploading() ? 'Uploading…' : 'Insert background image change'}
        disabled={isUploading()}
      >
        <PhImageIcon size={18} />
      </IconButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />
    </>
  )
}
