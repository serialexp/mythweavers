import { createStore } from 'solid-js/store';
import { createEffect } from 'solid-js';
import { CalendarEngine, CORUSCANT_CALENDAR, type CalendarConfig } from '@story/shared';
import { currentStoryStore } from './currentStoryStore';
import { getMyStoriesByStoryIdCalendars } from '../client/config';

interface CalendarState {
  calendarId: string | null;
  config: CalendarConfig | null;
  engine: CalendarEngine | null;
  isLoading: boolean;
  error: string | null;
}

const [calendarState, setCalendarState] = createStore<CalendarState>({
  calendarId: null,
  config: null,
  engine: null,
  isLoading: false,
  error: null,
});

/**
 * Fetch the default calendar for the current story
 */
async function fetchStoryCalendar(storyId: string): Promise<void> {
  setCalendarState({
    isLoading: true,
    error: null,
  });

  try {
    const response = await getMyStoriesByStoryIdCalendars({
      path: { storyId },
    });

    if (response.data) {
      // Find the default calendar
      const defaultCalendar = response.data.calendars.find(cal => cal.isDefault);

      if (defaultCalendar) {
        const engine = new CalendarEngine(defaultCalendar.config as CalendarConfig);

        setCalendarState({
          calendarId: defaultCalendar.id,
          config: defaultCalendar.config as CalendarConfig,
          engine,
          isLoading: false,
          error: null,
        });
      } else {
        // No default calendar, use Coruscant
        console.warn('No default calendar found, using Coruscant calendar');
        setCalendarState({
          calendarId: null,
          config: CORUSCANT_CALENDAR,
          engine: new CalendarEngine(CORUSCANT_CALENDAR),
          isLoading: false,
          error: null,
        });
      }
    } else {
      // Fallback to default Coruscant calendar if API fails
      console.warn('Failed to fetch story calendars, using default Coruscant calendar');
      setCalendarState({
        calendarId: null,
        config: CORUSCANT_CALENDAR,
        engine: new CalendarEngine(CORUSCANT_CALENDAR),
        isLoading: false,
        error: 'Failed to fetch calendar, using default',
      });
    }
  } catch (error) {
    console.error('Error fetching story calendar:', error);
    // Fallback to default Coruscant calendar
    setCalendarState({
      calendarId: null,
      config: CORUSCANT_CALENDAR,
      engine: new CalendarEngine(CORUSCANT_CALENDAR),
      isLoading: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Note: Calendar is now loaded from the story export data, not auto-fetched
// See loadServerStoryData in App.tsx

export const calendarStore = {
  // Getters
  get calendarId() {
    return calendarState.calendarId;
  },
  get config() {
    return calendarState.config;
  },
  get engine() {
    return calendarState.engine;
  },
  get isLoading() {
    return calendarState.isLoading;
  },
  get error() {
    return calendarState.error;
  },

  /**
   * Get the calendar engine, falling back to Coruscant if not available
   */
  getEngine(): CalendarEngine {
    return calendarState.engine || new CalendarEngine(CORUSCANT_CALENDAR);
  },

  /**
   * Format a story time using the current calendar
   */
  formatStoryTime(storyTime: number | null | undefined): string | undefined {
    if (storyTime === null || storyTime === undefined) {
      return undefined;
    }

    const engine = this.getEngine();
    const date = engine.storyTimeToDate(storyTime);
    return engine.formatDate(date);
  },

  /**
   * Format a story time with short format (without time)
   */
  formatStoryTimeShort(storyTime: number | null | undefined): string | undefined {
    if (storyTime === null || storyTime === undefined) {
      return undefined;
    }

    const engine = this.getEngine();
    const date = engine.storyTimeToDate(storyTime);
    return engine.formatDate(date, false);
  },

  /**
   * Calculate age in years using the current calendar
   */
  calculateAge(birthdate: number, currentTime: number): number {
    const engine = this.getEngine();
    return engine.calculateAge(birthdate, currentTime);
  },

  /**
   * Format age as a readable string using the current calendar
   */
  formatAge(birthdate: number, currentTime: number): string {
    const engine = this.getEngine();
    return engine.formatAge(birthdate, currentTime);
  },

  /**
   * Manually refresh the calendar from the server
   */
  async refresh(): Promise<void> {
    const storyId = currentStoryStore.id;
    if (storyId) {
      await fetchStoryCalendar(storyId);
    }
  },

  /**
   * Load calendar from export data (called when loading a story)
   */
  loadFromExport(calendars: Array<{ id: string; config: any; isDefault: boolean }>): void {
    const defaultCalendar = calendars.find(cal => cal.isDefault);

    if (defaultCalendar) {
      const engine = new CalendarEngine(defaultCalendar.config as CalendarConfig);
      setCalendarState({
        calendarId: defaultCalendar.id,
        config: defaultCalendar.config as CalendarConfig,
        engine,
        isLoading: false,
        error: null,
      });
    } else {
      // No default calendar, use Coruscant
      console.warn('No default calendar in export data, using Coruscant calendar');
      setCalendarState({
        calendarId: null,
        config: CORUSCANT_CALENDAR,
        engine: new CalendarEngine(CORUSCANT_CALENDAR),
        isLoading: false,
        error: null,
      });
    }
  },

  /**
   * Clear calendar state (when no story is loaded)
   */
  clear(): void {
    setCalendarState({
      calendarId: null,
      config: CORUSCANT_CALENDAR,
      engine: new CalendarEngine(CORUSCANT_CALENDAR),
      isLoading: false,
      error: null,
    });
  },
};
