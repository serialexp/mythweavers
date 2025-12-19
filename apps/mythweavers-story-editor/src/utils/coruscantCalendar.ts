/**
 * Coruscant Calendar Utilities
 *
 * Calendar structure:
 * - 368 days per year
 * - 4 quarters per year
 * - 91 standard days per quarter
 * - 1 intercalary holiday after each quarter (day 92)
 * - 24 hour days, 60 minute hours
 *
 * Epoch: 0 BBY (Battle of Yavin)
 * - Negative values = BBY (Before Battle of Yavin)
 * - Positive values = ABY (After Battle of Yavin)
 */

export type StoryTime = number // Minutes from 0 BBY

export interface CoruscantDate {
  year: number // Year (negative = BBY, positive = ABY, 0 = 0 BBY)
  quarter: 1 | 2 | 3 | 4
  day: number // 1-92 (92 is the intercalary holiday)
  hour: number // 0-23
  minute: number // 0-59
}

// Constants
const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR // 1440
const DAYS_PER_QUARTER = 92 // 91 regular days + 1 holiday
const QUARTERS_PER_YEAR = 4
const DAYS_PER_YEAR = DAYS_PER_QUARTER * QUARTERS_PER_YEAR // 368
const MINUTES_PER_YEAR = DAYS_PER_YEAR * MINUTES_PER_DAY // 529,920

// Coruscant Season Names (by social level)
export const SEASON_NAMES = {
  upper: [
    'Conference Season', // Q1 - when the galactic summits happen
    'Gala Season', // Q2 - embassy parties
    'Recess Season', // Q3 - when the Senate breaks
    'Budget Season', // Q4
  ],
  mid: [
    'Overtime Quarter', // Q1 - when the bureaucracy goes into overdrive
    'Tourist Quarter', // Q2 - off-worlders everywhere
    'Recruitment Quarter', // Q3 - when corporations hire
    'Bonus Quarter', // Q4 - if you're lucky
  ],
  lower: [
    'Brownout Season', // Q1
    'Inspection Season', // Q2 - when regulators actually come down
    'Flood Season', // Q3 - when the upper level drainage systems get maintained
    'Quiet Season', // Q4 - when the factories briefly slow down
  ],
} as const

export type CoruscantLevel = keyof typeof SEASON_NAMES

// Default level for season names
let defaultLevel: CoruscantLevel = 'upper'

/**
 * Set the default Coruscant level for season names
 */
export function setCoruscantLevel(level: CoruscantLevel) {
  defaultLevel = level
}

/**
 * Get the current default Coruscant level
 */
export function getCoruscantLevel(): CoruscantLevel {
  return defaultLevel
}

/**
 * Get the season name for a quarter
 */
export function getSeasonName(quarter: 1 | 2 | 3 | 4, level: CoruscantLevel = defaultLevel): string {
  return SEASON_NAMES[level][quarter - 1]
}

/**
 * Convert a Coruscant date to story time (minutes from 0 BBY)
 */
export function dateToStoryTime(date: CoruscantDate): StoryTime {
  const { year, quarter, day, hour, minute } = date

  // Calculate total minutes from year 0
  let totalMinutes = 0

  // Add years
  totalMinutes += year * MINUTES_PER_YEAR

  // Add quarters (0-indexed for calculation)
  totalMinutes += (quarter - 1) * DAYS_PER_QUARTER * MINUTES_PER_DAY

  // Add days (0-indexed for calculation)
  totalMinutes += (day - 1) * MINUTES_PER_DAY

  // Add hours and minutes
  totalMinutes += hour * MINUTES_PER_HOUR
  totalMinutes += minute

  return totalMinutes
}

/**
 * Convert story time (minutes from 0 BBY) to a Coruscant date
 */
export function storyTimeToDate(time: StoryTime): CoruscantDate {
  let year: number
  let remainingMinutes: number

  if (time >= 0) {
    // Positive or zero time (ABY or year 0)
    year = Math.floor(time / MINUTES_PER_YEAR)
    remainingMinutes = time % MINUTES_PER_YEAR
  } else {
    // Negative time (BBY)
    // For negative times, we need to use ceil to get the correct year
    // and calculate minutes from the start of that year
    const absMinutes = -time
    const yearsBack = Math.ceil(absMinutes / MINUTES_PER_YEAR)
    year = -yearsBack
    remainingMinutes = yearsBack * MINUTES_PER_YEAR - absMinutes
  }

  // Calculate quarters (1-4)
  const quarterIndex = Math.floor(remainingMinutes / (DAYS_PER_QUARTER * MINUTES_PER_DAY))
  const quarter = (quarterIndex + 1) as 1 | 2 | 3 | 4

  // Remaining minutes after quarters
  remainingMinutes = remainingMinutes % (DAYS_PER_QUARTER * MINUTES_PER_DAY)

  // Calculate days (1-92)
  const day = Math.floor(remainingMinutes / MINUTES_PER_DAY) + 1

  // Remaining minutes after days
  remainingMinutes = remainingMinutes % MINUTES_PER_DAY

  // Calculate hours and minutes
  const hour = Math.floor(remainingMinutes / MINUTES_PER_HOUR)
  const minute = remainingMinutes % MINUTES_PER_HOUR

  return { year, quarter, day, hour, minute }
}

