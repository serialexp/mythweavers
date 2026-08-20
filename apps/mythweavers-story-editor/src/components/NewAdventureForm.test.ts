import { describe, expect, it } from 'vitest'
import { buildAdventureTitleMessages, cleanAdventureTitle } from '../utils/adventureTitle'
import { reusableSettingLabel } from '../utils/reusableSettingLabel'

describe('adventure title generation', () => {
  it('includes the world setting and opening prompt as distinct inputs', () => {
    const messages = buildAdventureTitleMessages(
      'Floating cities barter sunlight above an endless storm.',
      'The engines fail during a midsummer treaty ceremony.',
    )

    expect(messages).toHaveLength(1)
    expect(messages[0].content).toContain('WORLD SETTING:\nFloating cities barter sunlight')
    expect(messages[0].content).toContain('ADVENTURE START:\nThe engines fail during a midsummer treaty')
    expect(messages[0].content).toContain('2-5 words')
  })

  it('cleans common model formatting from a generated title', () => {
    expect(cleanAdventureTitle('<think>consider options</think>\nTitle: "The Fallen Accord"')).toBe('The Fallen Accord')
  })

  it('bounds titles to the backend name limit used by the form', () => {
    expect(cleanAdventureTitle('x'.repeat(100))).toHaveLength(60)
  })
})

describe('reusable setting labels', () => {
  it('shows only the existing adventure title when one exists', () => {
    expect(reusableSettingLabel({ name: 'The Fallen Accord', settingPreview: 'A very long first message.' })).toBe(
      'The Fallen Accord',
    )
  })

  it('falls back to at most 30 characters of the concept for an untitled adventure', () => {
    const label = reusableSettingLabel({
      name: 'Untitled Adventure',
      settingPreview: 'A brass city at the edge of endless night.',
    })
    expect(label).toBe('A brass city at the edge of…')
    expect(label.length).toBeLessThanOrEqual(30)
  })
})
