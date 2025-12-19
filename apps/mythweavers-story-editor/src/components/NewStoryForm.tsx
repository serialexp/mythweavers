import { Button, FormField, Input, Stack } from '@mythweavers/ui'
import { useNavigate } from '@solidjs/router'
import { BsCloudFill, BsExclamationTriangle, BsHddFill } from 'solid-icons/bs'
import { Component, Show, createSignal } from 'solid-js'
import { authStore } from '../stores/authStore'
import * as styles from './NewStoryForm.css'

interface NewStoryFormProps {
  serverAvailable: boolean
  onCreateStory: (name: string, storageMode: 'local' | 'server', calendarPresetId?: string) => void | Promise<void>
  onCancel?: () => void
  submitText?: string
}

export const NewStoryForm: Component<NewStoryFormProps> = (props) => {
  const navigate = useNavigate()
  const [storyName, setStoryName] = createSignal('')
  const [storageMode, setStorageMode] = createSignal<'local' | 'server'>('local')

  const isAuthenticated = () => authStore.isAuthenticated && !authStore.isOfflineMode

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    const name = storyName().trim()
    if (name) {
      await props.onCreateStory(name, storageMode(), 'simple365')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg">
        <FormField label="Story Name" required>
          <Input
            id="story-name"
            type="text"
            value={storyName()}
            onInput={(e) => setStoryName(e.currentTarget.value)}
            placeholder="Enter story name..."
            autofocus
            required
          />
        </FormField>

        <div>
          <label class={styles.fieldLabel}>Storage Location</label>
          <div class={styles.storageContainer}>
            <label class={styles.storageOption}>
              <input
                type="radio"
                name="storage-mode"
                checked={storageMode() === 'local'}
                onChange={() => setStorageMode('local')}
                class={styles.radio}
              />
              <BsHddFill class={styles.icon} />
              <div>
                <div class={styles.optionTitle}>Local Storage</div>
                <div class={styles.optionDescription}>Save to your browser's local storage</div>
              </div>
            </label>

            <Show
              when={props.serverAvailable && isAuthenticated()}
              fallback={
                <div class={styles.storageOptionDisabled}>
                  <Show
                    when={!isAuthenticated()}
                    fallback={
                      <>
                        <BsCloudFill class={styles.icon} />
                        <div>
                          <div class={styles.optionTitle}>Server Storage</div>
                          <div class={styles.optionDescription}>Server storage unavailable</div>
                        </div>
                      </>
                    }
                  >
                    <BsExclamationTriangle class={styles.warningIcon} />
                    <div style={{ flex: '1' }}>
                      <div class={styles.optionTitle}>Server Storage</div>
                      <div class={styles.optionDescription}>Sign in required for server storage</div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          navigate('/login')
                        }}
                        style={{ 'margin-top': '0.5rem' }}
                      >
                        Go to Login
                      </Button>
                    </div>
                  </Show>
                </div>
              }
            >
              <label class={styles.storageOption}>
                <input
                  type="radio"
                  name="storage-mode"
                  checked={storageMode() === 'server'}
                  onChange={() => setStorageMode('server')}
                  class={styles.radio}
                />
                <BsCloudFill class={styles.icon} />
                <div>
                  <div class={styles.optionTitle}>Server Storage</div>
                  <div class={styles.optionDescription}>Save to the server (requires connection)</div>
                </div>
              </label>
            </Show>
          </div>
        </div>

        <div class={styles.buttonRow}>
          <Show when={props.onCancel}>
            <Button type="button" variant="secondary" onClick={props.onCancel}>
              Cancel
            </Button>
          </Show>
          <Button type="submit" disabled={!storyName().trim()}>
            {props.submitText || 'Create Story'}
          </Button>
        </div>
      </Stack>
    </form>
  )
}
