import { CalendarConfig } from '@mythweavers/shared'
import { Badge, Button, Card, CardBody, Select, Stack } from '@mythweavers/ui'
import { BsCheck, BsPencil, BsPlus, BsTrash } from 'solid-icons/bs'
import { Component, For, Show, createEffect, createResource, createSignal } from 'solid-js'
import { getCalendarsPresets } from '../client/config'
import { calendarStore } from '../stores/calendarStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { Calendar } from '../types/api'
import { apiClient } from '../utils/apiClient'
import { CalendarEditor } from './CalendarEditor'

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
      const story = await apiClient.getStory(currentStoryStore.id)
      if (story.calendars) {
        // Parse the JSON config strings
        const parsedCalendars = story.calendars.map((cal) => ({
          ...cal,
          config: typeof cal.config === 'string' ? JSON.parse(cal.config) : cal.config,
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
        setAsDefault: calendars().length === 0, // Set as default if this is the first calendar
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
      await apiClient.put(`/stories/${currentStoryStore.id}/default-calendar`, {
        calendarId,
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

  const containerStyle = {
    display: 'flex',
    'flex-direction': 'column' as const,
    gap: '1rem',
    padding: '1.5rem',
  }

  const emptyStyle = {
    padding: '2rem',
    'text-align': 'center' as const,
    color: 'var(--text-secondary)',
    background: 'var(--bg-secondary)',
    border: '1px dashed var(--border-color)',
    'border-radius': '6px',
  }

  const calendarInfoStyle = {
    flex: '1',
    display: 'flex',
    'flex-direction': 'column' as const,
    gap: '0.25rem',
  }

  const calendarNameStyle = {
    display: 'flex',
    'align-items': 'center',
    gap: '0.5rem',
    'font-weight': '500',
    'font-size': '1rem',
    color: 'var(--text-primary)',
  }

  const calendarDescStyle = {
    'font-size': '0.875rem',
    color: 'var(--text-secondary)',
  }

  const calendarDetailsStyle = {
    'font-size': '0.75rem',
    color: 'var(--text-muted)',
    'font-family': 'monospace',
  }

  const presetDescStyle = {
    padding: '0.5rem',
    background: 'var(--bg-tertiary)',
    'border-radius': '4px',
    'font-size': '0.875rem',
    color: 'var(--text-secondary)',
  }

  return (
    <div style={containerStyle}>
      <Stack
        direction="horizontal"
        gap="md"
        style={{ 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '1rem' }}
      >
        <h3 style={{ margin: '0', 'font-size': '1.25rem', 'font-weight': '600', color: 'var(--text-primary)' }}>
          Calendar System
        </h3>
        <Button variant="primary" onClick={() => setShowAddCalendar(!showAddCalendar())}>
          <BsPlus /> Add Calendar
        </Button>
      </Stack>

      <Show when={calendars().length === 0}>
        <div style={emptyStyle}>No calendars configured. Add one to enable timeline features.</div>
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
                  <div style={calendarInfoStyle}>
                    <div style={calendarNameStyle}>
                      {calendar.config.name}
                      <Show when={calendar.id === defaultCalendarId()}>
                        <Badge variant="primary">Default</Badge>
                      </Show>
                    </div>
                    <div style={calendarDescStyle}>{calendar.config.description}</div>
                    <div style={calendarDetailsStyle}>
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
        <Card style={{ 'margin-top': '0.5rem' }}>
          <CardBody>
            <Stack gap="md">
              <h4 style={{ margin: '0', 'font-size': '1rem', 'font-weight': '600', color: 'var(--text-primary)' }}>
                Add Calendar
              </h4>
              <Stack gap="sm">
                <span style={{ 'font-weight': '500', 'font-size': '0.875rem', color: 'var(--text-primary)' }}>
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
                  <div style={presetDescStyle}>
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
        <Card style={{ 'margin-top': '0.5rem' }}>
          <CardBody>
            <Stack gap="md">
              <h4 style={{ margin: '0', 'font-size': '1rem', 'font-weight': '600', color: 'var(--text-primary)' }}>
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
