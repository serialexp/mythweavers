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
