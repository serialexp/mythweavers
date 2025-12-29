/**
 * CalendarEngine Tests - Holiday Rules System with Per-Subdivision Cycles
 *
 * Following TDD approach: tests are written before implementation.
 */

import { describe, it, expect } from 'vitest'
import { CalendarEngine } from './engine.js'
import type { CalendarConfig } from './types.js'

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Simple calendar without any cycles for testing null returns
 */
const SIMPLE_CALENDAR: CalendarConfig = {
  id: 'simple',
  name: 'Simple Calendar',
  description: 'No cycles',
  minutesPerHour: 60,
  hoursPerDay: 24,
  minutesPerDay: 1440,
  daysPerYear: 365,
  minutesPerYear: 525600,
  subdivisions: [],
  eras: { positive: 'CE', negative: 'BCE' },
  display: {
    defaultFormat: '<%= dayOfYear %>, <%= year %> <%= era %>',
    shortFormat: '<%= dayOfYear %>, <%= year %> <%= era %>',
    includeTimeByDefault: false,
    hourFormat: '24',
  },
}

/**
 * Calendar with a 7-day week cycle subdivision
 */
const WEEK_CYCLE_CALENDAR: CalendarConfig = {
  ...SIMPLE_CALENDAR,
  id: 'week-cycle',
  name: 'Week Cycle Calendar',
  description: 'With week cycle',
  subdivisions: [
    {
      id: 'week',
      name: 'Week',
      pluralName: 'Weeks',
      count: 7,
      isCycle: true,
      epochStartsOnUnit: 0, // Day 1 of Year 0 is Sunday (index 0)
      labels: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
  ],
}

/**
 * Calendar with week cycle starting on Monday (epochStartsOnUnit: 1)
 */
const MONDAY_START_CALENDAR: CalendarConfig = {
  ...SIMPLE_CALENDAR,
  id: 'monday-start',
  name: 'Monday Start Calendar',
  subdivisions: [
    {
      id: 'week',
      name: 'Week',
      pluralName: 'Weeks',
      count: 7,
      isCycle: true,
      epochStartsOnUnit: 1, // Day 1 of Year 0 is Monday
      labels: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
  ],
}

/**
 * Gregorian-like calendar with months and week cycle for holiday testing
 */
const GREGORIAN_TEST_CALENDAR: CalendarConfig = {
  id: 'gregorian-test',
  name: 'Gregorian Test',
  description: 'For holiday testing',
  minutesPerHour: 60,
  hoursPerDay: 24,
  minutesPerDay: 1440,
  daysPerYear: 365,
  minutesPerYear: 525600,
  subdivisions: [
    {
      id: 'month',
      name: 'Month',
      pluralName: 'Months',
      count: 12,
      daysPerUnit: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
      labels: ['January', 'February', 'March', 'April', 'May', 'June',
               'July', 'August', 'September', 'October', 'November', 'December'],
    },
    {
      id: 'week',
      name: 'Week',
      pluralName: 'Weeks',
      count: 7,
      isCycle: true,
      epochStartsOnUnit: 1, // Jan 1, Year 0 is Monday
      labels: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
  ],
  eras: { positive: 'CE', negative: 'BCE' },
  display: {
    defaultFormat: '<%= month %> <%= dayOfMonth %>, <%= year %> <%= era %>',
    shortFormat: '<%= month %> <%= dayOfMonth %>, <%= year %> <%= era %>',
    includeTimeByDefault: false,
    hourFormat: '24',
  },
}

/**
 * Fantasy calendar with multiple parallel cycles
 */
const MULTI_CYCLE_CALENDAR: CalendarConfig = {
  id: 'multi-cycle',
  name: 'Multi-Cycle Calendar',
  description: 'Fantasy calendar with multiple cycles',
  minutesPerHour: 60,
  hoursPerDay: 24,
  minutesPerDay: 1440,
  daysPerYear: 360,
  minutesPerYear: 518400,
  subdivisions: [
    {
      id: 'month',
      name: 'Month',
      pluralName: 'Months',
      count: 12,
      daysPerUnitFixed: 30,
      labelFormat: 'Month {n}',
    },
    {
      id: 'week',
      name: 'Week',
      pluralName: 'Weeks',
      count: 7,
      isCycle: true,
      epochStartsOnUnit: 0,
      labels: ['Moonday', 'Fireday', 'Waterday', 'Earthday', 'Airday', 'Lightday', 'Darkday'],
    },
    {
      id: 'glimrong',
      name: 'Glimrong',
      pluralName: 'Glimrongs',
      count: 5,
      isCycle: true,
      epochStartsOnUnit: 2,
      labels: ['Glow', 'Spark', 'Flame', 'Ember', 'Ash'],
    },
  ],
  eras: { positive: 'AE', negative: 'BE' },
  display: {
    defaultFormat: '<%= week %> / <%= glimrong %>, <%= month %> Day <%= dayOfMonth %>',
    shortFormat: '<%= month %> Day <%= dayOfMonth %>',
    includeTimeByDefault: false,
    hourFormat: '24',
  },
}

// ============================================================================
// Phase 1: Cycle Subdivision Tests
// ============================================================================

describe('CalendarEngine - Cycle Subdivisions', () => {
  describe('getCyclePosition()', () => {
    it('returns null for calendars without cycles', () => {
      const engine = new CalendarEngine(SIMPLE_CALENDAR)
      const date = engine.storyTimeToDate(0)
      expect(engine.getCyclePosition(date, 'week')).toBeNull()
    })

    it('returns epochStartsOnUnit for day 1 of year 0', () => {
      const engine = new CalendarEngine(WEEK_CYCLE_CALENDAR)
      const date = engine.storyTimeToDate(0) // Day 1, Year 0
      const pos = engine.getCyclePosition(date, 'week')
      expect(pos).not.toBeNull()
      expect(pos!.index).toBe(0) // Sunday
      expect(pos!.name).toBe('Sunday')
    })

    it('returns epochStartsOnUnit for day 1 of year 0 (Monday start)', () => {
      const engine = new CalendarEngine(MONDAY_START_CALENDAR)
      const date = engine.storyTimeToDate(0) // Day 1, Year 0
      const pos = engine.getCyclePosition(date, 'week')
      expect(pos).not.toBeNull()
      expect(pos!.index).toBe(1) // Monday
      expect(pos!.name).toBe('Monday')
    })

    it('wraps around correctly after cycle length days', () => {
      const engine = new CalendarEngine(WEEK_CYCLE_CALENDAR)
      // Day 8 of Year 0 should be same as day 1
      const date = engine.storyTimeToDate(7 * 1440)
      const pos = engine.getCyclePosition(date, 'week')
      expect(pos!.index).toBe(0) // Sunday again
      expect(pos!.name).toBe('Sunday')
    })

    it('calculates day 2 correctly', () => {
      const engine = new CalendarEngine(WEEK_CYCLE_CALENDAR)
      const date = engine.storyTimeToDate(1 * 1440) // 1 day later
      const pos = engine.getCyclePosition(date, 'week')
      expect(pos!.index).toBe(1) // Monday
      expect(pos!.name).toBe('Monday')
    })

    it('calculates Saturday correctly (day 7)', () => {
      const engine = new CalendarEngine(WEEK_CYCLE_CALENDAR)
      const date = engine.storyTimeToDate(6 * 1440) // 6 days later
      const pos = engine.getCyclePosition(date, 'week')
      expect(pos!.index).toBe(6) // Saturday
      expect(pos!.name).toBe('Saturday')
    })

    it('works correctly for year 1', () => {
      const engine = new CalendarEngine(WEEK_CYCLE_CALENDAR)
      // Year 1, Day 1 should be 365 days after Year 0 Day 1
      // 365 % 7 = 1, so it should be Monday (index 1)
      const date = engine.storyTimeToDate(365 * 1440)
      const pos = engine.getCyclePosition(date, 'week')
      expect(pos!.index).toBe(1) // Monday
      expect(pos!.name).toBe('Monday')
    })

    it('works correctly for negative years (BBY/BCE)', () => {
      const engine = new CalendarEngine(WEEK_CYCLE_CALENDAR)
      // Year -1, Day 1 is 365 days before Year 0 Day 1
      // Going back 365 days from Sunday: 365 mod 7 = 1
      // So Day 1 of Year -1 is Saturday
      const date = engine.storyTimeToDate(-365 * 1440)
      const pos = engine.getCyclePosition(date, 'week')
      expect(pos!.index).toBe(6) // Saturday
      expect(pos!.name).toBe('Saturday')
    })

    it('works with different cycle lengths (6-day week)', () => {
      const sixDayCalendar: CalendarConfig = {
        ...SIMPLE_CALENDAR,
        subdivisions: [
          {
            id: 'hexweek',
            name: 'Hexweek',
            pluralName: 'Hexweeks',
            count: 6,
            isCycle: true,
            epochStartsOnUnit: 0,
            labels: ['Primeday', 'Duoday', 'Triday', 'Quadday', 'Pentday', 'Hexday'],
          },
        ],
      }
      const engine = new CalendarEngine(sixDayCalendar)

      // Day 1 should be Primeday
      const day1 = engine.storyTimeToDate(0)
      expect(engine.getCyclePosition(day1, 'hexweek')!.name).toBe('Primeday')

      // Day 7 should be Primeday again (6-day cycle)
      const day7 = engine.storyTimeToDate(6 * 1440)
      expect(engine.getCyclePosition(day7, 'hexweek')!.name).toBe('Primeday')

      // Day 6 should be Hexday
      const day6 = engine.storyTimeToDate(5 * 1440)
      expect(engine.getCyclePosition(day6, 'hexweek')!.name).toBe('Hexday')
    })
  })

  describe('multiple cycles', () => {
    it('tracks multiple independent cycles', () => {
      const engine = new CalendarEngine(MULTI_CYCLE_CALENDAR)

      // Day 1: week=Moonday (0), glimrong=Flame (2 - epochStartsOnUnit)
      const day1 = engine.storyTimeToDate(0)
      expect(engine.getCyclePosition(day1, 'week')!.name).toBe('Moonday')
      expect(engine.getCyclePosition(day1, 'glimrong')!.name).toBe('Flame')

      // Day 8: week=Moonday (7%7=0), glimrong=((7+2)%5)=4=Ash
      const day8 = engine.storyTimeToDate(7 * 1440)
      expect(engine.getCyclePosition(day8, 'week')!.name).toBe('Moonday')
      expect(engine.getCyclePosition(day8, 'glimrong')!.name).toBe('Ash')

      // Day 36: both cycles should align on their starting positions again
      // LCM(7,5) = 35, so day 36 should be day 1 again
      const day36 = engine.storyTimeToDate(35 * 1440)
      expect(engine.getCyclePosition(day36, 'week')!.name).toBe('Moonday')
      expect(engine.getCyclePosition(day36, 'glimrong')!.name).toBe('Flame')
    })

    it('formats with multiple cycle values', () => {
      const engine = new CalendarEngine(MULTI_CYCLE_CALENDAR)
      const date = engine.storyTimeToDate(0)
      const formatted = engine.formatDate(date, true)
      expect(formatted).toBe('Moonday / Flame, Month 1 Day 1')
    })
  })
})

// ============================================================================
// Phase 2: Fixed Holiday Rules Tests
// ============================================================================

describe('CalendarEngine - Fixed Holiday Rules', () => {
  describe('getHoliday()', () => {
    it('returns null when no holidays defined', () => {
      const engine = new CalendarEngine(GREGORIAN_TEST_CALENDAR)
      const date = engine.storyTimeToDate(0)
      expect(engine.getHoliday(date)).toBeNull()
    })

    it('matches fixed holiday on correct day (Christmas - Dec 25)', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        holidays: [
          { type: 'fixed', name: 'Christmas', subdivisionId: 'month', unit: 12, day: 25 },
        ],
      }
      const engine = new CalendarEngine(calendar)
      // Dec 25 = day 359 (31+28+31+30+31+30+31+31+30+31+30+25 = 359)
      const dec25 = engine.storyTimeToDate(358 * 1440) // 0-indexed from day 1
      expect(engine.getHoliday(dec25)).toBe('Christmas')
    })

    it('does not match fixed holiday on wrong day (Dec 24)', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        holidays: [
          { type: 'fixed', name: 'Christmas', subdivisionId: 'month', unit: 12, day: 25 },
        ],
      }
      const engine = new CalendarEngine(calendar)
      const dec24 = engine.storyTimeToDate(357 * 1440) // Dec 24
      expect(engine.getHoliday(dec24)).toBeNull()
    })

    it('does not match fixed holiday on wrong day (Dec 26)', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        holidays: [
          { type: 'fixed', name: 'Christmas', subdivisionId: 'month', unit: 12, day: 25 },
        ],
      }
      const engine = new CalendarEngine(calendar)
      const dec26 = engine.storyTimeToDate(359 * 1440) // Dec 26
      expect(engine.getHoliday(dec26)).toBeNull()
    })

    it('matches multiple fixed holidays', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        holidays: [
          { type: 'fixed', name: "New Year's Day", subdivisionId: 'month', unit: 1, day: 1 },
          { type: 'fixed', name: 'Christmas', subdivisionId: 'month', unit: 12, day: 25 },
        ],
      }
      const engine = new CalendarEngine(calendar)

      const jan1 = engine.storyTimeToDate(0) // Jan 1
      expect(engine.getHoliday(jan1)).toBe("New Year's Day")

      const dec25 = engine.storyTimeToDate(358 * 1440) // Dec 25
      expect(engine.getHoliday(dec25)).toBe('Christmas')
    })

    it('first matching holiday wins when duplicates exist', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        holidays: [
          { type: 'fixed', name: 'Priority Holiday', subdivisionId: 'month', unit: 12, day: 25 },
          { type: 'fixed', name: 'Christmas', subdivisionId: 'month', unit: 12, day: 25 },
        ],
      }
      const engine = new CalendarEngine(calendar)
      const dec25 = engine.storyTimeToDate(358 * 1440)
      expect(engine.getHoliday(dec25)).toBe('Priority Holiday')
    })
  })
})

