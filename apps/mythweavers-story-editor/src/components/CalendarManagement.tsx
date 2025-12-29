import { CalendarConfig } from '@mythweavers/shared'
import { Badge, Button, Card, CardBody, Select, Stack } from '@mythweavers/ui'
import { BsCheck, BsPencil, BsPlus, BsTrash } from 'solid-icons/bs'
import { Component, For, Show, createEffect, createResource, createSignal } from 'solid-js'
import {
  deleteMyCalendarsById,
  getCalendarsPresets,
  getMyCalendarsById,
  getMyStoriesByStoryIdCalendars,
  postMyStoriesByStoryIdCalendars,
  putMyCalendarsById,
  putMyStoriesByStoryIdDefaultCalendar,
} from '../client/config'
import { calendarStore } from '../stores/calendarStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { Calendar } from '../types/api'
import { CalendarEditor } from './CalendarEditor'
import * as styles from './CalendarManagement.css'

// Extended Calendar type that includes isDefault from list response
type CalendarWithDefault = Calendar & { isDefault: boolean }

export const CalendarManagement: Component = () => {
  const [calendars, setCalendars] = createSignal<CalendarWithDefault[]>([])
  const [defaultCalendarId, setDefaultCalendarId] = createSignal<string | null>(null)
  const [showAddCalendar, setShowAddCalendar] = createSignal(false)
  const [editingCalendarId, setEditingCalendarId] = createSignal<string | null>(null)
  const [selectedPresetId, setSelectedPresetId] = createSignal('simple365')

  // Fetch calendar presets
  const [calendarPresets] = createResource<CalendarConfig[]>(async () => {
    try {
      const response = await getCalendarsPresets()
      return (response.data?.presets || []) as CalendarConfig[]
    } catch (error) {
      console.error('Failed to fetch calendar presets:', error)
      return []
    }
  })

  // Load story calendars
  const loadCalendars = async () => {
    if (!currentStoryStore.id) return

    try {
      const response = await getMyStoriesByStoryIdCalendars({
        path: { storyId: currentStoryStore.id },
      })
      if (response.data?.calendars) {
        // Fetch full details for each calendar to get config
        const fullCalendars = await Promise.all(
          response.data.calendars.map(async (cal) => {
            const fullResponse = await getMyCalendarsById({
              path: { id: cal.id },
            })
            if (fullResponse.data?.calendar) {
              const fullCal = fullResponse.data.calendar
              const config = fullCal.config
              return {
                id: fullCal.id,
                storyId: fullCal.storyId,
                config: typeof config === 'string' ? JSON.parse(config) : config,
                createdAt: fullCal.createdAt,
                updatedAt: fullCal.updatedAt,
                // Preserve isDefault from list response since full response doesn't include it
                isDefault: cal.isDefault,
              } as CalendarWithDefault
            }
            return null
          }),
        )
        // Filter out null entries
        const validCalendars = fullCalendars.filter((cal): cal is CalendarWithDefault => cal !== null)
        setCalendars(validCalendars)

        // Find the default calendar
        const defaultCal = validCalendars.find((cal) => cal.isDefault)
        if (defaultCal) {
          setDefaultCalendarId(defaultCal.id)
        }
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
      await postMyStoriesByStoryIdCalendars({
        path: { storyId: currentStoryStore.id },
        body: {
          name: config.name,
          config: config as unknown,
          setAsDefault: calendars().length === 0, // Set as default if this is the first calendar
        },
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
    return calendarPresets()?.find((p) => p.id === selectedPresetId())
  }

  const handleSetDefault = async (calendarId: string) => {
    if (!currentStoryStore.id) return

    try {
      await putMyStoriesByStoryIdDefaultCalendar({
        path: { storyId: currentStoryStore.id },
        body: { calendarId },
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

    const calendar = calendars().find((c) => c.id === calendarId)
    if (!calendar) return

    const confirmDelete = confirm(
      `Are you sure you want to delete the calendar "${calendar.config.name}"? This action cannot be undone.`,
    )

    if (!confirmDelete) return

    try {
      await deleteMyCalendarsById({
        path: { id: calendarId },
      })
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
      await putMyCalendarsById({
        path: { id: calendarId },
        body: { config: config as unknown as Record<string, unknown> },
      })
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
      <Stack
        direction="horizontal"
        gap="md"
        class={styles.headerRow}
      >
        <h3 class={styles.sectionTitle}>
          Calendar System
        </h3>
        <Button variant="primary" onClick={() => setShowAddCalendar(!showAddCalendar())}>
          <BsPlus /> Add Calendar
        </Button>
      </Stack>

      <Show when={calendars().length === 0}>
        <div class={styles.emptyState}>No calendars configured. Add one to enable timeline features.</div>
      </Show>

      <Stack gap="md">
        <For each={calendars()}>
          {(calendar) => (
            <Card>
              <CardBody>
                <Stack
                  direction="horizontal"
                  gap="md"
                  style={{ 'justify-content': 'space-between', 'align-items': 'center' }}
                >
                  <div class={styles.calendarInfo}>
                    <div class={styles.calendarName}>
                      {calendar.config.name}
                      <Show when={calendar.id === defaultCalendarId()}>
                        <Badge variant="primary">Default</Badge>
                      </Show>
                    </div>
                    <div class={styles.calendarDescription}>{calendar.config.description}</div>
                    <div class={styles.calendarDetails}>
                      {calendar.config.daysPerYear} days/year, {calendar.config.hoursPerDay} hours/day
                    </div>
                  </div>
                  <Stack direction="horizontal" gap="sm">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => startEditing(calendar.id)}
                      title="Edit calendar"
                    >
                      <BsPencil /> Edit
                    </Button>
                    <Show when={calendar.id !== defaultCalendarId()}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSetDefault(calendar.id)}
                        title="Set as default calendar"
                      >
                        <BsCheck /> Set Default
                      </Button>
                    </Show>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteCalendar(calendar.id)}
                      title="Delete calendar"
                    >
                      <BsTrash /> Delete
                    </Button>
                  </Stack>
                </Stack>
              </CardBody>
            </Card>
          )}
        </For>
      </Stack>

      <Show when={showAddCalendar()}>
        <Card class={styles.cardMargin}>
          <CardBody>
            <Stack gap="md">
              <h4 class={styles.cardTitle}>
                Add Calendar
              </h4>
              <Stack gap="sm">
                <span class={styles.startWithLabel}>
                  Start with:
                </span>
                <Show when={!calendarPresets.loading && calendarPresets()}>
                  <Select
                    value={selectedPresetId()}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                    options={[
                      // Put Simple 365 first as the recommended default
                      ...(calendarPresets() || [])
                        .sort((a, b) => (a.id === 'simple365' ? -1 : b.id === 'simple365' ? 1 : 0))
                        .map((preset) => ({ value: preset.id, label: preset.name })),
                      { value: 'custom', label: 'Custom Calendar (blank)' },
                    ]}
                  />
                </Show>
                <Show when={selectedPresetId() !== 'custom' && calendarPresets()}>
                  <div class={styles.presetDescription}>
                    {calendarPresets()!.find((p) => p.id === selectedPresetId())?.description || ''}
                  </div>
                </Show>
              </Stack>

              <Show when={selectedPresetId()} keyed>
                {(_presetId) => (
                  <CalendarEditor
                    initialConfig={getInitialConfig()}
                    onSave={handleAddCalendar}
                    onCancel={() => setShowAddCalendar(false)}
                  />
                )}
              </Show>
            </Stack>
          </CardBody>
        </Card>
      </Show>

      <Show when={editingCalendarId()}>
        <Card class={styles.cardMargin}>
          <CardBody>
            <Stack gap="md">
              <h4 class={styles.cardTitle}>
                Edit Calendar: {calendars().find((c) => c.id === editingCalendarId())?.config.name}
              </h4>
              <CalendarEditor
                initialConfig={calendars().find((c) => c.id === editingCalendarId())?.config}
                onSave={handleEditCalendar}
                onCancel={cancelEditing}
              />
            </Stack>
          </CardBody>
        </Card>
      </Show>
    </div>
  )
}
