import { Component, Show, createSignal, For, createResource } from 'solid-js'
import { BsHddFill, BsCloudFill, BsExclamationTriangle } from 'solid-icons/bs'
import { useNavigate } from '@solidjs/router'
import { authStore } from '../stores/authStore'
import { getCalendarsPresets } from '../client/config'
import { CalendarConfig } from '@story/shared'
import styles from './NewStoryForm.module.css'

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
  const [calendarPresetId, setCalendarPresetId] = createSignal('simple365')

  const isAuthenticated = () => authStore.isAuthenticated && !authStore.isOfflineMode

  // Fetch calendar presets
  const [calendarPresets] = createResource<CalendarConfig[]>(async () => {
    try {
      const response = await getCalendarsPresets()
      return response.data?.presets || []
    } catch (error) {
      console.error('Failed to fetch calendar presets:', error)
      // Return default presets as fallback
      return []
    }
  })

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    const name = storyName().trim()
    if (name) {
      await props.onCreateStory(name, storageMode(), calendarPresetId())
    }
  }

  return (
    <form onSubmit={handleSubmit} class={styles.form}>
      <div class={styles.formGroup}>
        <label for="story-name" class={styles.label}>Story Name</label>
        <input
          id="story-name"
          type="text"
          value={storyName()}
          onInput={(e) => setStoryName(e.target.value)}
          placeholder="Enter story name..."
          class={styles.input}
          autofocus
          required
        />
      </div>

      <div class={styles.formGroup}>
        <label for="calendar-preset" class={styles.label}>Calendar System</label>
        <select
          id="calendar-preset"
          value={calendarPresetId()}
          onChange={(e) => setCalendarPresetId(e.target.value)}
          class={styles.select}
        >
          <Show when={!calendarPresets.loading && calendarPresets()}>
            <For each={calendarPresets()}>
              {(preset) => (
                <option value={preset.id}>{preset.name}</option>
              )}
            </For>
          </Show>
        </select>
        <Show when={calendarPresets() && calendarPresets()!.length > 0}>
          <div class={styles.calendarDescription}>
            {calendarPresets()!.find(p => p.id === calendarPresetId())?.description || ''}
          </div>
        </Show>
      </div>

      <div class={styles.formGroup}>
        <label class={styles.label}>Storage Location</label>
        <div class={styles.storageOptions}>
          <label class={styles.storageOption}>
            <input
              type="radio"
              name="storage-mode"
              checked={storageMode() === 'local'}
              onChange={() => setStorageMode('local')}
              class={styles.radio}
            />
            <BsHddFill class={styles.storageIcon} />
            <div>
              <div class={styles.storageTitle}>Local Storage</div>
              <div class={styles.storageDescription}>Save to your browser's local storage</div>
            </div>
          </label>

          <Show 
            when={props.serverAvailable && isAuthenticated()}
            fallback={
              <div class={styles.serverUnavailable}>
                <Show 
                  when={!isAuthenticated()}
                  fallback={
                    <>
                      <BsCloudFill class={styles.storageIcon} />
                      <div>
                        <div class={styles.storageTitle}>Server Storage</div>
                        <div class={styles.storageDescription}>Server storage unavailable</div>
                      </div>
                    </>
                  }
                >
                  <BsExclamationTriangle class={styles.warningIcon} />
                  <div class={styles.authWarning}>
                    <div class={styles.storageTitle}>Server Storage</div>
                    <div class={styles.storageDescription}>Sign in required for server storage</div>
                    <button 
                      type="button"
                      class={styles.loginButton}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        navigate('/login')
                      }}
                    >
                      Go to Login
                    </button>
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
              <BsCloudFill class={styles.storageIcon} />
              <div>
                <div class={styles.storageTitle}>Server Storage</div>
                <div class={styles.storageDescription}>Save to the server (requires connection)</div>
              </div>
            </label>
          </Show>
        </div>
      </div>

      <div class={styles.actions}>
        <Show when={props.onCancel}>
          <button
            type="button"
            onClick={props.onCancel}
            class={styles.cancelButton}
          >
            Cancel
          </button>
        </Show>
        <button
          type="submit"
          class={styles.submitButton}
          disabled={!storyName().trim()}
        >
          {props.submitText || 'Create Story'}
        </button>
      </div>
    </form>
  )
}
