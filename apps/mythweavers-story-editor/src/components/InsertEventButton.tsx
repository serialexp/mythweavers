import { Component, createSignal, Show } from 'solid-js'
import { BsCalendarEvent, BsCodeSlash } from 'solid-icons/bs'
import { messagesStore } from '../stores/messagesStore'
import { IconButton } from './IconButton'
import { CodeEditor } from './CodeEditor'
import styles from './InsertEventButton.module.css'

interface InsertEventButtonProps {
  afterMessageId?: string | null
}

const DEFAULT_EVENT_SCRIPT = `(data, functions) => {
  // Event scripts modify the story's data state
  // Data is immutable - write normal mutation code but original data is preserved!

  // Example: Update location or state
  // data.location = 'New York';
  // data.timeOfDay = 'evening';

  // Example: Track event flags
  // data.events = data.events || {};
  // data.events.battleStarted = true;

  // Example: Update character states
  // if (data.characters?.luke) {
  //   data.characters.luke.hasLightsaber = true;
  // }
}`

export const InsertEventButton: Component<InsertEventButtonProps> = (props) => {
  const [showForm, setShowForm] = createSignal(false)
  const [eventContent, setEventContent] = createSignal('')
  const [eventScript, setEventScript] = createSignal(DEFAULT_EVENT_SCRIPT)
  
  const handleInsert = () => {
    const content = eventContent().trim()
    const script = eventScript().trim()

    if (!content) return

    if (props.afterMessageId === undefined) {
      throw new Error('afterMessageId must be defined (either a string or null)')
    }

    messagesStore.createEventMessage(props.afterMessageId, content, script)
    
    // Reset form
    setEventContent('')
    setEventScript(DEFAULT_EVENT_SCRIPT)
    setShowForm(false)
  }
  
  const handleCancel = () => {
    setEventContent('')
    setEventScript(DEFAULT_EVENT_SCRIPT)
    setShowForm(false)
  }
  
  return (
    <>
      <IconButton
        onClick={() => setShowForm(true)}
        title="Insert event message"
      >
        <BsCalendarEvent size={18} />
      </IconButton>
      
      <Show when={showForm()}>
        <div class={styles.modalOverlay} onClick={handleCancel}>
          <div class={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div class={styles.modalHeader}>
              <h3 class={styles.modalTitle}>Add Event Message</h3>
              <button class={styles.closeButton} onClick={handleCancel}>
                ×
              </button>
            </div>

            <div class={styles.modalBody}>
              <div class={styles.formGroup}>
              <label class={styles.label}>Event Description</label>
              <input
                type="text"
                class={styles.input}
                placeholder="e.g. 'The Christophsis system is invaded by the separatists'"
                value={eventContent()}
                onInput={(e) => setEventContent(e.currentTarget.value)}
                autofocus
              />
              <p class={styles.hint}>
                Brief description of the event or state change
              </p>
            </div>
            
            <div class={styles.formGroup}>
              <label class={styles.label}>
                <BsCodeSlash /> Script (Optional)
              </label>
              <div class={styles.editorContainer}>
                <CodeEditor
                  value={eventScript()}
                  onChange={setEventScript}
                  height="300px"
                />
              </div>
              <p class={styles.hint}>
                JavaScript code to execute when this event is reached
              </p>
            </div>
            </div>

            <div class={styles.modalFooter}>
              <button
                class={styles.insertButtonConfirm}
                onClick={handleInsert}
                disabled={!eventContent().trim()}
              >
                Insert Event
              </button>
              <button
                class={styles.cancelButton}
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  )
}