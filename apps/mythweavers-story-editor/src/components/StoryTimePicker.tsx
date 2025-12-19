import { Button, Card, CardBody, IconButton, Input, Stack } from '@mythweavers/ui'
import { BsArrowLeft, BsCalendar, BsCheck, BsPlus, BsShuffle, BsX } from 'solid-icons/bs'
import { Component, Show, createMemo, createSignal } from 'solid-js'
import { calendarStore } from '../stores/calendarStore'

interface StoryTimePickerProps {
  currentTime?: number | null // Story time in minutes (null = not set)
  previousChapterTime?: number | null // Previous chapter's time for quick copy
  onSave: (time: number | null) => void
  onCancel: () => void
}

export const StoryTimePicker: Component<StoryTimePickerProps> = (props) => {
  const calendar = createMemo(() => calendarStore.engine)

  // Initialize from current time or default to year 0, day 1, 00:00
  const initialDate = createMemo(() => {
    const engine = calendar()
    if (!engine) return null

    if (props.currentTime) {
      return engine.storyTimeToDate(props.currentTime)
    }
    // Default to year 0, day 1, 00:00
    return {
      year: 0,
      era: 'positive' as const,
      dayOfYear: 1,
      hour: 0,
      minute: 0,
      subdivisions: new Map(),
    }
  })

  const [year, setYear] = createSignal(initialDate()?.year ?? 0)
  const [era, setEra] = createSignal<'positive' | 'negative'>(initialDate()?.era ?? 'positive')
  const [dayOfYear, setDayOfYear] = createSignal(initialDate()?.dayOfYear ?? 1)
  const [hour, setHour] = createSignal(initialDate()?.hour ?? 0)
  const [minute, setMinute] = createSignal(initialDate()?.minute ?? 0)
  const [daysToAdd, setDaysToAdd] = createSignal(1)

  // Computed preview
  const preview = () => {
    const engine = calendar()
    if (!engine) return 'Calendar not loaded'

    try {
      const date = {
        year: year(),
        era: era(),
        dayOfYear: dayOfYear(),
        hour: hour(),
        minute: minute(),
        subdivisions: new Map(),
      }
      return engine.formatDate(date, true)
    } catch {
      return 'Invalid date'
    }
  }

  const handleSave = () => {
    const engine = calendar()
    if (!engine) {
      alert('Calendar not loaded')
      return
    }

    try {
      const date = {
        year: year(),
        era: era(),
        dayOfYear: dayOfYear(),
        hour: hour(),
        minute: minute(),
        subdivisions: new Map(),
      }
      const storyTime = engine.dateToStoryTime(date)
      props.onSave(storyTime)
    } catch (_error) {
      alert('Invalid date configuration')
    }
  }

  const handleClear = () => {
    props.onSave(null)
  }

  const handleCopyFromPrevious = () => {
    const engine = calendar()
    if (!engine) return

    if (props.previousChapterTime !== null && props.previousChapterTime !== undefined) {
      const prevDate = engine.storyTimeToDate(props.previousChapterTime)
      setYear(prevDate.year)
      setEra(prevDate.era)
      setDayOfYear(prevDate.dayOfYear)
      setHour(prevDate.hour)
      setMinute(prevDate.minute)
    }
  }

  const handleIncrementDays = () => {
    const engine = calendar()
    if (!engine) return

    try {
      const currentDate = {
        year: year(),
        era: era(),
        dayOfYear: dayOfYear(),
        hour: hour(),
        minute: minute(),
        subdivisions: new Map(),
      }

      // Convert to story time and add days
      const currentStoryTime = engine.dateToStoryTime(currentDate)
      const newStoryTime = engine.addDays(currentStoryTime, daysToAdd())

      // Convert back to date and update form
      const newDate = engine.storyTimeToDate(newStoryTime)
      setYear(newDate.year)
      setEra(newDate.era)
      setDayOfYear(newDate.dayOfYear)
      setHour(newDate.hour)
      setMinute(newDate.minute)
    } catch (error) {
      console.error('Error incrementing days:', error)
    }
  }

  const randomizeHour = () => {
    const engine = calendar()
    if (!engine) return
    setHour(Math.floor(Math.random() * engine.config.hoursPerDay))
  }

  const randomizeMinute = () => {
    const engine = calendar()
    if (!engine) return
    setMinute(Math.floor(Math.random() * engine.config.minutesPerHour))
  }

  const previousTimePreview = () => {
    const engine = calendar()
    if (!engine || props.previousChapterTime == null) return ''
    const prevDate = engine.storyTimeToDate(props.previousChapterTime)
    return engine.formatDate(prevDate, false)
  }

  return (
    <Card style={{ 'min-width': '280px' }}>
      <CardBody>
        <Stack gap="md">
          <div
            style={{
              display: 'flex',
              'align-items': 'center',
              gap: 'var(--spacing-sm)',
              'font-weight': '600',
              color: 'var(--text-primary)',
            }}
          >
            <BsCalendar />
            <span>Set Story Time</span>
          </div>

          <Show when={props.previousChapterTime !== null && props.previousChapterTime !== undefined}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyFromPrevious}
              style={{ 'justify-content': 'flex-start' }}
            >
              <BsArrowLeft />
              Copy from Previous: {previousTimePreview()}
            </Button>
          </Show>

          <Card variant="flat">
            <CardBody padding="sm">
              <Stack gap="xs">
                <label style={{ 'font-size': '0.85em', color: 'var(--text-secondary)', 'font-weight': '500' }}>
                  Increment by:
                </label>
                <div style={{ display: 'flex', 'align-items': 'center', gap: 'var(--spacing-sm)' }}>
                  <Input
                    type="number"
                    value={daysToAdd()}
                    onInput={(e) => setDaysToAdd(Number.parseInt(e.currentTarget.value) || 1)}
                    placeholder="1"
                    style={{ width: '80px' }}
                  />
                  <span style={{ 'font-size': '0.85em', color: 'var(--text-secondary)' }}>days</span>
                  <Button variant="primary" size="sm" onClick={handleIncrementDays} style={{ 'margin-left': 'auto' }}>
                    <BsPlus /> Add
                  </Button>
                </div>
              </Stack>
            </CardBody>
          </Card>

          <Card variant="flat">
            <CardBody
              padding="sm"
              style={{
                'text-align': 'center',
                'font-family': 'monospace',
                'font-size': '0.9em',
                color: 'var(--text-secondary)',
              }}
            >
              {preview()}
            </CardBody>
          </Card>

          <Stack gap="sm">
            <div
              style={{
                display: 'grid',
                'grid-template-columns': '80px 1fr auto',
                'align-items': 'center',
                gap: 'var(--spacing-sm)',
              }}
            >
              <label style={{ 'font-size': '0.9em', color: 'var(--text-secondary)' }}>Year:</label>
              <Input
                type="number"
                value={year()}
                onInput={(e) => setYear(Number.parseInt(e.currentTarget.value) || 0)}
                placeholder="0"
              />
              <Show when={calendar()?.config.eras.positive || calendar()?.config.eras.negative}>
                <span
                  style={{
                    'font-size': '0.8em',
                    color: 'var(--text-muted)',
                    'min-width': '60px',
                    'text-align': 'right',
                  }}
                >
                  {era() === 'negative'
                    ? calendar()?.config.eras.negative
                    : era() === 'positive'
                      ? calendar()?.config.eras.positive
                      : ''}
                </span>
              </Show>
            </div>

            <div
              style={{
                display: 'grid',
                'grid-template-columns': '80px 1fr auto',
                'align-items': 'center',
                gap: 'var(--spacing-sm)',
              }}
            >
              <label style={{ 'font-size': '0.9em', color: 'var(--text-secondary)' }}>Day of Year:</label>
              <Input
                type="number"
                min={1}
                max={calendar()?.config.daysPerYear ?? 365}
                value={dayOfYear()}
                onInput={(e) => {
                  const val = Number.parseInt(e.currentTarget.value) || 1
                  const maxDays = calendar()?.config.daysPerYear ?? 365
                  setDayOfYear(Math.max(1, Math.min(maxDays, val)))
                }}
                placeholder="1"
              />
              <span
                style={{ 'font-size': '0.8em', color: 'var(--text-muted)', 'min-width': '60px', 'text-align': 'right' }}
              >
                1-{calendar()?.config.daysPerYear ?? 365}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                'grid-template-columns': '80px 1fr auto',
                'align-items': 'center',
                gap: 'var(--spacing-sm)',
              }}
            >
              <label style={{ 'font-size': '0.9em', color: 'var(--text-secondary)' }}>Hour:</label>
              <Input
                type="number"
                min={0}
                max={(calendar()?.config.hoursPerDay ?? 24) - 1}
                value={hour()}
                onInput={(e) => {
                  const val = Number.parseInt(e.currentTarget.value) || 0
                  const maxHours = (calendar()?.config.hoursPerDay ?? 24) - 1
                  setHour(Math.max(0, Math.min(maxHours, val)))
                }}
                placeholder="0"
              />
              <IconButton variant="ghost" size="sm" onClick={randomizeHour} aria-label="Random hour">
                <BsShuffle />
              </IconButton>
            </div>

            <div
              style={{
                display: 'grid',
                'grid-template-columns': '80px 1fr auto',
                'align-items': 'center',
                gap: 'var(--spacing-sm)',
              }}
            >
              <label style={{ 'font-size': '0.9em', color: 'var(--text-secondary)' }}>Minute:</label>
              <Input
                type="number"
                min={0}
                max={(calendar()?.config.minutesPerHour ?? 60) - 1}
                value={minute()}
                onInput={(e) => {
                  const val = Number.parseInt(e.currentTarget.value) || 0
                  const maxMinutes = (calendar()?.config.minutesPerHour ?? 60) - 1
                  setMinute(Math.max(0, Math.min(maxMinutes, val)))
                }}
                placeholder="0"
              />
              <IconButton variant="ghost" size="sm" onClick={randomizeMinute} aria-label="Random minute">
                <BsShuffle />
              </IconButton>
            </div>
          </Stack>

          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', 'justify-content': 'flex-end' }}>
            <Button variant="primary" onClick={handleSave}>
              <BsCheck /> Save
            </Button>
            <Show when={props.currentTime !== null && props.currentTime !== undefined}>
              <Button variant="danger" onClick={handleClear}>
                Clear
              </Button>
            </Show>
            <Button variant="secondary" onClick={props.onCancel}>
              <BsX /> Cancel
            </Button>
          </div>
        </Stack>
      </CardBody>
    </Card>
  )
}
