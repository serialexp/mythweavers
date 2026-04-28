import { Component, Show, createSignal } from 'solid-js'
import { PhFileAudioIcon, PhTrashIcon } from 'solidjs-phosphor'
import { messagesStore } from '../stores/messagesStore'
import { Message as MessageType } from '../types/core'
import { resolveStoryImageUrl } from '../utils/uploadStoryImage'
import * as styles from './AudioMessage.css'
import { AudioPickerModal } from './AudioPickerModal'

interface AudioMessageProps {
  message: MessageType
}

/**
 * Renders a `type: 'audio'` message in the editor's message stream: an inline
 * `<audio controls>` player so the author can preview the embed in place,
 * plus Replace / Remove controls. The reader app renders the same kind of
 * inline player at this position in the chapter.
 *
 * "Replace" opens the unified file picker (audio-only) so the author can
 * either swap to an existing track in their library or upload a new one.
 */
export const AudioMessage: Component<AudioMessageProps> = (props) => {
  const [pickerOpen, setPickerOpen] = createSignal(false)

  const audioUrl = () => resolveStoryImageUrl(props.message.audioFile?.path ?? null)
  const filename = () => {
    const path = props.message.audioFile?.path
    if (!path) return null
    return path.split('/').pop() ?? null
  }

  const handlePicked = (file: { id: string; path: string }) => {
    // Patch the existing message in-place: keep id/sceneId/order, swap the
    // FK + hydrated track. saveService.updateMessage fires a PATCH /my/messages/:id
    // with { audioFileId } set from the message store.
    messagesStore.updateMessage(props.message.id, {
      audioFileId: file.id,
      audioFile: { id: file.id, path: file.path },
    })
    setPickerOpen(false)
  }

  const handleRemove = () => {
    if (!confirm('Remove this audio embed from the story?')) return
    messagesStore.deleteMessage(props.message.id)
  }

  return (
    <div class={styles.container}>
      <div class={styles.iconWrap}>
        <PhFileAudioIcon size={28} />
      </div>
      <div class={styles.body}>
        <div class={styles.captionRow}>
          <div class={styles.caption}>Audio embed</div>
          <Show when={filename()}>
            <div class={styles.filename}>{filename()}</div>
          </Show>
        </div>
        <Show
          when={audioUrl()}
          fallback={<div class={styles.missing}>Audio file missing</div>}
        >
          {/* Native HTML5 player so the author hears exactly what readers will. */}
          <audio class={styles.player} src={audioUrl()!} controls preload="metadata" />
        </Show>
        <div class={styles.actions}>
          <button type="button" class={styles.actionButton} onClick={() => setPickerOpen(true)}>
            Replace
          </button>
          <button type="button" class={styles.actionButton} onClick={handleRemove}>
            <PhTrashIcon size={14} /> Remove
          </button>
        </div>
      </div>

      <AudioPickerModal
        isOpen={pickerOpen()}
        selectedFileId={props.message.audioFileId ?? null}
        onPick={handlePicked}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  )
}