// ============================================================================
// Phase 3: Nth Cycle Day Holiday Tests
// ============================================================================

describe('CalendarEngine - Nth Cycle Day Holidays', () => {
  describe('getHoliday() with nthCycleDay rules', () => {
    it('matches 4th Thursday of November (Thanksgiving)', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        holidays: [
          { type: 'nthCycleDay', name: 'Thanksgiving', n: 4, cycleId: 'week', dayInCycle: 4, subdivisionId: 'month', unit: 11 },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // November starts on day 305 (31+28+31+30+31+30+31+31+30+31 = 304, so Nov 1 = day 305)
      // In our test calendar, Jan 1 Year 0 is Monday (epochStartsOnUnit: 1)
      // totalDaysFromEpoch = 0 * 365 + 305 - 1 = 304
      // cyclePosition = (304 + 1) % 7 = 305 % 7 = 4 = Thursday
      //
      // So Nov 1 is Thursday! Thursdays in November:
      // Nov 1 (day 305): 1st Thursday
      // Nov 8 (day 312): 2nd Thursday
      // Nov 15 (day 319): 3rd Thursday
      // Nov 22 (day 326): 4th Thursday

      const thanksgiving = engine.storyTimeToDate(325 * 1440) // Day 326 (Nov 22)
      expect(engine.getHoliday(thanksgiving)).toBe('Thanksgiving')
    })

    it('matches 1st Monday of January', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        holidays: [
          { type: 'nthCycleDay', name: 'First Monday', n: 1, cycleId: 'week', dayInCycle: 1, subdivisionId: 'month', unit: 1 },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // Jan 1 is Monday (epochStartsOnUnit: 1), so 1st Monday of January is Jan 1
      const jan1 = engine.storyTimeToDate(0)
      expect(engine.getHoliday(jan1)).toBe('First Monday')
    })

    it('returns null when nth cycle day does not exist (5th Friday of February)', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        holidays: [
          { type: 'nthCycleDay', name: '5th Friday', n: 5, cycleId: 'week', dayInCycle: 5, subdivisionId: 'month', unit: 2 },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // February has 28 days, can have at most 4 of any weekday
      // This rule should never match
      // Check every day of February
      for (let day = 32; day <= 59; day++) { // Feb 1 = day 32, Feb 28 = day 59
        const date = engine.storyTimeToDate((day - 1) * 1440)
        expect(engine.getHoliday(date)).toBeNull()
      }
    })

    it('returns null when cycle does not exist', () => {
      const calendar: CalendarConfig = {
        ...SIMPLE_CALENDAR, // No cycles
        holidays: [
          { type: 'nthCycleDay', name: 'Thanksgiving', n: 4, cycleId: 'week', dayInCycle: 4, subdivisionId: 'month', unit: 11 },
        ],
      }
      const engine = new CalendarEngine(calendar)
      const anyDay = engine.storyTimeToDate(326 * 1440)
      expect(engine.getHoliday(anyDay)).toBeNull()
    })
  })
})

