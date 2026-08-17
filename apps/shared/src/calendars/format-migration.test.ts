import { describe, expect, it } from 'vitest'
import { normalizeCalendarConfigFormats } from './format-migration.js'
import type { CalendarConfig } from './types.js'

const calendar: CalendarConfig = {
  id: 'legacy-calendar',
  name: 'Legacy calendar',
  description: '',
  minutesPerHour: 60,
  hoursPerDay: 24,
  minutesPerDay: 1440,
  daysPerYear: 365,
  minutesPerYear: 525600,
  subdivisions: [],
  eras: { positive: 'CE', negative: 'BCE' },
  display: {
    defaultFormat: '{dayLabel}, {quarter} (Q{quarterNumber}), {year} {era} at {hour}:{minute}',
    shortFormat: '{quarter} {year}',
    includeTimeByDefault: true,
    hourFormat: '24',
  },
}

describe('normalizeCalendarConfigFormats', () => {
  it('migrates legacy placeholders in both display formats without mutating the loaded config', () => {
    const normalized = normalizeCalendarConfigFormats(calendar)

    expect(normalized).toEqual({
      ...calendar,
      display: {
        ...calendar.display,
        defaultFormat:
          '<%= dayLabel %>, <%= quarter %> (Q<%= quarterNumber %>), <%= year %> <%= era %> at <%= hour %>:<%= minute %>',
        shortFormat: '<%= quarter %> <%= year %>',
      },
    })
    expect(normalized).not.toBe(calendar)
    expect(normalized.display).not.toBe(calendar.display)
    expect(calendar.display.defaultFormat).toBe('{dayLabel}, {quarter} (Q{quarterNumber}), {year} {era} at {hour}:{minute}')
  })

  it('preserves current EJS templates by reference', () => {
    const current = {
      ...calendar,
      display: {
        ...calendar.display,
        defaultFormat: '<% if (holiday) { %><%= holiday %><% } %>',
        shortFormat: '<%= year %> <%= era %>',
      },
    }

    expect(normalizeCalendarConfigFormats(current)).toBe(current)
  })
})
