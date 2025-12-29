/**
 * CalendarEngine - Core calendar conversion and formatting engine
 *
 * Handles conversion between universal StoryTime (minutes from epoch 0)
 * and human-readable calendar dates with hierarchical subdivisions.
 *
 * Supports:
 * - Hierarchical subdivisions (months, quarters, etc.)
 * - Parallel cycle subdivisions (weeks, market cycles, etc.)
 * - Rule-based holidays (fixed, nthCycleDay, lastCycleDay, lastDay)
 * - EJS template-based formatting
 */

import ejs from 'ejs'
import type { CalendarConfig, CalendarSubdivision, HolidayRule, HolidayStep, ParsedDate, StoryTime } from './types.js'

export class CalendarEngine {
  // Cache: year -> (day of year -> holiday name)
  private holidayCache: Map<number, Map<number, string>> = new Map()

  constructor(public readonly config: CalendarConfig) {}

  /**
   * Convert story time (minutes from epoch) to a parsed date
   */
  storyTimeToDate(time: StoryTime): ParsedDate {
    const { minutesPerYear, minutesPerDay, minutesPerHour, epochOffset = 0 } = this.config

    // Adjust time by epoch offset
    const adjustedTime = time - epochOffset * minutesPerYear

    let year: number
    let remainingMinutes: number

    if (adjustedTime >= 0) {
      year = Math.floor(adjustedTime / minutesPerYear)
      remainingMinutes = adjustedTime % minutesPerYear
    } else {
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

    // Calculate subdivisions (both hierarchical and cycles)
    const subdivisions = this.calculateSubdivisions(dayOfYear, year)

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
   * Get subdivisions for a given day of year and year
   * Useful when you have year/dayOfYear but need the subdivision values
   */
  getSubdivisions(dayOfYear: number, year: number): Map<string, number> {
    return this.calculateSubdivisions(dayOfYear, year)
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

    totalMinutes += epochOffset * minutesPerYear

    return totalMinutes
  }

  /**
   * Calculate which subdivision units a given day falls into
   * Handles both hierarchical subdivisions and parallel cycles
   */
  private calculateSubdivisions(dayOfYear: number, year: number): Map<string, number> {
    const result = new Map<string, number>()
    const remainingDays = dayOfYear - 1 // 0-indexed for calculation

    // Process each top-level subdivision
    for (const subdivision of this.config.subdivisions) {
      if (subdivision.isCycle) {
        // Cycle subdivision: use modulo arithmetic
        this.processCycleSubdivision(subdivision, dayOfYear, year, result)
      } else {
        // Hierarchical subdivision: use day offset calculation
        this.processSubdivision(subdivision, remainingDays, result)
      }
    }

    return result
  }

  /**
   * Process a cycle subdivision (parallel, non-nesting)
   * Uses modulo arithmetic to determine position in cycle
   */
  private processCycleSubdivision(
    subdivision: CalendarSubdivision,
    dayOfYear: number,
    year: number,
    result: Map<string, number>,
  ): void {
    const cycleLength = subdivision.count
    const epochStart = subdivision.epochStartsOnUnit ?? 0

    // Calculate total days from epoch
    const totalDaysFromEpoch = year * this.config.daysPerYear + (dayOfYear - 1)

    // Calculate position in cycle
    let cyclePosition: number
    if (totalDaysFromEpoch >= 0) {
      cyclePosition = (totalDaysFromEpoch + epochStart) % cycleLength
    } else {
      // Handle negative days correctly
      const absTotal = -totalDaysFromEpoch
      const mod = absTotal % cycleLength
      cyclePosition = (epochStart - mod + cycleLength) % cycleLength
    }

    // Store as 1-indexed for consistency with other subdivisions
    result.set(subdivision.id, cyclePosition + 1)
  }

  /**
   * Recursively process a hierarchical subdivision
   */
  private processSubdivision(subdivision: CalendarSubdivision, dayOffset: number, result: Map<string, number>): number {
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

    // Store this subdivision's value (1-indexed for display)
    result.set(subdivision.id, unitIndex + 1)

    // Process nested subdivisions with remaining days in current unit
    if (subdivision.subdivisions) {
      const remainingInUnit = dayOffset - daysConsumed
      for (const nestedSub of subdivision.subdivisions) {
        if (nestedSub.isCycle) {
          // Nested cycles still use global day calculation
          // This is a bit unusual but supported
          this.processCycleSubdivision(nestedSub, dayOffset + 1, 0, result)
        } else {
          this.processSubdivisionNested(nestedSub, remainingInUnit, result)
        }
      }
    }

    return dayOffset
  }

  /**
   * Process nested hierarchical subdivision
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

    if (subdivision.subdivisions) {
      const remainingInUnit = dayOffset - daysConsumed
      for (const nestedSub of subdivision.subdivisions) {
        this.processSubdivisionNested(nestedSub, remainingInUnit, result)
      }
    }
  }

  // ========== Cycle Helpers ==========

  /**
   * Get the cycle position for a specific cycle subdivision
   * Returns null if the subdivision is not a cycle or doesn't exist
   */
  getCyclePosition(date: ParsedDate, cycleId: string): { index: number; name: string } | null {
    const subdivision = this.findSubdivision(cycleId)
    if (!subdivision || !subdivision.isCycle) return null

    const value = date.subdivisions.get(cycleId)
    if (value === undefined) return null

    const index = value - 1 // Convert back to 0-indexed
    const name = subdivision.labels?.[index] ?? `${subdivision.name} ${value}`

    return { index, name }
  }

  /**
   * Get all cycle subdivisions from the config
   */
  getCycleSubdivisions(): CalendarSubdivision[] {
    const cycles: CalendarSubdivision[] = []
    const collectCycles = (subs: CalendarSubdivision[]) => {
      for (const sub of subs) {
        if (sub.isCycle) {
          cycles.push(sub)
        }
        if (sub.subdivisions) {
          collectCycles(sub.subdivisions)
        }
      }
    }
    collectCycles(this.config.subdivisions)
    return cycles
  }

  // ========== Holiday Calculation ==========

  /**
   * Get the holiday name for a parsed date
   * Returns null if no holiday matches
   */
  getHoliday(date: ParsedDate): string | null {
    const { holidays } = this.config
    if (!holidays || holidays.length === 0) return null

    // Get all holiday dates for this year (uses caching)
    const yearHolidays = this.getHolidaysByDayForYear(date.year)

    // Check if this day has a holiday
    return yearHolidays.get(date.dayOfYear) ?? null
  }

  /**
   * Get all holiday dates for a given year
   * Returns a map of day of year -> holiday name
   * Uses caching for performance
   */
  getHolidaysByDayForYear(year: number): Map<number, string> {
    // Check cache first
    if (this.holidayCache.has(year)) {
      return this.holidayCache.get(year)!
    }

    const { holidays } = this.config
    const results = new Map<number, string>()

    if (!holidays || holidays.length === 0) {
      this.holidayCache.set(year, results)
      return results
    }

    // Intermediate map for name -> day (used for offsetFromHoliday resolution)
    const holidayByName = new Map<string, number>()

    // Process holidays in order (offsetFromHoliday must come after their base)
    for (const rule of holidays) {
      const dayOfYear = this.evaluateHolidayRule(rule, year, holidayByName)
      if (dayOfYear !== null) {
        // Store in both maps - by name for resolution, by day for lookup
        holidayByName.set(rule.name, dayOfYear)
        // Only store if this day doesn't already have a holiday (first wins)
        if (!results.has(dayOfYear)) {
          results.set(dayOfYear, rule.name)
        }
      }
    }

    this.holidayCache.set(year, results)
    return results
  }

  /**
   * Get all holidays for a year as name -> day of year map
   * Useful for UI display. Note: if same name appears multiple times,
   * only the last occurrence is stored.
   */
  getAllHolidaysForYear(year: number): Map<string, number> {
    const { holidays } = this.config
    const results = new Map<string, number>()

    if (!holidays || holidays.length === 0) {
      return results
    }

    // Process holidays in order
    for (const rule of holidays) {
      const dayOfYear = this.evaluateHolidayRule(rule, year, results)
      if (dayOfYear !== null) {
        results.set(rule.name, dayOfYear)
      }
    }

    return results
  }

  /**
   * Evaluate a holiday rule and return the day of year it falls on
   */
  private evaluateHolidayRule(rule: HolidayRule, year: number, previousHolidays: Map<string, number>): number | null {
    switch (rule.type) {
      case 'fixed':
        return this.getStartDayOfSubdivisionUnit(rule.subdivisionId, rule.unit) + rule.day - 1

      case 'nthCycleDay':
        return this.evaluateNthCycleDayHoliday(rule, year)

      case 'lastCycleDay':
        return this.evaluateLastCycleDayHoliday(rule, year)

      case 'lastDay':
        return this.getEndDayOfSubdivisionUnit(rule.subdivisionId, rule.unit)

      case 'computed':
        return this.evaluateComputedHoliday(rule.steps, year)

      case 'offsetFromHoliday': {
        const baseDay = previousHolidays.get(rule.baseHoliday)
        if (baseDay === undefined) return null
        return baseDay + rule.offsetDays
      }

      default:
        return null
    }
  }

  /**
   * Evaluate nth cycle day holiday (e.g., "4th Thursday of November")
   */
  private evaluateNthCycleDayHoliday(rule: Extract<HolidayRule, { type: 'nthCycleDay' }>, year: number): number | null {
    const cycle = this.findSubdivision(rule.cycleId)
    if (!cycle || !cycle.isCycle) return null

    const startDayOfYear = this.getStartDayOfSubdivisionUnit(rule.subdivisionId, rule.unit)
    const endDayOfYear = this.getEndDayOfSubdivisionUnit(rule.subdivisionId, rule.unit)

    let currentDay = startDayOfYear
    let occurrenceCount = 0

    while (currentDay <= endDayOfYear) {
      const cyclePos = this.getCyclePositionForDay(currentDay, year, rule.cycleId)
      if (cyclePos === rule.dayInCycle) {
        occurrenceCount++
        if (occurrenceCount === rule.n) {
          return currentDay
        }
      }
      currentDay++
    }

    return null
  }

  /**
   * Evaluate last cycle day holiday (e.g., "Last Monday of May")
   */
  private evaluateLastCycleDayHoliday(rule: Extract<HolidayRule, { type: 'lastCycleDay' }>, year: number): number | null {
    const cycle = this.findSubdivision(rule.cycleId)
    if (!cycle || !cycle.isCycle) return null

    const startDayOfYear = this.getStartDayOfSubdivisionUnit(rule.subdivisionId, rule.unit)
    const endDayOfYear = this.getEndDayOfSubdivisionUnit(rule.subdivisionId, rule.unit)

    for (let currentDay = endDayOfYear; currentDay >= startDayOfYear; currentDay--) {
      const cyclePos = this.getCyclePositionForDay(currentDay, year, rule.cycleId)
      if (cyclePos === rule.dayInCycle) {
        return currentDay
      }
    }

    return null
  }

  /**
   * Evaluate a computed holiday by executing its step pipeline
   */
  private evaluateComputedHoliday(steps: HolidayStep[], year: number): number | null {
    if (steps.length === 0) return null

    let currentDay = 1 // Start at day 1 unless overridden

    for (const step of steps) {
      switch (step.type) {
        case 'startOfYear':
          currentDay = 1
          break

        case 'fixed':
          currentDay = this.getStartDayOfSubdivisionUnit(step.subdivisionId, step.unit) + step.day - 1
          break

        case 'offset':
          currentDay += step.days
          break

        case 'findInCycle':
          currentDay = this.findInCycle(currentDay, year, step.cycleId, step.dayInCycle, step.direction)
          break
      }
    }

    return currentDay
  }

  /**
   * Find the next/previous day in a cycle that matches the target position
   */
  private findInCycle(
    startDayOfYear: number,
    year: number,
    cycleId: string,
    targetDayInCycle: number,
    direction: 'onOrAfter' | 'onOrBefore',
  ): number {
    const cycle = this.findSubdivision(cycleId)
    if (!cycle?.isCycle) {
      // If cycle doesn't exist, return the start day unchanged
      return startDayOfYear
    }

    const step = direction === 'onOrAfter' ? 1 : -1

    // Search at most one full cycle length
    for (let offset = 0; offset <= cycle.count; offset++) {
      const day = startDayOfYear + offset * step
      const position = this.getCyclePositionForDay(day, year, cycleId)
      if (position === targetDayInCycle) {
        return day
      }
    }

    // Fallback (shouldn't happen with valid cycle)
    return startDayOfYear
  }

  /**
   * Get the cycle position (0-indexed) for a specific day of year
   */
  private getCyclePositionForDay(dayOfYear: number, year: number, cycleId: string): number {
    const cycle = this.findSubdivision(cycleId)
    if (!cycle?.isCycle) return 0

    const totalDays = year * this.config.daysPerYear + (dayOfYear - 1)
    const epochStart = cycle.epochStartsOnUnit ?? 0

    if (totalDays >= 0) {
      return (totalDays + epochStart) % cycle.count
    } else {
      // Handle negative days correctly
      const absTotal = -totalDays
      const mod = absTotal % cycle.count
      return (epochStart - mod + cycle.count) % cycle.count
    }
  }

  /**
   * Get the first day of year for a subdivision unit (1-indexed)
   */
  private getStartDayOfSubdivisionUnit(subdivisionId: string, unit: number): number {
    const subdivision = this.findSubdivision(subdivisionId)
    if (!subdivision || subdivision.isCycle) return 1

    let daysBefore = 0
    if (subdivision.daysPerUnitFixed) {
      daysBefore = (unit - 1) * subdivision.daysPerUnitFixed
    } else if (subdivision.daysPerUnit) {
      for (let i = 0; i < unit - 1; i++) {
        daysBefore += subdivision.daysPerUnit[i]
      }
    }

    return daysBefore + 1
  }

  /**
   * Get the last day of year for a subdivision unit (1-indexed)
   */
  private getEndDayOfSubdivisionUnit(subdivisionId: string, unit: number): number {
    const subdivision = this.findSubdivision(subdivisionId)
    if (!subdivision || subdivision.isCycle) return this.config.daysPerYear

    let daysUpToEnd = 0
    if (subdivision.daysPerUnitFixed) {
      daysUpToEnd = unit * subdivision.daysPerUnitFixed
    } else if (subdivision.daysPerUnit) {
      for (let i = 0; i < unit; i++) {
        daysUpToEnd += subdivision.daysPerUnit[i]
      }
    }

    return daysUpToEnd
  }

  // ========== EJS Formatting ==========

  /**
   * Format a parsed date using EJS template
   */
  formatDate(date: ParsedDate, includeTime = true): string {
    const template = includeTime ? this.config.display.defaultFormat : this.config.display.shortFormat

    const data = this.buildFormatData(date)

    // Wrap data in a Proxy that returns undefined for missing properties
    // This prevents ReferenceError when templates use variables for subdivisions that don't exist
    // We need to exclude EJS internal function names to avoid breaking the template engine
    const ejsInternals = new Set([
      'escapeFn',
      '__append',
      '__output',
      '__line',
      'include',
      'rethrow',
      'escape',
      'localsName',
    ])

    const safeData = new Proxy(data, {
      has(target, prop) {
        // Don't intercept symbols or EJS internals
        if (typeof prop === 'symbol') return prop in target
        if (ejsInternals.has(prop as string)) return false
        return true
      },
      get(target, prop) {
        if (prop in target) {
          return target[prop as string]
        }
        // Return undefined for missing string properties (subdivision names, etc.)
        if (typeof prop === 'string' && !ejsInternals.has(prop)) return undefined
        // Let other properties fall through normally
        return undefined
      },
    })

    try {
      return ejs.render(template, safeData)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return `[Template error: ${errorMessage}]`
    }
  }

  /**
   * Build the data object for EJS formatting
   */
  private buildFormatData(date: ParsedDate): Record<string, unknown> {
    const absYear = Math.abs(date.year)
    const era = this.config.eras[date.era]

    const data: Record<string, unknown> = {
      year: absYear,
      era,
      dayOfYear: date.dayOfYear,
      hour: date.hour.toString().padStart(2, '0'),
      minute: date.minute.toString().padStart(2, '0'),
      holiday: this.getHoliday(date),
    }

    // Add all subdivision values (both hierarchical and cycles)
    for (const [subdivisionId, value] of date.subdivisions) {
      const sub = this.findSubdivision(subdivisionId)
      if (!sub) continue

      // Add label (string)
      let label: string
      const shouldUseCustomLabels = sub.useCustomLabels !== false && sub.labels
      if (shouldUseCustomLabels && sub.labels![value - 1]?.trim()) {
        label = sub.labels![value - 1]
      } else if (sub.labelFormat) {
        label = sub.labelFormat.replace('{n}', value.toString())
      } else {
        label = value.toString()
      }
      data[subdivisionId] = label

      // Add numeric value (0-indexed for cycles, 1-indexed for hierarchical)
      data[`${subdivisionId}Number`] = value

      // For hierarchical subdivisions, add day of subdivision
      if (!sub.isCycle) {
        const dayOfSub = this.getDayOfSubdivision(date, subdivisionId)
        data[`dayOf${this.capitalize(subdivisionId)}`] = dayOfSub
      }
    }

    return data
  }

  /**
   * Format story time directly (convenience method)
   */
  formatStoryTime(time: StoryTime, includeTime = true): string {
    const date = this.storyTimeToDate(time)
    return this.formatDate(date, includeTime)
  }

  /**
   * Get the day number within a specific hierarchical subdivision
   */
  private getDayOfSubdivision(date: ParsedDate, subdivisionId: string): number {
    const subdivision = this.findSubdivision(subdivisionId)
    if (!subdivision || subdivision.isCycle) return 1

    const unitNumber = date.subdivisions.get(subdivisionId)
    if (unitNumber === undefined) return 1

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

  addMinutes(time: StoryTime, minutes: number): StoryTime {
    return time + minutes
  }

  addHours(time: StoryTime, hours: number): StoryTime {
    return time + hours * this.config.minutesPerHour
  }

  addDays(time: StoryTime, days: number): StoryTime {
    return time + days * this.config.minutesPerDay
  }

  // ========== Rounding Operations ==========

  roundToHour(time: StoryTime): StoryTime {
    const remainder = time % this.config.minutesPerHour
    if (remainder < this.config.minutesPerHour / 2) {
      return time - remainder
    }
    return time + (this.config.minutesPerHour - remainder)
  }

  startOfDay(time: StoryTime): StoryTime {
    const date = this.storyTimeToDate(time)
    return this.dateToStoryTime({ ...date, hour: 0, minute: 0 })
  }

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

  calculateAge(birthdate: StoryTime, currentTime: StoryTime): number {
    const minutesDifference = currentTime - birthdate
    return minutesDifference / this.config.minutesPerYear
  }

  formatAge(birthdate: StoryTime, currentTime: StoryTime): string {
    const age = this.calculateAge(birthdate, currentTime)
    const roundedAge = Math.floor(age * 10) / 10

    if (roundedAge === Math.floor(roundedAge)) {
      return `${Math.floor(roundedAge)} years old`
    }
    return `${roundedAge} years old`
  }
}