// ============================================================================
// Phase 4: Last Cycle Day/Last Day Holiday Tests
// ============================================================================

describe('CalendarEngine - Last Cycle Day/Last Day Holidays', () => {
  describe('getHoliday() with lastCycleDay rules', () => {
    it('matches last Monday of May (Memorial Day)', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        holidays: [
          { type: 'lastCycleDay', name: 'Memorial Day', cycleId: 'week', dayInCycle: 1, subdivisionId: 'month', unit: 5 },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // May is days 121-151 (31+28+31+30 = 120, so May 1 = day 121)
      // May 31 = day 151
      // Day 151: (150 + 1) % 7 = 151 % 7 = 4 = Thursday
      // So May 31 is Thursday, May 30 is Wednesday, May 29 is Tuesday, May 28 is Monday
      // Last Monday of May is May 28 = day 148
      const memorialDay = engine.storyTimeToDate(147 * 1440) // Day 148 (0-indexed: 147)
      expect(engine.getHoliday(memorialDay)).toBe('Memorial Day')
    })

    it('returns null when cycle does not exist', () => {
      const calendar: CalendarConfig = {
        ...SIMPLE_CALENDAR, // No cycles
        holidays: [
          { type: 'lastCycleDay', name: 'Memorial Day', cycleId: 'week', dayInCycle: 1, subdivisionId: 'month', unit: 5 },
        ],
      }
      const engine = new CalendarEngine(calendar)
      const anyDay = engine.storyTimeToDate(147 * 1440)
      expect(engine.getHoliday(anyDay)).toBeNull()
    })
  })

  describe('getHoliday() with lastDay rules', () => {
    it('matches last day of month (New Years Eve - Dec 31)', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        holidays: [
          { type: 'lastDay', name: "New Year's Eve", subdivisionId: 'month', unit: 12 },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // Dec 31 = day 365
      const dec31 = engine.storyTimeToDate(364 * 1440) // Day 365 (0-indexed: 364)
      expect(engine.getHoliday(dec31)).toBe("New Year's Eve")
    })

    it('matches last day of February (day 59)', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        holidays: [
          { type: 'lastDay', name: 'End of February', subdivisionId: 'month', unit: 2 },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // Feb 28 = day 59 (31 + 28)
      const feb28 = engine.storyTimeToDate(58 * 1440) // Day 59 (0-indexed: 58)
      expect(engine.getHoliday(feb28)).toBe('End of February')
    })

    it('works with quarter subdivisions', () => {
      const quarterCalendar: CalendarConfig = {
        id: 'quarter-test',
        name: 'Quarter Calendar',
        description: 'For testing',
        minutesPerHour: 60,
        hoursPerDay: 24,
        minutesPerDay: 1440,
        daysPerYear: 368, // Coruscant-like
        minutesPerYear: 529920,
        subdivisions: [
          {
            id: 'quarter',
            name: 'Quarter',
            pluralName: 'Quarters',
            count: 4,
            daysPerUnitFixed: 92,
          },
        ],
        eras: { positive: 'ABY', negative: 'BBY' },
        display: {
          defaultFormat: '<%= quarter %> Day <%= dayOfQuarter %>, <%= year %> <%= era %>',
          shortFormat: '<%= quarter %> Day <%= dayOfQuarter %>, <%= year %> <%= era %>',
          includeTimeByDefault: false,
          hourFormat: '24',
        },
        holidays: [
          { type: 'lastDay', name: 'Festival Day', subdivisionId: 'quarter', unit: 1 },
          { type: 'lastDay', name: 'Festival Day', subdivisionId: 'quarter', unit: 2 },
          { type: 'lastDay', name: 'Festival Day', subdivisionId: 'quarter', unit: 3 },
          { type: 'lastDay', name: 'Festival Day', subdivisionId: 'quarter', unit: 4 },
        ],
      }
      const engine = new CalendarEngine(quarterCalendar)

      // Q1 day 92, Q2 day 184, Q3 day 276, Q4 day 368
      expect(engine.getHoliday(engine.storyTimeToDate(91 * 1440))).toBe('Festival Day') // Day 92
      expect(engine.getHoliday(engine.storyTimeToDate(183 * 1440))).toBe('Festival Day') // Day 184
      expect(engine.getHoliday(engine.storyTimeToDate(275 * 1440))).toBe('Festival Day') // Day 276
      expect(engine.getHoliday(engine.storyTimeToDate(367 * 1440))).toBe('Festival Day') // Day 368
    })
  })
})

