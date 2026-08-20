import { describe, expect, it } from 'vitest'
import { buildAdventureTitleMessages, cleanAdventureTitle } from '../utils/adventureTitle'

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
