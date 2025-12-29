import { Button, Card, CardBody, IconButton, Input, Modal, Stack } from '@mythweavers/ui'
import { BsArrowLeft, BsCalendar, BsCheck, BsPlus, BsShuffle, BsX } from 'solid-icons/bs'
import { Component, Show, createMemo, createSignal } from 'solid-js'
import { calendarStore } from '../stores/calendarStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { nodeStore } from '../stores/nodeStore'
import { getTimelineRange } from '../utils/timelineUtils'
import * as styles from './StoryTimePicker.css'

interface StoryTimePickerProps {
  currentTime?: number | null // Story time in minutes (null = not set)
  previousChapterTime?: number | null // Previous chapter's time for quick copy
  onSave: (time: number | null) => void
  onCancel: () => void
  modal?: boolean // If true, render as a modal dialog
  open?: boolean // Control modal open state (only used when modal=true)
}

export const StoryTimePicker: Component<StoryTimePickerProps> = (props) => {
  const calendar = createMemo(() => calendarStore.engine)

  // Initialize from current time or default to timeline start time
  const initialDate = createMemo(() => {
    const engine = calendar()
    if (!engine) return null

    if (props.currentTime) {
      return engine.storyTimeToDate(props.currentTime)
    }

    // Use the timeline start time as the default
    if (currentStoryStore.isInitialized) {
      const storyForTimeline = {
        timelineStartTime: currentStoryStore.timelineStartTime,
        timelineEndTime: currentStoryStore.timelineEndTime,
        timelineGranularity: currentStoryStore.timelineGranularity,
      }
      const timelineRange = getTimelineRange(storyForTimeline as Parameters<typeof getTimelineRange>[0], nodeStore.nodesArray)
      return engine.storyTimeToDate(timelineRange.start)
    }

    // Fallback to year 0, day 1, 00:00
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
        subdivisions: engine.getSubdivisions(dayOfYear(), year()),
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

  const content = (
    <Stack gap="md">
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
            <label class={styles.incrementLabel}>
              Increment by:
            </label>
            <div class={styles.incrementRow}>
              <Input
                type="number"
                value={daysToAdd()}
                onInput={(e) => setDaysToAdd(Number.parseInt(e.currentTarget.value) || 1)}
                placeholder="1"
                style={{ width: '80px' }}
              />
              <span class={styles.daysText}>days</span>
              <Button variant="primary" size="sm" onClick={handleIncrementDays} style={{ 'margin-left': 'auto' }}>
                <BsPlus /> Add
              </Button>
            </div>
          </Stack>
        </CardBody>
      </Card>

      <Card variant="flat">
        <CardBody padding="sm" class={styles.previewBox}>
          {preview()}
        </CardBody>
      </Card>

      <Stack gap="sm">
        <div class={styles.inputRow}>
          <label class={styles.inputLabel}>Year:</label>
          <Input
            type="number"
            value={year()}
            onInput={(e) => setYear(Number.parseInt(e.currentTarget.value) || 0)}
            placeholder="0"
          />
          <Show when={calendar()?.config.eras.positive || calendar()?.config.eras.negative}>
            <span class={styles.eraLabel}>
              {era() === 'negative'
                ? calendar()?.config.eras.negative
                : era() === 'positive'
                  ? calendar()?.config.eras.positive
                  : ''}
            </span>
          </Show>
        </div>

        <div class={styles.inputRow}>
          <label class={styles.inputLabel}>Day of Year:</label>
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
          <span class={styles.eraLabel}>
            1-{calendar()?.config.daysPerYear ?? 365}
          </span>
        </div>

        <div class={styles.inputRow}>
          <label class={styles.inputLabel}>Hour:</label>
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

        <div class={styles.inputRow}>
          <label class={styles.inputLabel}>Minute:</label>
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

      <div class={styles.actionRow}>
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
  )

  if (props.modal) {
    return (
      <Modal open={props.open ?? true} onClose={props.onCancel} title="Set Story Time" size="sm">
        {content}
      </Modal>
    )
  }

  return (
    <Card style={{ 'min-width': '280px' }}>
      <CardBody>
        <Stack gap="md">
          <div class={styles.cardTitle}>
            <BsCalendar />
            <span>Set Story Time</span>
          </div>
          {content}
        </Stack>
      </CardBody>
    </Card>
  )
}
