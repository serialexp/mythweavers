import { Button, FormField, IconButton, Input, Modal, Stack } from '@mythweavers/ui'
import { BsCalendarEvent, BsCodeSlash } from 'solid-icons/bs'
import { Component, createSignal } from 'solid-js'
import { messagesStore } from '../stores/messagesStore'
import { CodeEditor } from './CodeEditor'

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
      <IconButton onClick={() => setShowForm(true)} aria-label="Insert event message">
        <BsCalendarEvent size={18} />
      </IconButton>

      <Modal
        open={showForm()}
        onClose={handleCancel}
        title="Add Event Message"
        size="lg"
        footer={
          <Stack direction="horizontal" gap="sm" justify="end">
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleInsert} disabled={!eventContent().trim()}>
              Insert Event
            </Button>
          </Stack>
        }
      >
        <Stack direction="vertical" gap="md">
          <FormField label="Event Description" hint="Brief description of the event or state change">
            <Input
              placeholder="e.g. 'The Christophsis system is invaded by the separatists'"
              value={eventContent()}
              onInput={(e) => setEventContent(e.currentTarget.value)}
              autofocus
            />
          </FormField>

          <FormField
            label={
              <span style={{ display: 'flex', 'align-items': 'center', gap: '0.25rem' }}>
                <BsCodeSlash /> Script (Optional)
              </span>
            }
            hint="JavaScript code to execute when this event is reached"
          >
            <div
              style={{
                border: '1px solid var(--border-color)',
                'border-radius': '4px',
                overflow: 'hidden',
              }}
            >
              <CodeEditor value={eventScript()} onChange={setEventScript} height="300px" />
            </div>
          </FormField>
        </Stack>
      </Modal>
    </>
  )
}