/**
 * Format a Coruscant date as a human-readable string
 */
export function formatCoruscantDate(
  date: CoruscantDate,
  includeTime = true,
  level: CoruscantLevel = defaultLevel,
): string {
  const { year, quarter, day, hour, minute } = date

  const era = year <= 0 ? 'BBY' : 'ABY'
  const absYear = Math.abs(year)

  // Determine if it's a holiday
  const isHoliday = day === 92
  const dayStr = isHoliday ? 'Festival Day' : `Day ${day}`

  // Get season name with quarter number
  const seasonName = getSeasonName(quarter, level)

  let result = `${dayStr}, ${seasonName} (Q${quarter}), ${absYear} ${era}`.trim()

  if (includeTime) {
    const hourStr = hour.toString().padStart(2, '0')
    const minuteStr = minute.toString().padStart(2, '0')
    result += ` at ${hourStr}:${minuteStr}`
  }

  return result
}

/**
 * Format story time directly as a human-readable string
 */
export function formatStoryTime(time: StoryTime, includeTime = true, level: CoruscantLevel = defaultLevel): string {
  const date = storyTimeToDate(time)
  return formatCoruscantDate(date, includeTime, level)
}

/**
 * Calculate the difference in minutes between two story times
 */
export function storyTimeDiff(start: StoryTime, end: StoryTime): number {
  return end - start
}

/**
 * Calculate the difference in minutes between two Coruscant dates
 */
export function dateDiff(start: CoruscantDate, end: CoruscantDate): number {
  return dateToStoryTime(end) - dateToStoryTime(start)
}

/**
 * Add minutes to a story time
 */
export function addMinutes(time: StoryTime, minutes: number): StoryTime {
  return time + minutes
}

/**
 * Add hours to a story time
 */
export function addHours(time: StoryTime, hours: number): StoryTime {
  return time + hours * MINUTES_PER_HOUR
}

/**
 * Add days to a story time
 */
export function addDays(time: StoryTime, days: number): StoryTime {
  return time + days * MINUTES_PER_DAY
}

/**
 * Round a story time to the nearest hour
 */
export function roundToHour(time: StoryTime): StoryTime {
  const remainder = time % MINUTES_PER_HOUR
  if (remainder < MINUTES_PER_HOUR / 2) {
    return time - remainder
  }
  return time + (MINUTES_PER_HOUR - remainder)
}

/**
 * Get the start of the day for a given story time
 */
export function startOfDay(time: StoryTime): StoryTime {
  const date = storyTimeToDate(time)
  return dateToStoryTime({ ...date, hour: 0, minute: 0 })
}

/**
 * Get the start of the quarter for a given story time
 */
export function startOfQuarter(time: StoryTime): StoryTime {
  const date = storyTimeToDate(time)
  return dateToStoryTime({ ...date, day: 1, hour: 0, minute: 0 })
}

/**
 * Get the start of the year for a given story time
 */
export function startOfYear(time: StoryTime): StoryTime {
  const date = storyTimeToDate(time)
  return dateToStoryTime({ year: date.year, quarter: 1, day: 1, hour: 0, minute: 0 })
}

/**
 * Convert quarter and day to day of year (1-368)
 */
export function quarterDayToDayOfYear(quarter: number, day: number): number {
  return (quarter - 1) * DAYS_PER_QUARTER + day
}

/**
 * Convert day of year (1-368) to quarter and day
 */
export function dayOfYearToQuarterDay(dayOfYear: number): { quarter: 1 | 2 | 3 | 4; day: number } {
  const quarterIndex = Math.floor((dayOfYear - 1) / DAYS_PER_QUARTER)
  const quarter = (quarterIndex + 1) as 1 | 2 | 3 | 4
  const day = dayOfYear - quarterIndex * DAYS_PER_QUARTER
  return { quarter, day }
}

/**
 * Calculate age in years from birthdate to current story time
 * @param birthdate Story time of birth (minutes from 0 BBY)
 * @param currentTime Current story time (minutes from 0 BBY)
 * @returns Age in years (fractional)
 */
export function calculateAge(birthdate: StoryTime, currentTime: StoryTime): number {
  const minutesDifference = currentTime - birthdate
  return minutesDifference / MINUTES_PER_YEAR
}

/**
 * Format age as a readable string (e.g., "32 years old", "5.5 years old")
 * @param birthdate Story time of birth
 * @param currentTime Current story time
 * @returns Formatted age string
 */
export function formatAge(birthdate: StoryTime, currentTime: StoryTime): string {
  const age = calculateAge(birthdate, currentTime)
  const roundedAge = Math.floor(age * 10) / 10 // Round to 1 decimal

  if (roundedAge === Math.floor(roundedAge)) {
    // Whole number, no decimal
    return `${Math.floor(roundedAge)} years old`
  }
  // Has decimal
  return `${roundedAge} years old`
}

/**
 * Example: Create a date for 22 BBY, Q2, Day 45, 14:30
 */
export function createExampleDate(): CoruscantDate {
  return {
    year: -22,
    quarter: 2,
    day: 45,
    hour: 14,
    minute: 30,
  }
}
