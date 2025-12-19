/**
 * CalendarEngine - Core calendar conversion and formatting engine
 *
 * Handles conversion between universal StoryTime (minutes from epoch 0)
 * and human-readable calendar dates with hierarchical subdivisions.
 */

import type { CalendarConfig, CalendarSubdivision, ParsedDate, StoryTime } from './types.js'

export class CalendarEngine {
  constructor(public readonly config: CalendarConfig) {}

  /**
   * Convert story time (minutes from epoch) to a parsed date
   */
  storyTimeToDate(time: StoryTime): ParsedDate {
    const { minutesPerYear, minutesPerDay, minutesPerHour, epochOffset = 0 } = this.config

    // Adjust time by epoch offset
    // If epochOffset = 100, this calendar's year 0 is 100 years after universal epoch
    // So we subtract the offset when converting StoryTime to this calendar's date
    const adjustedTime = time - epochOffset * minutesPerYear

    let year: number
    let remainingMinutes: number

    if (adjustedTime >= 0) {
      // Positive or zero time (ABY/CE or year 0)
      year = Math.floor(adjustedTime / minutesPerYear)
      remainingMinutes = adjustedTime % minutesPerYear
    } else {
      // Negative time (BBY/BCE)
      // For negative times, we need to use ceil to get the correct year
      // and calculate minutes from the start of that year
      const absMinutes = -adjustedTime
      const yearsBack = Math.ceil(absMinutes / minutesPerYear)
      year = -yearsBack
      remainingMinutes = yearsBack * minutesPerYear - absMinutes
    }

    // Calculate day of year (1-indexed)
    const dayOfYear = Math.floor(remainingMinutes / minutesPerDay) + 1
    remainingMinutes = remainingMinutes % minutesPerDay

    // Calculate hours and minutes
    const hour = Math.floor(remainingMinutes / minutesPerHour)
    const minute = remainingMinutes % minutesPerHour

    // Calculate subdivisions
    const subdivisions = this.calculateSubdivisions(dayOfYear)

    return {
      year,
      era: year < 0 ? 'negative' : 'positive',
      dayOfYear,
      hour,
      minute,
      subdivisions,
    }
  }

  /**
   * Convert a parsed date back to story time
   */
  dateToStoryTime(date: ParsedDate): StoryTime {
    const { minutesPerYear, minutesPerDay, minutesPerHour, epochOffset = 0 } = this.config

    let totalMinutes = date.year * minutesPerYear
    totalMinutes += (date.dayOfYear - 1) * minutesPerDay
    totalMinutes += date.hour * minutesPerHour
    totalMinutes += date.minute

    // Add epoch offset to convert back to universal StoryTime
    // If epochOffset = 100, this calendar's year 0 is 100 years after universal epoch
    // So we add the offset when converting this calendar's date to StoryTime
    totalMinutes += epochOffset * minutesPerYear

    return totalMinutes
  }

  /**
   * Calculate which subdivision units a given day falls into
   * E.g., day 100 might be Quarter 2, Week 6, etc.
   */
  private calculateSubdivisions(dayOfYear: number): Map<string, number> {
    const result = new Map<string, number>()
    let remainingDays = dayOfYear - 1 // 0-indexed for calculation

    // Process each top-level subdivision
    for (const subdivision of this.config.subdivisions) {
      remainingDays = this.processSubdivision(subdivision, remainingDays, result)
    }

    return result
  }

  /**
   * Recursively process a subdivision and its nested subdivisions
   */
  private processSubdivision(subdivision: CalendarSubdivision, dayOffset: number, result: Map<string, number>): number {
    let unitIndex = 0
    let daysConsumed = 0

    if (subdivision.daysPerUnitFixed) {
      // Fixed size units (e.g., weeks of 7 days)
      unitIndex = Math.floor(dayOffset / subdivision.daysPerUnitFixed)
      daysConsumed = unitIndex * subdivision.daysPerUnitFixed
    } else if (subdivision.daysPerUnit) {
      // Variable size units (e.g., months with different lengths)
      let currentDayCount = 0
      for (let i = 0; i < subdivision.count; i++) {
        const daysInUnit = subdivision.daysPerUnit[i]
        if (currentDayCount + daysInUnit > dayOffset) {
          unitIndex = i
          daysConsumed = currentDayCount
          break
        }
        currentDayCount += daysInUnit
      }
    }

    // Store this subdivision's value (1-indexed for display)
    result.set(subdivision.id, unitIndex + 1)

    // Process nested subdivisions with remaining days in current unit
    if (subdivision.subdivisions) {
      const remainingInUnit = dayOffset - daysConsumed
      // Process each nested subdivision independently at this level
      for (const nestedSub of subdivision.subdivisions) {
        this.processSubdivisionNested(nestedSub, remainingInUnit, result)
      }
    }

    return dayOffset
  }

