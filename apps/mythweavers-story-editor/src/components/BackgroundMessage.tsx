import { Component, Show, createSignal } from 'solid-js'
import { PhImageIcon, PhTrashIcon } from 'solidjs-phosphor'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { Message as MessageType } from '../types/core'
import { resolveStoryImageUrl, uploadStoryImage } from '../utils/uploadStoryImage'
import * as styles from './BackgroundMessage.css'

interface BackgroundMessageProps {
  message: MessageType
}

/**
 * Renders a `type: 'background'` message in the editor's message stream:
 * a thumbnail of the chosen image with controls to Replace (re-upload) or
 * Remove (delete the message). The reader app crossfades to this image as
 * the reader scrolls past it.
 */
export const BackgroundMessage: Component<BackgroundMessageProps> = (props) => {
  const [isUploading, setIsUploading] = createSignal(false)
  let fileInputRef: HTMLInputElement | undefined

  const imageUrl = () => resolveStoryImageUrl(props.message.backgroundFile?.path ?? null)

  const handleReplaceClick = () => {
    if (isUploading()) return
    fileInputRef?.click()
  }

  const handleFileSelected = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const uploaded = await uploadStoryImage(file, currentStoryStore.id ?? undefined)
      // Patch the existing message in-place: keep the same id/sceneId/order,
      // swap the FK + hydrated thumbnail. saveService.updateMessage will fire
      // a PATCH /my/messages/:id with { backgroundFileId } from messagesStore.
      messagesStore.updateMessage(props.message.id, {
        backgroundFileId: uploaded.id,
        backgroundFile: { id: uploaded.id, path: uploaded.path },
      })
    } catch (err) {
      console.error('[BackgroundMessage] Failed to upload replacement image:', err)
      alert(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setIsUploading(false)
      if (fileInputRef) fileInputRef.value = ''
    }
  }

  const handleRemove = () => {
    if (!confirm('Remove this background change from the story?')) return
    messagesStore.deleteMessage(props.message.id)
  }

  return (
    <div class={styles.container}>
      <div class={styles.thumbnailWrap}>
        <Show
          when={imageUrl()}
          fallback={
            <div class={styles.placeholder}>
              <PhImageIcon size={28} />
              <span>Image missing</span>
            </div>
          }
        >
          <img src={imageUrl()!} alt="" class={styles.thumbnail} />
        </Show>
      </div>
      <div class={styles.body}>
        <div class={styles.caption}>Background changes here</div>
        <div class={styles.actions}>
          <button
            type="button"
            class={styles.actionButton}
            onClick={handleReplaceClick}
            disabled={isUploading()}
          >
            {isUploading() ? 'Uploading…' : 'Replace'}
          </button>
          <button type="button" class={styles.actionButton} onClick={handleRemove}>
            <PhTrashIcon size={14} /> Remove
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />
    </div>
  )
}
