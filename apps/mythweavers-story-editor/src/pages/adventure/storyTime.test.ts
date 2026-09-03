import { describe, expect, it } from 'vitest'
import type { AdventureTurn } from '../../hooks/useAdventurePersistence'
import {
  formatStoryDuration,
  formatStoryTimeLabel,
  latestStoryTime,
  parseStoryTimeJson,
  parseStoryTimeResult,
  previousStoryTime,
} from './storyTime'

describe('story time values', () => {
  it('preserves setting-specific time and validates duration', () => {
    expect(
      parseStoryTimeResult({ current_time: 'Third Bell, Frostwane 12', duration_amount: 15, duration_unit: 'minutes' }),
    ).toEqual({
      currentTime: 'Third Bell, Frostwane 12',
      duration: { amount: 15, unit: 'minutes' },
    })
  })

  it('accepts zero-duration simultaneous beats', () => {
    expect(
      parseStoryTimeResult({ current_time: 'Dusk', duration_amount: 0, duration_unit: 'seconds' }).duration.amount,
    ).toBe(0)
  })

  it.each([
    [{ current_time: '', duration_amount: 1, duration_unit: 'minutes' }],
    [{ current_time: 'Noon', duration_amount: -1, duration_unit: 'minutes' }],
    [{ current_time: 'Noon', duration_amount: 1.5, duration_unit: 'minutes' }],
    [{ current_time: 'Noon', duration_amount: 1, duration_unit: 'fortnights' }],
  ])('rejects malformed values', (value) => expect(() => parseStoryTimeResult(value)).toThrow())

  it('extracts strict JSON with markdown fences', () => {
    expect(
      parseStoryTimeJson('```json\n{"current_time":"Moonrise","duration_amount":2,"duration_unit":"hours"}\n```'),
    ).toMatchObject({
      currentTime: 'Moonrise',
      duration: { amount: 2, unit: 'hours' },
    })
  })

  it('formats singular and plural durations', () => {
    expect(formatStoryDuration({ currentTime: 'Noon', duration: { amount: 1, unit: 'hours' } })).toBe('1 hour')
    expect(formatStoryTimeLabel({ currentTime: 'Noon', duration: { amount: 2, unit: 'hours' } })).toBe(
      'Noon · +2 hours',
    )
  })
})

describe('story time context', () => {
  it('uses the latest known time without returning prior prose', () => {
    const turns: AdventureTurn[] = [
      {
        playerAction: null,
        narrative: 'Opening.',
        storyTime: { currentTime: 'Dawn', duration: { amount: 5, unit: 'minutes' } },
      },
      { playerAction: 'Wait.', narrative: 'You wait.' },
      { playerAction: 'Continue.', narrative: 'You leave.' },
    ]
    expect(previousStoryTime(turns, 2)).toBe('Dawn')
  })

  it('latestStoryTime walks back to the newest estimated time', () => {
    const turns: AdventureTurn[] = [
      {
        playerAction: null,
        narrative: 'Opening.',
        storyTime: { currentTime: 'Dawn', duration: { amount: 5, unit: 'minutes' } },
      },
      { playerAction: 'Wait.', narrative: 'You wait.' },
      {
        playerAction: 'Continue.',
        narrative: 'You leave.',
        storyTime: { currentTime: 'Noon', duration: { amount: 3, unit: 'hours' } },
      },
      { playerAction: 'Run.', narrative: 'You sprint.' },
    ]
    expect(latestStoryTime(turns)).toBe('Noon')
  })

  it('latestStoryTime is undefined when no turn has an estimated time', () => {
    expect(latestStoryTime([{ playerAction: null, narrative: 'Opening.' }])).toBeUndefined()
    expect(latestStoryTime([])).toBeUndefined()
  })
})
