import { describe, expect, it } from 'vitest'
import {
  buildConditionsMessages,
  CONDITIONS_SYSTEM_PROMPT,
} from './prompts'
import type { CharacterCard } from '../../hooks/useAdventurePersistence'

const protag = 'Maren, a young field medic with steady hands.'

const rosterChar: CharacterCard = {
  id: 'c1',
  name: 'Captain Voss',
  description: 'A weathered ship captain.',
  motive: 'Keep his crew alive',
  disposition: 'warmth',
}

const archivedChar: CharacterCard = {
  id: 'c2',
  name: 'Old Sal',
  description: 'A departed sailor.',
  motive: 'Rest',
  disposition: 'indifference',
  archived: true,
}

describe('buildConditionsMessages', () => {
  it('returns a system + user message pair', () => {
    const messages = buildConditionsMessages('some narrative', '', protag)
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('user')
  })

  it('uses the conditions system prompt verbatim', () => {
    const messages = buildConditionsMessages('narrative', '', protag)
    expect(messages[0].content).toBe(CONDITIONS_SYSTEM_PROMPT)
  })

  it('includes the protagonist, current ledger, and recent narrative', () => {
    const messages = buildConditionsMessages(
      'Maren takes a blade to the ribs.',
      '- Maren (protagonist): winded.',
      protag,
    )
    const user = messages[1].content
    expect(user).toContain('[PROTAGONIST')
    expect(user).toContain('Maren, a young field medic')
    expect(user).toContain('[CURRENT LEDGER')
    expect(user).toContain('- Maren (protagonist): winded.')
    expect(user).toContain('[MOST RECENT NARRATIVE]')
    expect(user).toContain('Maren takes a blade to the ribs.')
  })

  it('lists non-archived named characters from the live-world roster', () => {
    const messages = buildConditionsMessages('narrative', '', protag, {
      characters: { c1: rosterChar, c2: archivedChar },
    })
    const user = messages[1].content
    expect(user).toContain('Captain Voss')
    // Archived characters are deliberately excluded.
    expect(user).not.toContain('Old Sal')
  })

  it('falls back to a placeholder label when no protagonist is given', () => {
    const messages = buildConditionsMessages('narrative', '')
    expect(messages[1].content).toContain('no description on file')
  })

  it('signals an empty ledger as "none on file yet"', () => {
    const messages = buildConditionsMessages('narrative', '', protag)
    expect(messages[1].content).toContain('none on file yet')
  })

  it('includes a setting section when one is provided', () => {
    const messages = buildConditionsMessages('narrative', '', protag, undefined, {
      settingDescription: 'A storm-battered coastal town.',
    })
    expect(messages[1].content).toContain('[SETTING')
    expect(messages[1].content).toContain('storm-battered coastal town')
  })

  it('omits the setting section when none is provided', () => {
    const messages = buildConditionsMessages('narrative', '', protag)
    expect(messages[1].content).not.toContain('[SETTING')
  })

  it('ends with the output instruction', () => {
    const messages = buildConditionsMessages('narrative', '', protag)
    expect(messages[1].content).toContain('Output ONLY the ledger')
  })
})