  /**
   * Process nested subdivision independently (for deeply nested structures)
   */
  private processSubdivisionNested(
    subdivision: CalendarSubdivision,
    dayOffset: number,
    result: Map<string, number>,
  ): void {
    let unitIndex = 0
    let daysConsumed = 0

    if (subdivision.daysPerUnitFixed) {
      unitIndex = Math.floor(dayOffset / subdivision.daysPerUnitFixed)
      daysConsumed = unitIndex * subdivision.daysPerUnitFixed
    } else if (subdivision.daysPerUnit) {
      let currentDayCount = 0
      for (let i = 0; i < subdivision.count; i++) {
        const daysInUnit = subdivision.daysPerUnit[i]
        if (currentDayCount + daysInUnit > dayOffset) {
          unitIndex = i
          daysConsumed = currentDayCount
          break
        }
        currentDayCount += daysInUnit
      }
    }

    result.set(subdivision.id, unitIndex + 1)

    // Recursively process deeper nesting
    if (subdivision.subdivisions) {
      const remainingInUnit = dayOffset - daysConsumed
      for (const nestedSub of subdivision.subdivisions) {
        this.processSubdivisionNested(nestedSub, remainingInUnit, result)
      }
    }
  }

  /**
   * Format a parsed date according to config template
   */
  formatDate(date: ParsedDate, includeTime = true): string {
    const absYear = Math.abs(date.year)
    const era = this.config.eras[date.era]

    let template = includeTime ? this.config.display.defaultFormat : this.config.display.shortFormat

    // Replace basic placeholders
    template = template
      .replace(/{year}/g, absYear.toString())
      .replace(/{era}/g, era)
      .replace(/{hour}/g, date.hour.toString().padStart(2, '0'))
      .replace(/{minute}/g, date.minute.toString().padStart(2, '0'))
      .replace(/{dayOfYear}/g, date.dayOfYear.toString())

    // Check for special day labels first
    let specialDayLabel: string | null = null
    if (this.config.specialDays) {
      for (const [subdivisionId, specialDayMap] of Object.entries(this.config.specialDays) as [
        string,
        Record<number, string>,
      ][]) {
        const subdivisionValue = date.subdivisions.get(subdivisionId)
        if (subdivisionValue !== undefined) {
          // Check if current day within subdivision is special
          const dayInSubdivision = this.getDayOfSubdivision(date, subdivisionId)
          if (specialDayMap[dayInSubdivision]) {
            specialDayLabel = specialDayMap[dayInSubdivision]
            break
          }
        }
      }
    }

    // Replace {dayLabel} with special day or default
    if (template.includes('{dayLabel}')) {
      const label = specialDayLabel || `Day ${date.dayOfYear}`
      template = template.replace(/{dayLabel}/g, label)
    }

    // Replace subdivision placeholders
    for (const [subdivisionId, value] of date.subdivisions) {
      const sub = this.findSubdivision(subdivisionId)
      if (!sub) continue

      // Label: {quarter}, {month}, etc. - DO THIS FIRST before numeric replacement
      const labelPlaceholder = `{${subdivisionId}}`
      let labelReplaced = false

      // Check if we should use custom labels
      // useCustomLabels defaults to true if labels exist, but can be explicitly set to false
      const shouldUseCustomLabels = sub.useCustomLabels !== false && sub.labels

      // Use custom label if enabled and it exists and is not empty, otherwise fall back to labelFormat
      if (shouldUseCustomLabels) {
        const customLabel = sub.labels![value - 1]
        if (customLabel?.trim()) {
          template = template.replace(new RegExp(labelPlaceholder.replace(/[{}]/g, '\\$&'), 'g'), customLabel)
          labelReplaced = true
        }
      }

      if (!labelReplaced && sub.labelFormat) {
        const label = sub.labelFormat.replace('{n}', value.toString())
        template = template.replace(new RegExp(labelPlaceholder.replace(/[{}]/g, '\\$&'), 'g'), label)
        labelReplaced = true
      }

      // Only replace with numeric value if no label was used
      if (!labelReplaced && template.includes(labelPlaceholder)) {
        template = template.replace(new RegExp(labelPlaceholder.replace(/[{}]/g, '\\$&'), 'g'), value.toString())
      }

      // Numeric value: {quarterNumber}, {monthNumber}, etc.
      const numericPlaceholder = `{${subdivisionId}Number}`
      template = template.replace(new RegExp(numericPlaceholder.replace(/[{}]/g, '\\$&'), 'g'), value.toString())

      // Day within subdivision: {dayOfQuarter}, {dayOfMonth}, etc.
      // But DON'T replace if "dayOfX" is itself a subdivision name (to avoid conflicts)
      const dayOfPlaceholder = `{dayOf${this.capitalize(subdivisionId)}}`
      const possibleConflictingSubdivision = `dayOf${this.capitalize(subdivisionId)}`

      if (template.includes(dayOfPlaceholder)) {
        // Only replace if this isn't an actual subdivision name
        const isActualSubdivision = date.subdivisions.has(possibleConflictingSubdivision)

        if (!isActualSubdivision) {
          const dayInSub = this.getDayOfSubdivision(date, subdivisionId)
          template = template.replace(new RegExp(dayOfPlaceholder.replace(/[{}]/g, '\\$&'), 'g'), dayInSub.toString())
        }
      }
    }

    return template
  }

