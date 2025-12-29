/**
 * Subdivision Presets
 *
 * Predefined subdivision configurations that users can add to any calendar.
 */

import type { CalendarSubdivision } from './types.js'

export interface SubdivisionPreset {
  id: string
  name: string
  description: string
  subdivision: CalendarSubdivision
}

/**
 * Standard Earth Months
 * 12 months with their standard day counts (non-leap year)
 * Total: 365 days
 */
export const EARTH_MONTHS: SubdivisionPreset = {
  id: 'earth-months',
  name: 'Earth Months',
  description: '12 months with standard day counts (Jan=31, Feb=28, etc.)',
  subdivision: {
    id: 'month',
    name: 'Month',
    pluralName: 'Months',
    count: 12,
    // Explicit: use custom days per unit (not fixed)
    daysPerUnit: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
    daysPerUnitFixed: undefined,
    // Explicit: use custom labels (not auto-numbered)
    labels: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    labelFormat: 'Month {n}',
    useCustomLabels: true,
  },
}

/**
 * Standard Earth Seasons
 * 4 seasons approximating meteorological seasons
 * Spring: 92 days (Mar-May), Summer: 92 days (Jun-Aug),
 * Fall: 91 days (Sep-Nov), Winter: 90 days (Dec-Feb)
 * Total: 365 days
 */
export const EARTH_SEASONS: SubdivisionPreset = {
  id: 'earth-seasons',
  name: 'Earth Seasons',
  description: '4 seasons (Spring 92d, Summer 92d, Fall 91d, Winter 90d)',
  subdivision: {
    id: 'season',
    name: 'Season',
    pluralName: 'Seasons',
    count: 4,
    // Explicit: use custom days per unit (not fixed)
    daysPerUnit: [92, 92, 91, 90],
    daysPerUnitFixed: undefined,
    // Explicit: use custom labels (not auto-numbered)
    labels: ['Spring', 'Summer', 'Fall', 'Winter'],
    labelFormat: 'Season {n}',
    useCustomLabels: true,
  },
}

/**
 * Standard 7-Day Week Cycle
 * A parallel cycle that repeats independently of other subdivisions
 */
export const SEVEN_DAY_WEEK: SubdivisionPreset = {
  id: 'seven-day-week',
  name: '7-Day Week',
  description: 'Standard week cycle (Sunday through Saturday)',
  subdivision: {
    id: 'weekday',
    name: 'Weekday',
    pluralName: 'Weekdays',
    count: 7,
    isCycle: true,
    epochStartsOnUnit: 1, // Monday is day 1 of year 0
    labels: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    labelFormat: 'Day {n}',
    useCustomLabels: true,
  },
}

/**
 * All available subdivision presets
 */
export const SUBDIVISION_PRESETS: SubdivisionPreset[] = [
  EARTH_MONTHS,
  EARTH_SEASONS,
  SEVEN_DAY_WEEK,
]

/**
 * Get all available subdivision presets
 */
export function getSubdivisionPresets(): SubdivisionPreset[] {
  return SUBDIVISION_PRESETS
}
