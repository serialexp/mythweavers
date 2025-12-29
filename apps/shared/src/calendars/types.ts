/**
 * Calendar System Types
 *
 * Defines the structure for flexible, hierarchical calendar systems.
 */

export type StoryTime = number // Minutes from epoch 0

/**
 * Subdivision of a year - can be hierarchical or a parallel cycle
 *
 * Hierarchical examples:
 * - Year → Months (12, variable days each)
 * - Year → Quarters (4, 92 days each) → Weeks (13, 7 days each)
 *
 * Cycle examples (parallel, non-nesting):
 * - Week cycle (7 days, repeating)
 * - Glimrong cycle (5 days, repeating)
 * - Market cycle (10 days, repeating)
 */
export interface CalendarSubdivision {
  id: string // e.g., "month", "week", "quarter", "season"
  name: string // e.g., "Month", "Week"
  pluralName: string // e.g., "Months", "Weeks"
  count: number // How many units (for hierarchical: in parent; for cycles: cycle length)
  daysPerUnit?: number[] // Days in each unit (if variable, like months)
  daysPerUnitFixed?: number // Days in each unit (if fixed, like quarters)

  // Labels for each unit (optional)
  labels?: string[] // e.g., ["January", "February", ...] for months, or ["Sunday", "Monday", ...] for weeks
  labelFormat?: string // e.g., "Week {n}" if no explicit labels
  useCustomLabels?: boolean // If false, always use labelFormat (default: true if labels exist)

  // Nested subdivisions (optional, only for hierarchical subdivisions)
  subdivisions?: CalendarSubdivision[]

  // Cycle mode: if true, this subdivision runs as a parallel repeating cycle
  // rather than nesting hierarchically. For cycles:
  // - `count` is the cycle length (e.g., 7 for a week)
  // - `labels` are the names of each position in the cycle
  // - `daysPerUnit`/`daysPerUnitFixed` are ignored
  isCycle?: boolean

  // For cycles: which unit (0-indexed into labels) is day 1 of year 0?
  // E.g., if epochStartsOnUnit=1 and labels=["Sunday","Monday",...], then day 1 of year 0 is Monday
  epochStartsOnUnit?: number
}

/**
 * Holiday step types for computed holidays
 *
 * A computed holiday is a pipeline of steps that transform a starting day.
 * Each step takes the current day and produces a new day.
 */
export type HolidayStep =
  | { type: 'startOfYear' } // Reset to day 1 of the year
  | {
      type: 'fixed'
      subdivisionId: string // e.g., "month"
      unit: number // e.g., 3 (March)
      day: number // e.g., 21
    }
  | { type: 'offset'; days: number } // Add/subtract days (can be negative)
  | {
      type: 'findInCycle'
      cycleId: string // which cycle subdivision (e.g., "week", "lunar")
      dayInCycle: number // 0-indexed position in cycle (e.g., 0 for Sunday, 15 for full moon)
      direction: 'onOrAfter' | 'onOrBefore' // Search direction from current day
    }

/**
 * Holiday rule types
 *
 * All holiday rules have an optional `description` field for hover text / tooltips.
 */
export type HolidayRule =
  | {
      type: 'fixed'
      name: string
      description?: string // Optional description for hover text
      subdivisionId: string // e.g., "month"
      unit: number // e.g., 12 (December)
      day: number // e.g., 25
    }
  | {
      type: 'nthCycleDay'
      name: string
      description?: string
      n: number // 1-5 (1st, 2nd, 3rd, 4th, 5th)
      cycleId: string // which cycle subdivision (e.g., "week", "glimrong")
      dayInCycle: number // 0-indexed position in cycle (e.g., 4 for Thursday if week)
      subdivisionId: string // within which hierarchical subdivision (e.g., "month")
      unit: number // which specific one (e.g., 11 for November)
    }
  | {
      type: 'lastCycleDay'
      name: string
      description?: string
      cycleId: string // which cycle subdivision
      dayInCycle: number // 0-indexed position in cycle
      subdivisionId: string
      unit: number
    }
  | {
      type: 'lastDay'
      name: string
      description?: string
      subdivisionId: string
      unit: number
    }
  | {
      type: 'computed'
      name: string
      description?: string
      steps: HolidayStep[] // Pipeline of steps to compute the holiday date
    }
  | {
      type: 'offsetFromHoliday'
      name: string
      description?: string
      baseHoliday: string // Name of another holiday (must appear earlier in holidays array)
      offsetDays: number // Days to add/subtract (can be negative)
    }

export interface CalendarConfig {
  id: string // Unique identifier
  name: string // Display name
  description: string // User-friendly description

  // Time structure (required)
  minutesPerHour: number
  hoursPerDay: number
  minutesPerDay: number // Calculated: minutesPerHour * hoursPerDay
  daysPerYear: number // Total days in a year
  minutesPerYear: number // Calculated: minutesPerDay * daysPerYear

  // Epoch offset (optional, defaults to 0)
  // Defines how many years this calendar's year 0 is offset from the universal StoryTime = 0
  // Example: If epochOffset = 100, this calendar's year 0 occurs 100 years after StoryTime = 0
  //          So at StoryTime = 0, this calendar displays year -100
  // Example: If epochOffset = -100, this calendar's year 0 occurs 100 years before StoryTime = 0
  //          So at StoryTime = 0, this calendar displays year 100
  epochOffset?: number

  // Year subdivisions (hierarchical)
  subdivisions: CalendarSubdivision[]

  // Era system
  eras: {
    positive: string // e.g., "ABY", "CE", "AD"
    negative: string // e.g., "BBY", "BCE", "BC"
    zeroLabel?: string | null // Optional: label for year 0 (or null if no year 0)
  }

  // Display configuration (uses EJS templates)
  display: {
    defaultFormat: string // EJS template: e.g., "<%= week %>, <%= month %> <%= dayOfMonth %>"
    shortFormat: string // e.g., "<%= month %> <%= dayOfMonth %>, <%= year %> <%= era %>"
    includeTimeByDefault: boolean
    hourFormat: '12' | '24' // 12-hour (AM/PM) or 24-hour
  }

  // Rule-based holidays (optional)
  holidays?: HolidayRule[]
}

export interface ParsedDate {
  year: number
  era: 'positive' | 'negative'
  dayOfYear: number
  hour: number
  minute: number

  // Subdivision values (dynamic based on config)
  // e.g., Map { "quarter" => 2, "week" => 5 }
  subdivisions: Map<string, number>
}
