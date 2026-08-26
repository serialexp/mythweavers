import { afterEach, describe, expect, it } from 'vitest'
import type { PersistedState } from '../hooks/useAdventurePersistence'
import { adventureStore } from './adventureStore'

const baseState: PersistedState = {
  phase: 'playing',
  settingInput: 'Persistent sky-city lore.',
  protagonistInput: '',
  settingDescription: 'The treaty ceremony is interrupted.',
  startPrompt: 'The treaty ceremony is interrupted.',
  turns: [],
}

afterEach(() => adventureStore.reset())

describe('adventure turn metadata persistence', () => {
  it('round-trips the conversation search count on generated turns', () => {
    adventureStore.initialize({
      ...baseState,
      turns: [
        {
          playerAction: 'I repeat the password.',
          narrative: 'The lock opens.',
          conversationSearchCount: 2,
        },
      ],
    })

    expect(adventureStore.buildSnapshot().turns[0].conversationSearchCount).toBe(2)
  })

  it('round-trips story time and invalidates a suffix', () => {
    const storyTime = { currentTime: 'Dusk', duration: { amount: 2, unit: 'hours' as const } }
    adventureStore.initialize({
      ...baseState,
      turns: [
        { playerAction: null, narrative: 'Opening.', storyTime },
        { playerAction: 'Wait.', narrative: 'You wait.', storyTime: { ...storyTime, currentTime: 'Night' } },
      ],
    })

    expect(adventureStore.buildSnapshot().turns[1].storyTime?.currentTime).toBe('Night')
    adventureStore.invalidateStoryTimeFrom(1)
    expect(adventureStore.turns[0].storyTime).toEqual(storyTime)
    expect(adventureStore.turns[1].storyTime).toBeUndefined()
  })

  it('drops timing with rewound turns', () => {
    adventureStore.initialize({
      ...baseState,
      turns: [
        {
          playerAction: null,
          narrative: 'Opening.',
          storyTime: { currentTime: 'Dawn', duration: { amount: 1, unit: 'minutes' } },
        },
        {
          playerAction: 'Wait.',
          narrative: 'You wait.',
          storyTime: { currentTime: 'Noon', duration: { amount: 6, unit: 'hours' } },
        },
      ],
    })
    adventureStore.rewindTo(0)
    expect(adventureStore.turns).toHaveLength(1)
    expect(adventureStore.turns[0].storyTime?.currentTime).toBe('Dawn')
  })
})

describe('adventure start prompt persistence', () => {
  it('round-trips the separate start prompt through snapshots', () => {
    adventureStore.initialize(baseState)
    expect(adventureStore.startPrompt).toBe('The treaty ceremony is interrupted.')
    expect(adventureStore.buildSnapshot().startPrompt).toBe('The treaty ceremony is interrupted.')
  })

  it('falls back to legacy settingDescription when startPrompt is absent', () => {
    const { startPrompt: _startPrompt, ...legacyState } = baseState
    adventureStore.initialize(legacyState)
    expect(adventureStore.startPrompt).toBe(legacyState.settingDescription)
  })

  it('keeps the legacy field synchronized when the opening is edited', () => {
    adventureStore.initialize(baseState)
    adventureStore.setStartPrompt('A different opening situation.')
    const snapshot = adventureStore.buildSnapshot()
    expect(snapshot.startPrompt).toBe('A different opening situation.')
    expect(snapshot.settingDescription).toBe('A different opening situation.')
  })
})
