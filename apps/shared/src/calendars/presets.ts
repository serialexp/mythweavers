/**
 * Calendar Presets
 *
 * Built-in calendar configurations that users can choose from.
 */

import type { CalendarConfig } from './types.js'

/**
 * Coruscant Standard Calendar (Star Wars)
 *
 * The galactic standard calendar used throughout the Star Wars universe.
 * - 368 days per year (4 quarters of 92 days each)
 * - Each quarter has 91 regular days + 1 festival day
 * - 24-hour days, 60-minute hours
 * - Epoch: 0 BBY (Battle of Yavin)
 */
export const CORUSCANT_CALENDAR: CalendarConfig = {
  id: 'coruscant',
  name: 'Coruscant Standard Calendar',
  description: 'Galactic standard timekeeping (368 days, BBY/ABY)',
  minutesPerHour: 60,
  hoursPerDay: 24,
  minutesPerDay: 1440,
  daysPerYear: 368,
  minutesPerYear: 529920,
  subdivisions: [
    {
      id: 'quarter',
      name: 'Quarter',
      pluralName: 'Quarters',
      count: 4,
      daysPerUnitFixed: 92,
      labels: ['Conference Season', 'Gala Season', 'Recess Season', 'Budget Season'],
      subdivisions: [
        {
          id: 'week',
          name: 'Week',
          pluralName: 'Weeks',
          count: 13,
          daysPerUnitFixed: 7,
          labelFormat: 'Week {n}',
        },
      ],
    },
  ],
  eras: {
    positive: 'ABY',
    negative: 'BBY',
  },
  display: {
    defaultFormat: '{dayLabel}, {quarter} (Q{quarterNumber}), {year} {era} at {hour}:{minute}',
    shortFormat: 'Q{quarterNumber} Day {dayOfQuarter}, {year} {era}',
    includeTimeByDefault: true,
    hourFormat: '24',
  },
  specialDays: {
    quarter: {
      92: 'Festival Day',
    },
  },
}

/**
 * Simple 365-Day Calendar
 *
 * A straightforward calendar for stories that don't need complex subdivisions.
 * - 365 days per year
 * - No subdivisions (just day of year)
 * - 24-hour days, 60-minute hours
 * - Generic era system (BE/AE)
 */
export const SIMPLE_365_CALENDAR: CalendarConfig = {
  id: 'simple365',
  name: 'Simple 365-Day Calendar',
  description: 'Basic 365-day year, no subdivisions',
  minutesPerHour: 60,
  hoursPerDay: 24,
  minutesPerDay: 1440,
  daysPerYear: 365,
  minutesPerYear: 525600,
  subdivisions: [],
  eras: {
    positive: 'AE',
    negative: 'BE',
  },
  display: {
    defaultFormat: 'Day {dayOfYear}, Year {year} {era} at {hour}:{minute}',
    shortFormat: 'Day {dayOfYear}, Year {year} {era}',
    includeTimeByDefault: true,
    hourFormat: '24',
  },
}

/**
 * All available calendar presets
 */
export const CALENDAR_PRESETS: Record<string, CalendarConfig> = {
  coruscant: CORUSCANT_CALENDAR,
  simple365: SIMPLE_365_CALENDAR,
}

/**
 * Get a calendar preset by ID
 * @param id - Calendar preset ID
 * @returns Calendar config, or undefined if not found
 */
export function getCalendarPreset(id: string): CalendarConfig | undefined {
  return CALENDAR_PRESETS[id]
}

/**
 * Get all available calendar presets
 * @returns Array of calendar configs
 */
export function listCalendarPresets(): CalendarConfig[] {
  return Object.values(CALENDAR_PRESETS)
}

/**
 * Get default calendar preset (Simple365)
 * @returns Simple 365-day calendar config
 */
export function getDefaultCalendarPreset(): CalendarConfig {
  return SIMPLE_365_CALENDAR
}
