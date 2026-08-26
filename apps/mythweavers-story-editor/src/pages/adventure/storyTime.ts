import type { AdventureStoryDurationUnit, AdventureStoryTime, AdventureTurn } from '../../hooks/useAdventurePersistence'

const DURATION_UNITS = new Set<AdventureStoryDurationUnit>([
  'seconds',
  'minutes',
  'hours',
  'days',
  'weeks',
  'months',
  'years',
])
const MAX_DURATION_AMOUNT = 1_000_000_000

export function parseStoryTimeResult(value: unknown): AdventureStoryTime {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Story time result must be an object.')
  const record = value as Record<string, unknown>
  const currentTimeValue = record.current_time ?? record.currentTime
  const amountValue = record.duration_amount ?? (record.duration as Record<string, unknown> | undefined)?.amount
  const unitValue = record.duration_unit ?? (record.duration as Record<string, unknown> | undefined)?.unit

  if (typeof currentTimeValue !== 'string' || !currentTimeValue.trim()) {
    throw new Error('current_time must be a non-empty string.')
  }
  if (
    !Number.isSafeInteger(amountValue) ||
    (amountValue as number) < 0 ||
    (amountValue as number) > MAX_DURATION_AMOUNT
  ) {
    throw new Error(`duration_amount must be a non-negative safe integer no greater than ${MAX_DURATION_AMOUNT}.`)
  }
  if (typeof unitValue !== 'string' || !DURATION_UNITS.has(unitValue as AdventureStoryDurationUnit)) {
    throw new Error('duration_unit must be seconds, minutes, hours, days, weeks, months, or years.')
  }

  return {
    currentTime: currentTimeValue.trim(),
    duration: { amount: amountValue as number, unit: unitValue as AdventureStoryDurationUnit },
  }
}

export function parseStoryTimeJson(text: string): AdventureStoryTime {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('Story time response did not contain a JSON object.')
  return parseStoryTimeResult(JSON.parse(trimmed.slice(start, end + 1)))
}

export function previousStoryTime(turns: AdventureTurn[], targetIndex: number): string | undefined {
  for (let index = targetIndex - 1; index >= 0; index--) {
    const storyTime = turns[index].storyTime
    if (storyTime) return storyTime.currentTime
  }
  return undefined
}

export function formatStoryDuration(storyTime: AdventureStoryTime): string {
  const { amount, unit } = storyTime.duration
  const singular = unit.endsWith('s') ? unit.slice(0, -1) : unit
  return `${amount} ${amount === 1 ? singular : unit}`
}

export function formatStoryTimeLabel(storyTime: AdventureStoryTime): string {
  return `${storyTime.currentTime} · +${formatStoryDuration(storyTime)}`
}
