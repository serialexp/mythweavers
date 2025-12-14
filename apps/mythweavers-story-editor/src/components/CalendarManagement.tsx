import { Component, Show, For, createSignal, createResource, createEffect } from 'solid-js'
import { BsPlus, BsTrash, BsCheck, BsPencil } from 'solid-icons/bs'
import { getCalendarsPresets } from '../client/config'
import { apiClient } from '../utils/apiClient'
import { currentStoryStore } from '../stores/currentStoryStore'
import { calendarStore } from '../stores/calendarStore'
import { Calendar } from '../types/api'
import { CalendarConfig } from '@story/shared'
import { CalendarEditor } from './CalendarEditor'
import styles from './CalendarManagement.module.css'

export const CalendarManagement: Component = () => {
  const [calendars, setCalendars] = createSignal<Calendar[]>([])
  const [defaultCalendarId, setDefaultCalendarId] = createSignal<string | null>(null)
  const [showAddCalendar, setShowAddCalendar] = createSignal(false)
  const [editingCalendarId, setEditingCalendarId] = createSignal<string | null>(null)
  const [selectedPresetId, setSelectedPresetId] = createSignal('simple365')

  // Fetch calendar presets
  const [calendarPresets] = createResource<CalendarConfig[]>(async () => {
    try {
      const response = await getCalendarsPresets()
      return response.data?.presets || []
    } catch (error) {
      console.error('Failed to fetch calendar presets:', error)
      return []
    }
  })

  // Load story calendars
  const loadCalendars = async () => {
    if (!currentStoryStore.id) return

    try {
      const story = await apiClient.getStory(currentStoryStore.id)
      if (story.calendars) {
        // Parse the JSON config strings
        const parsedCalendars = story.calendars.map(cal => ({
          ...cal,
          config: typeof cal.config === 'string' ? JSON.parse(cal.config) : cal.config
        }))
        setCalendars(parsedCalendars)
      }
      if (story.defaultCalendarId) {
        setDefaultCalendarId(story.defaultCalendarId)
      }
    } catch (error) {
      console.error('Failed to load calendars:', error)
    }
  }

  // Load calendars when component mounts or story changes
  createEffect(() => {
    if (currentStoryStore.id) {
      loadCalendars()
    }
  })

  const handleAddCalendar = async (config: CalendarConfig) => {
    if (!currentStoryStore.id) return

    try {
      await apiClient.post(`/stories/${currentStoryStore.id}/calendars`, {
        config,
        setAsDefault: calendars().length === 0 // Set as default if this is the first calendar
      })

      await loadCalendars()
      await calendarStore.refresh() // Reload calendar store
      setShowAddCalendar(false)
    } catch (error) {
      console.error('Failed to add calendar:', error)
      alert('Failed to add calendar. Please try again.')
    }
  }

  const getInitialConfig = (): CalendarConfig | undefined => {
    if (selectedPresetId() === 'custom') {
      return undefined
    }
    return calendarPresets()?.find(p => p.id === selectedPresetId())
  }

  const handleSetDefault = async (calendarId: string) => {
    if (!currentStoryStore.id) return

    try {
      await apiClient.put(`/stories/${currentStoryStore.id}/default-calendar`, {
        calendarId
      })

      setDefaultCalendarId(calendarId)
      await calendarStore.refresh() // Reload calendar store
    } catch (error) {
      console.error('Failed to set default calendar:', error)
      alert('Failed to set default calendar. Please try again.')
    }
  }

  const handleDeleteCalendar = async (calendarId: string) => {
    if (!currentStoryStore.id) return

    const calendar = calendars().find(c => c.id === calendarId)
    if (!calendar) return

    const confirmDelete = confirm(
      `Are you sure you want to delete the calendar "${calendar.config.name}"? This action cannot be undone.`
    )

    if (!confirmDelete) return

    try {
      await apiClient.delete(`/calendars/${calendarId}`)
      await loadCalendars()
      await calendarStore.refresh() // Reload calendar store
    } catch (error: any) {
      console.error('Failed to delete calendar:', error)
      alert(error.response?.data?.error || 'Failed to delete calendar. Please try again.')
    }
  }

  const handleEditCalendar = async (config: CalendarConfig) => {
    const calendarId = editingCalendarId()
    if (!calendarId) return

    try {
      await apiClient.put(`/calendars/${calendarId}`, { config })
      await loadCalendars()
      await calendarStore.refresh() // Reload calendar store
      setEditingCalendarId(null)
    } catch (error) {
      console.error('Failed to update calendar:', error)
      alert('Failed to update calendar. Please try again.')
    }
  }

  const startEditing = (calendarId: string) => {
    setEditingCalendarId(calendarId)
    setShowAddCalendar(false) // Close add form if open
  }

  const cancelEditing = () => {
    setEditingCalendarId(null)
  }

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <h3 class={styles.title}>Calendar System</h3>
        <button
          class={styles.addButton}
          onClick={() => setShowAddCalendar(!showAddCalendar())}
        >
          <BsPlus /> Add Calendar
        </button>
      </div>

      <Show when={calendars().length === 0}>
        <div class={styles.empty}>
          No calendars configured. Add one to enable timeline features.
        </div>
      </Show>

      <div class={styles.calendarList}>
        <For each={calendars()}>
          {(calendar) => (
            <div class={styles.calendarItem}>
              <div class={styles.calendarInfo}>
                <div class={styles.calendarName}>
                  {calendar.config.name}
                  <Show when={calendar.id === defaultCalendarId()}>
                    <span class={styles.defaultBadge}>Default</span>
                  </Show>
                </div>
                <div class={styles.calendarDescription}>
                  {calendar.config.description}
                </div>
                <div class={styles.calendarDetails}>
                  {calendar.config.daysPerYear} days/year, {calendar.config.hoursPerDay} hours/day
                </div>
              </div>
              <div class={styles.calendarActions}>
                <button
                  class={styles.actionButton}
                  onClick={() => startEditing(calendar.id)}
                  title="Edit calendar"
                >
                  <BsPencil /> Edit
                </button>
                <Show when={calendar.id !== defaultCalendarId()}>
                  <button
                    class={styles.actionButton}
                    onClick={() => handleSetDefault(calendar.id)}
                    title="Set as default calendar"
                  >
                    <BsCheck /> Set Default
                  </button>
                </Show>
                <button
                  class={`${styles.actionButton} ${styles.deleteButton}`}
                  onClick={() => handleDeleteCalendar(calendar.id)}
                  title="Delete calendar"
                >
                  <BsTrash /> Delete
                </button>
              </div>
            </div>
          )}
        </For>
      </div>

      <Show when={showAddCalendar()}>
        <div class={styles.addCalendarForm}>
          <h4 class={styles.formTitle}>Add Calendar</h4>
          <div class={styles.formGroup}>
            <label class={styles.formLabel}>Start with:</label>
            <select
              class={styles.formSelect}
              value={selectedPresetId()}
              onChange={(e) => setSelectedPresetId(e.target.value)}
            >
              <Show when={!calendarPresets.loading && calendarPresets()}>
                <For each={calendarPresets()}>
                  {(preset) => (
                    <option value={preset.id}>{preset.name}</option>
                  )}
                </For>
                <option value="custom">Custom Calendar (blank)</option>
              </Show>
            </select>
            <Show when={selectedPresetId() !== 'custom' && calendarPresets()}>
              <div class={styles.presetDescription}>
                {calendarPresets()!.find(p => p.id === selectedPresetId())?.description || ''}
              </div>
            </Show>
          </div>

          <Show when={selectedPresetId()} keyed>
            {(_presetId) => (
              <CalendarEditor
                initialConfig={getInitialConfig()}
                onSave={handleAddCalendar}
                onCancel={() => setShowAddCalendar(false)}
              />
            )}
          </Show>
        </div>
      </Show>

      <Show when={editingCalendarId()}>
        <div class={styles.addCalendarForm}>
          <h4 class={styles.formTitle}>
            Edit Calendar: {calendars().find(c => c.id === editingCalendarId())?.config.name}
          </h4>
          <CalendarEditor
            initialConfig={calendars().find(c => c.id === editingCalendarId())?.config}
            onSave={handleEditCalendar}
            onCancel={cancelEditing}
          />
        </div>
      </Show>
    </div>
  )
}
