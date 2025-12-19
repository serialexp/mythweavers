/**
 * Calendar System Types
 *
 * Defines the structure for flexible, hierarchical calendar systems.
 */

export type StoryTime = number // Minutes from epoch 0

/**
 * Hierarchical subdivision of a year
 * Examples:
 * - Year → Months → Weeks → Days
 * - Year → Quarters → Days
 * - Year → Seasons → Months → Days
 */
export interface CalendarSubdivision {
  id: string // e.g., "month", "week", "quarter", "season"
  name: string // e.g., "Month", "Week"
  pluralName: string // e.g., "Months", "Weeks"
  count: number // How many of these in the parent unit
  daysPerUnit?: number[] // Days in each unit (if variable, like months)
  daysPerUnitFixed?: number // Days in each unit (if fixed, like weeks)

  // Labels for each unit (optional)
  labels?: string[] // e.g., ["January", "February", ...] for months
  labelFormat?: string // e.g., "Week {n}" if no explicit labels
  useCustomLabels?: boolean // If false, always use labelFormat (default: true if labels exist)

  // Nested subdivisions (optional)
  subdivisions?: CalendarSubdivision[]
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

  // Display configuration
  display: {
    defaultFormat: string // Template: e.g., "{day}, {month} (Q{quarter}), {year} {era} at {hour}:{minute}"
    shortFormat: string // e.g., "{month} {day}, {year} {era}"
    includeTimeByDefault: boolean
    hourFormat: '12' | '24' // 12-hour (AM/PM) or 24-hour
  }

  // Special days (optional)
  specialDays?: {
    [subdivisionId: string]: {
      // e.g., "quarter"
      [dayNumber: number]: string // e.g., 92: "Festival Day"
    }
  }
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