// ============================================================================
// Phase 4b: Computed Holidays and Offset From Holiday Tests
// ============================================================================

describe('CalendarEngine - Computed Holidays', () => {
  /**
   * Medieval-like calendar with months, 7-day week, and 29-day lunar cycle
   */
  const MEDIEVAL_CALENDAR: CalendarConfig = {
    id: 'medieval',
    name: 'Medieval Calendar',
    description: 'With lunar cycle for Easter calculation',
    minutesPerHour: 60,
    hoursPerDay: 24,
    minutesPerDay: 1440,
    daysPerYear: 365,
    minutesPerYear: 525600,
    subdivisions: [
      {
        id: 'month',
        name: 'Month',
        pluralName: 'Months',
        count: 12,
        daysPerUnit: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
        labels: ['January', 'February', 'March', 'April', 'May', 'June',
                 'July', 'August', 'September', 'October', 'November', 'December'],
      },
      {
        id: 'week',
        name: 'Week',
        pluralName: 'Weeks',
        count: 7,
        isCycle: true,
        epochStartsOnUnit: 1, // Monday
        labels: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      },
      {
        id: 'lunar',
        name: 'Lunar Phase',
        pluralName: 'Lunar Phases',
        count: 29,
        isCycle: true,
        epochStartsOnUnit: 0, // New moon on day 1 of year 0
        labels: Array.from({ length: 29 }, (_, i) => `Day ${i + 1}`),
      },
    ],
    eras: { positive: 'AD', negative: 'BC' },
    display: {
      defaultFormat: '<%= month %> <%= dayOfMonth %>, <%= year %> <%= era %>',
      shortFormat: '<%= month %> <%= dayOfMonth %>, <%= year %> <%= era %>',
      includeTimeByDefault: false,
      hourFormat: '24',
    },
  }

  describe('computed holiday with findInCycle', () => {
    it('finds first Monday on or after Jan 1', () => {
      const calendar: CalendarConfig = {
        ...MEDIEVAL_CALENDAR,
        holidays: [
          {
            type: 'computed',
            name: 'First Monday',
            steps: [
              { type: 'fixed', subdivisionId: 'month', unit: 1, day: 1 },
              { type: 'findInCycle', cycleId: 'week', dayInCycle: 1, direction: 'onOrAfter' }, // Monday = 1
            ],
          },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // Day 1 is Monday (epochStartsOnUnit: 1), so first Monday should be day 1
      const jan1 = engine.storyTimeToDate(0)
      expect(engine.getHoliday(jan1)).toBe('First Monday')
    })

    it('finds first Sunday on or after Jan 1 (when Jan 1 is Monday)', () => {
      const calendar: CalendarConfig = {
        ...MEDIEVAL_CALENDAR,
        holidays: [
          {
            type: 'computed',
            name: 'First Sunday',
            steps: [
              { type: 'fixed', subdivisionId: 'month', unit: 1, day: 1 },
              { type: 'findInCycle', cycleId: 'week', dayInCycle: 0, direction: 'onOrAfter' }, // Sunday = 0
            ],
          },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // Day 1 is Monday, so first Sunday should be day 7
      const day7 = engine.storyTimeToDate(6 * 1440) // Day 7
      expect(engine.getHoliday(day7)).toBe('First Sunday')
    })

    it('calculates Easter using lunar and week cycles', () => {
      // Easter = first Sunday after first full moon (day 15 of lunar) on or after March 21
      const calendar: CalendarConfig = {
        ...MEDIEVAL_CALENDAR,
        holidays: [
          {
            type: 'computed',
            name: 'Easter',
            steps: [
              { type: 'fixed', subdivisionId: 'month', unit: 3, day: 21 }, // March 21 = day 80
              { type: 'findInCycle', cycleId: 'lunar', dayInCycle: 14, direction: 'onOrAfter' }, // Full moon (day 15 = index 14)
              { type: 'findInCycle', cycleId: 'week', dayInCycle: 0, direction: 'onOrAfter' }, // Sunday
            ],
          },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // March 21 = day 80 (31 + 28 + 21 = 80)
      // Need to find what day has lunar cycle position 14
      // Then find the next Sunday on or after that

      // Let's compute: day 80 has lunar position (80-1 + 0) % 29 = 79 % 29 = 21
      // We need lunar position 14, so we need to go forward by (14 - 21 + 29) % 29 = 22 days
      // Day 80 + 22 = day 102 has lunar position 14 (full moon)
      // Day 102: week position (102-1 + 1) % 7 = 102 % 7 = 4 (Thursday)
      // First Sunday after day 102 is day 102 + 3 = 105

      const day105 = engine.storyTimeToDate(104 * 1440) // Day 105
      expect(engine.getHoliday(day105)).toBe('Easter')
    })
  })

  describe('offsetFromHoliday', () => {
    it('calculates Pentecost as Easter + 49 days', () => {
      const calendar: CalendarConfig = {
        ...MEDIEVAL_CALENDAR,
        holidays: [
          {
            type: 'computed',
            name: 'Easter',
            steps: [
              { type: 'fixed', subdivisionId: 'month', unit: 3, day: 21 },
              { type: 'findInCycle', cycleId: 'lunar', dayInCycle: 14, direction: 'onOrAfter' },
              { type: 'findInCycle', cycleId: 'week', dayInCycle: 0, direction: 'onOrAfter' },
            ],
          },
          {
            type: 'offsetFromHoliday',
            name: 'Pentecost',
            baseHoliday: 'Easter',
            offsetDays: 49,
          },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // Easter is day 105 (from previous test)
      // Pentecost = 105 + 49 = day 154
      const day154 = engine.storyTimeToDate(153 * 1440) // Day 154
      expect(engine.getHoliday(day154)).toBe('Pentecost')
    })

    it('calculates Ash Wednesday as Easter - 46 days', () => {
      const calendar: CalendarConfig = {
        ...MEDIEVAL_CALENDAR,
        holidays: [
          {
            type: 'computed',
            name: 'Easter',
            steps: [
              { type: 'fixed', subdivisionId: 'month', unit: 3, day: 21 },
              { type: 'findInCycle', cycleId: 'lunar', dayInCycle: 14, direction: 'onOrAfter' },
              { type: 'findInCycle', cycleId: 'week', dayInCycle: 0, direction: 'onOrAfter' },
            ],
          },
          {
            type: 'offsetFromHoliday',
            name: 'Ash Wednesday',
            baseHoliday: 'Easter',
            offsetDays: -46,
          },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // Easter is day 105
      // Ash Wednesday = 105 - 46 = day 59
      const day59 = engine.storyTimeToDate(58 * 1440) // Day 59
      expect(engine.getHoliday(day59)).toBe('Ash Wednesday')
    })

    it('returns null when base holiday is not defined', () => {
      const calendar: CalendarConfig = {
        ...MEDIEVAL_CALENDAR,
        holidays: [
          {
            type: 'offsetFromHoliday',
            name: 'Pentecost',
            baseHoliday: 'Easter', // Easter not defined!
            offsetDays: 49,
          },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // Should not find Pentecost on any day since Easter is not defined
      const day154 = engine.storyTimeToDate(153 * 1440)
      expect(engine.getHoliday(day154)).toBeNull()
    })

    it('returns null when base holiday appears after dependent (ordering matters)', () => {
      const calendar: CalendarConfig = {
        ...MEDIEVAL_CALENDAR,
        holidays: [
          // Pentecost comes BEFORE Easter in the array - this is invalid
          {
            type: 'offsetFromHoliday',
            name: 'Pentecost',
            baseHoliday: 'Easter',
            offsetDays: 49,
          },
          {
            type: 'computed',
            name: 'Easter',
            steps: [
              { type: 'fixed', subdivisionId: 'month', unit: 3, day: 21 },
              { type: 'findInCycle', cycleId: 'lunar', dayInCycle: 14, direction: 'onOrAfter' },
              { type: 'findInCycle', cycleId: 'week', dayInCycle: 0, direction: 'onOrAfter' },
            ],
          },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // Pentecost should not be found because Easter hasn't been evaluated yet
      const day154 = engine.storyTimeToDate(153 * 1440)
      expect(engine.getHoliday(day154)).toBeNull()

      // Easter should still work
      const day105 = engine.storyTimeToDate(104 * 1440)
      expect(engine.getHoliday(day105)).toBe('Easter')
    })
  })

  describe('computed holiday with offset step', () => {
    it('uses offset step within pipeline', () => {
      const calendar: CalendarConfig = {
        ...MEDIEVAL_CALENDAR,
        holidays: [
          {
            type: 'computed',
            name: 'Week After New Year',
            steps: [
              { type: 'fixed', subdivisionId: 'month', unit: 1, day: 1 },
              { type: 'offset', days: 7 },
            ],
          },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // Day 1 + 7 = Day 8
      const day8 = engine.storyTimeToDate(7 * 1440)
      expect(engine.getHoliday(day8)).toBe('Week After New Year')
    })
  })

  describe('findInCycle with onOrBefore direction', () => {
    it('finds previous Sunday from a given date', () => {
      const calendar: CalendarConfig = {
        ...MEDIEVAL_CALENDAR,
        holidays: [
          {
            type: 'computed',
            name: 'Last Sunday Before March 1',
            steps: [
              { type: 'fixed', subdivisionId: 'month', unit: 3, day: 1 }, // March 1 = day 60
              { type: 'findInCycle', cycleId: 'week', dayInCycle: 0, direction: 'onOrBefore' }, // Sunday
            ],
          },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // March 1 = day 60
      // Day 60 week position: (60-1 + 1) % 7 = 60 % 7 = 4 (Thursday)
      // Previous Sunday: day 60 - 4 = day 56

      const day56 = engine.storyTimeToDate(55 * 1440) // Day 56
      expect(engine.getHoliday(day56)).toBe('Last Sunday Before March 1')
    })
  })
})

// ============================================================================
// Phase 5: EJS Format Integration Tests
// ============================================================================

describe('CalendarEngine - EJS Format Integration', () => {
  describe('formatDate() with EJS templates', () => {
    it('renders basic data with EJS syntax', () => {
      const engine = new CalendarEngine(GREGORIAN_TEST_CALENDAR)
      const date = engine.storyTimeToDate(0) // Jan 1, Year 0
      const result = engine.formatDate(date, false)
      expect(result).toBe('January 1, 0 CE')
    })

    it('renders conditional holiday formatting', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        display: {
          ...GREGORIAN_TEST_CALENDAR.display,
          defaultFormat: '<%= month %> <%= dayOfMonth %><% if (holiday) { %> (<%= holiday %>)<% } %>',
        },
        holidays: [
          { type: 'fixed', name: 'Christmas', subdivisionId: 'month', unit: 12, day: 25 },
        ],
      }
      const engine = new CalendarEngine(calendar)

      // Christmas day
      const dec25 = engine.storyTimeToDate(358 * 1440)
      expect(engine.formatDate(dec25, true)).toBe('December 25 (Christmas)')

      // Regular day
      const dec24 = engine.storyTimeToDate(357 * 1440)
      expect(engine.formatDate(dec24, true)).toBe('December 24')
    })

    it('renders cycle value when cycle is defined', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        display: {
          ...GREGORIAN_TEST_CALENDAR.display,
          defaultFormat: '<%= week %>, <%= month %> <%= dayOfMonth %>',
        },
      }
      const engine = new CalendarEngine(calendar)

      // Jan 1, Year 0 is Monday
      const jan1 = engine.storyTimeToDate(0)
      expect(engine.formatDate(jan1, true)).toBe('Monday, January 1')
    })

    it('handles missing cycle gracefully in templates', () => {
      const calendar: CalendarConfig = {
        ...SIMPLE_CALENDAR, // No cycles
        display: {
          ...SIMPLE_CALENDAR.display,
          defaultFormat: 'Day <%= dayOfYear %>',
        },
      }
      const engine = new CalendarEngine(calendar)

      const jan1 = engine.storyTimeToDate(0)
      expect(engine.formatDate(jan1, true)).toBe('Day 1')
    })

    it('handles template errors gracefully', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        display: {
          ...GREGORIAN_TEST_CALENDAR.display,
          defaultFormat: '<%= nonexistent.property %>',
        },
      }
      const engine = new CalendarEngine(calendar)
      const date = engine.storyTimeToDate(0)

      // Should not throw, but return an error message
      const result = engine.formatDate(date, true)
      expect(result).toContain('error')
    })

    it('provides correct numeric values for subdivisions', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        display: {
          ...GREGORIAN_TEST_CALENDAR.display,
          defaultFormat: 'Month #<%= monthNumber %>, Day <%= dayOfMonth %>',
        },
      }
      const engine = new CalendarEngine(calendar)

      // March 15 = day 74 (31 + 28 + 15)
      const mar15 = engine.storyTimeToDate(73 * 1440)
      expect(engine.formatDate(mar15, true)).toBe('Month #3, Day 15')
    })

    it('provides zero-padded hour and minute', () => {
      const calendar: CalendarConfig = {
        ...GREGORIAN_TEST_CALENDAR,
        display: {
          ...GREGORIAN_TEST_CALENDAR.display,
          defaultFormat: '<%= hour %>:<%= minute %>',
        },
      }
      const engine = new CalendarEngine(calendar)

      // 9:05 AM on day 1
      const time = 9 * 60 + 5
      const date = engine.storyTimeToDate(time)
      expect(engine.formatDate(date, true)).toBe('09:05')
    })
  })
})