  /**
   * Format story time directly (convenience method)
   */
  formatStoryTime(time: StoryTime, includeTime = true): string {
    const date = this.storyTimeToDate(time)
    return this.formatDate(date, includeTime)
  }

  /**
   * Get the day number within a specific subdivision
   * E.g., day 95 of year might be day 3 of quarter 2
   */
  private getDayOfSubdivision(date: ParsedDate, subdivisionId: string): number {
    const subdivision = this.findSubdivision(subdivisionId)
    if (!subdivision) return 1

    const unitNumber = date.subdivisions.get(subdivisionId)
    if (unitNumber === undefined) return 1

    // Calculate how many days come before this unit
    let daysBefore = 0
    if (subdivision.daysPerUnitFixed) {
      daysBefore = (unitNumber - 1) * subdivision.daysPerUnitFixed
    } else if (subdivision.daysPerUnit) {
      for (let i = 0; i < unitNumber - 1; i++) {
        daysBefore += subdivision.daysPerUnit[i]
      }
    }

    return date.dayOfYear - daysBefore
  }

  /**
   * Find a subdivision by ID in the hierarchy
   */
  private findSubdivision(id: string, subdivisions = this.config.subdivisions): CalendarSubdivision | null {
    for (const sub of subdivisions) {
      if (sub.id === id) return sub
      if (sub.subdivisions) {
        const found = this.findSubdivision(id, sub.subdivisions)
        if (found) return found
      }
    }
    return null
  }

  /**
   * Capitalize first letter of a string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  // ========== Arithmetic Operations ==========

  /**
   * Add minutes to a story time
   */
  addMinutes(time: StoryTime, minutes: number): StoryTime {
    return time + minutes
  }

  /**
   * Add hours to a story time
   */
  addHours(time: StoryTime, hours: number): StoryTime {
    return time + hours * this.config.minutesPerHour
  }

  /**
   * Add days to a story time
   */
  addDays(time: StoryTime, days: number): StoryTime {
    return time + days * this.config.minutesPerDay
  }

  // ========== Rounding Operations ==========

  /**
   * Round a story time to the nearest hour
   */
  roundToHour(time: StoryTime): StoryTime {
    const remainder = time % this.config.minutesPerHour
    if (remainder < this.config.minutesPerHour / 2) {
      return time - remainder
    }
    return time + (this.config.minutesPerHour - remainder)
  }

  /**
   * Get the start of the day for a given story time
   */
  startOfDay(time: StoryTime): StoryTime {
    const date = this.storyTimeToDate(time)
    return this.dateToStoryTime({ ...date, hour: 0, minute: 0 })
  }

  /**
   * Get the start of the year for a given story time
   */
  startOfYear(time: StoryTime): StoryTime {
    const date = this.storyTimeToDate(time)
    return this.dateToStoryTime({
      ...date,
      dayOfYear: 1,
      hour: 0,
      minute: 0,
    })
  }

  // ========== Age Calculations ==========

  /**
   * Calculate age in years from birthdate to current story time
   * Uses this calendar's year length for the calculation
   * @param birthdate Story time of birth (minutes from epoch)
   * @param currentTime Current story time (minutes from epoch)
   * @returns Age in years (fractional)
   */
  calculateAge(birthdate: StoryTime, currentTime: StoryTime): number {
    const minutesDifference = currentTime - birthdate
    return minutesDifference / this.config.minutesPerYear
  }

  /**
   * Format age as a readable string (e.g., "32 years old", "5.5 years old")
   * @param birthdate Story time of birth
   * @param currentTime Current story time
   * @returns Formatted age string
   */
  formatAge(birthdate: StoryTime, currentTime: StoryTime): string {
    const age = this.calculateAge(birthdate, currentTime)
    const roundedAge = Math.floor(age * 10) / 10 // Round to 1 decimal

    if (roundedAge === Math.floor(roundedAge)) {
      // Whole number, no decimal
      return `${Math.floor(roundedAge)} years old`
    }
    // Has decimal
    return `${roundedAge} years old`
  }
}
