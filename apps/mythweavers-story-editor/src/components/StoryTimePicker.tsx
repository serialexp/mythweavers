import { Component, createSignal, Show, createMemo } from "solid-js";
import { BsCalendar, BsCheck, BsX, BsArrowLeft, BsPlus, BsShuffle } from "solid-icons/bs";
import { calendarStore } from "../stores/calendarStore";
import styles from "./StoryTimePicker.module.css";

interface StoryTimePickerProps {
  currentTime?: number | null; // Story time in minutes (null = not set)
  previousChapterTime?: number | null; // Previous chapter's time for quick copy
  onSave: (time: number | null) => void;
  onCancel: () => void;
}

export const StoryTimePicker: Component<StoryTimePickerProps> = (props) => {
  const calendar = createMemo(() => calendarStore.engine);

  // Initialize from current time or default to year 0, day 1, 00:00
  const initialDate = createMemo(() => {
    const engine = calendar();
    if (!engine) return null;

    if (props.currentTime) {
      return engine.storyTimeToDate(props.currentTime);
    } else {
      // Default to year 0, day 1, 00:00
      return {
        year: 0,
        era: 'positive' as const,
        dayOfYear: 1,
        hour: 0,
        minute: 0,
        subdivisions: new Map()
      };
    }
  });

  const [year, setYear] = createSignal(initialDate()?.year ?? 0);
  const [era, setEra] = createSignal<'positive' | 'negative'>(initialDate()?.era ?? 'positive');
  const [dayOfYear, setDayOfYear] = createSignal(initialDate()?.dayOfYear ?? 1);
  const [hour, setHour] = createSignal(initialDate()?.hour ?? 0);
  const [minute, setMinute] = createSignal(initialDate()?.minute ?? 0);
  const [daysToAdd, setDaysToAdd] = createSignal(1);

  // Computed preview
  const preview = () => {
    const engine = calendar();
    if (!engine) return "Calendar not loaded";

    try {
      const date = {
        year: year(),
        era: era(),
        dayOfYear: dayOfYear(),
        hour: hour(),
        minute: minute(),
        subdivisions: new Map()
      };
      return engine.formatDate(date, true);
    } catch {
      return "Invalid date";
    }
  };

  const handleSave = () => {
    const engine = calendar();
    if (!engine) {
      alert("Calendar not loaded");
      return;
    }

    try {
      const date = {
        year: year(),
        era: era(),
        dayOfYear: dayOfYear(),
        hour: hour(),
        minute: minute(),
        subdivisions: new Map()
      };
      const storyTime = engine.dateToStoryTime(date);
      props.onSave(storyTime);
    } catch (error) {
      alert("Invalid date configuration");
    }
  };

  const handleClear = () => {
    props.onSave(null);
  };

  const handleCopyFromPrevious = () => {
    const engine = calendar();
    if (!engine) return;

    if (props.previousChapterTime !== null && props.previousChapterTime !== undefined) {
      const prevDate = engine.storyTimeToDate(props.previousChapterTime);
      setYear(prevDate.year);
      setEra(prevDate.era);
      setDayOfYear(prevDate.dayOfYear);
      setHour(prevDate.hour);
      setMinute(prevDate.minute);
    }
  };

  const handleIncrementDays = () => {
    const engine = calendar();
    if (!engine) return;

    try {
      const currentDate = {
        year: year(),
        era: era(),
        dayOfYear: dayOfYear(),
        hour: hour(),
        minute: minute(),
        subdivisions: new Map()
      };

      // Convert to story time and add days
      const currentStoryTime = engine.dateToStoryTime(currentDate);
      const newStoryTime = engine.addDays(currentStoryTime, daysToAdd());

      // Convert back to date and update form
      const newDate = engine.storyTimeToDate(newStoryTime);
      setYear(newDate.year);
      setEra(newDate.era);
      setDayOfYear(newDate.dayOfYear);
      setHour(newDate.hour);
      setMinute(newDate.minute);
    } catch (error) {
      console.error("Error incrementing days:", error);
    }
  };

  const randomizeHour = () => {
    const engine = calendar();
    if (!engine) return;
    setHour(Math.floor(Math.random() * engine.config.hoursPerDay));
  };

  const randomizeMinute = () => {
    const engine = calendar();
    if (!engine) return;
    setMinute(Math.floor(Math.random() * engine.config.minutesPerHour));
  };

  const previousTimePreview = () => {
    const engine = calendar();
    if (!engine || props.previousChapterTime == null) return "";
    const prevDate = engine.storyTimeToDate(props.previousChapterTime);
    return engine.formatDate(prevDate, false);
  };

  return (
    <div class={styles.timePicker}>
      <div class={styles.header}>
        <BsCalendar />
        <span>Set Story Time</span>
      </div>

      <Show when={props.previousChapterTime !== null && props.previousChapterTime !== undefined}>
        <button class={styles.copyButton} onClick={handleCopyFromPrevious}>
          <BsArrowLeft />
          Copy from Previous: {previousTimePreview()}
        </button>
      </Show>

      <div class={styles.incrementSection}>
        <label>Increment by:</label>
        <div class={styles.incrementControls}>
          <input
            type="number"
            value={daysToAdd()}
            onInput={(e) => setDaysToAdd(parseInt(e.currentTarget.value) || 1)}
            placeholder="1"
            class={styles.incrementInput}
          />
          <span class={styles.incrementLabel}>days</span>
          <button class={styles.incrementButton} onClick={handleIncrementDays}>
            <BsPlus />
            Add
          </button>
        </div>
      </div>

      <div class={styles.preview}>
        {preview()}
      </div>

      <div class={styles.form}>
        <div class={styles.formRow}>
          <label>Year:</label>
          <input
            type="number"
            value={year()}
            onInput={(e) => setYear(parseInt(e.currentTarget.value) || 0)}
            placeholder="0"
          />
          <Show when={calendar()?.config.eras.positive || calendar()?.config.eras.negative}>
            <span class={styles.hint}>
              {era() === 'negative'
                ? calendar()?.config.eras.negative
                : era() === 'positive'
                ? calendar()?.config.eras.positive
                : ''}
            </span>
          </Show>
        </div>

        <div class={styles.formRow}>
          <label>Day of Year:</label>
          <input
            type="number"
            min={1}
            max={calendar()?.config.daysPerYear ?? 365}
            value={dayOfYear()}
            onInput={(e) => {
              const val = parseInt(e.currentTarget.value) || 1;
              const maxDays = calendar()?.config.daysPerYear ?? 365;
              setDayOfYear(Math.max(1, Math.min(maxDays, val)));
            }}
            placeholder="1"
          />
          <span class={styles.hint}>1-{calendar()?.config.daysPerYear ?? 365}</span>
        </div>

        <div class={styles.formRow}>
          <label>Hour:</label>
          <input
            type="number"
            min={0}
            max={(calendar()?.config.hoursPerDay ?? 24) - 1}
            value={hour()}
            onInput={(e) => {
              const val = parseInt(e.currentTarget.value) || 0;
              const maxHours = (calendar()?.config.hoursPerDay ?? 24) - 1;
              setHour(Math.max(0, Math.min(maxHours, val)));
            }}
            placeholder="0"
          />
          <button class={styles.randomButton} onClick={randomizeHour} title="Random hour">
            <BsShuffle />
          </button>
        </div>

        <div class={styles.formRow}>
          <label>Minute:</label>
          <input
            type="number"
            min={0}
            max={(calendar()?.config.minutesPerHour ?? 60) - 1}
            value={minute()}
            onInput={(e) => {
              const val = parseInt(e.currentTarget.value) || 0;
              const maxMinutes = (calendar()?.config.minutesPerHour ?? 60) - 1;
              setMinute(Math.max(0, Math.min(maxMinutes, val)));
            }}
            placeholder="0"
          />
          <button class={styles.randomButton} onClick={randomizeMinute} title="Random minute">
            <BsShuffle />
          </button>
        </div>
      </div>

      <div class={styles.actions}>
        <button class={styles.saveButton} onClick={handleSave}>
          <BsCheck /> Save
        </button>
        <Show when={props.currentTime !== null && props.currentTime !== undefined}>
          <button class={styles.clearButton} onClick={handleClear}>
            Clear
          </button>
        </Show>
        <button class={styles.cancelButton} onClick={props.onCancel}>
          <BsX /> Cancel
        </button>
      </div>
    </div>
  );
};
