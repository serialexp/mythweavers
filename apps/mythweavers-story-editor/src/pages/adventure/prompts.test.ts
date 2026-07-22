import { describe, expect, it } from 'vitest'
import {
  buildConditionsMessages,
  CONDITIONS_SYSTEM_PROMPT,
  paragraphRangeForAction,
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

describe('paragraphRangeForAction', () => {
  it('returns the default 2-4 range for no action', () => {
    expect(paragraphRangeForAction(null)).toEqual({ min: 2, max: 4 })
    expect(paragraphRangeForAction(undefined)).toEqual({ min: 2, max: 4 })
    expect(paragraphRangeForAction('')).toEqual({ min: 2, max: 4 })
  })

  it('returns the default 2-4 range for short actions', () => {
    expect(paragraphRangeForAction('I open the door.')).toEqual({ min: 2, max: 4 })
    expect(
      paragraphRangeForAction('I ask her about the letter. If she refuses, I press harder.'),
    ).toEqual({ min: 2, max: 4 })
    expect(
      paragraphRangeForAction('I look around. I pocket the key. I leave quietly.'),
    ).toEqual({ min: 2, max: 4 })
  })

  it('scales up for multi-sentence actions', () => {
    const fiveSentences =
      'I stand up. I walk over to the captain. I ask him about the missing crew. If he lies, I call him out. Then I search his cabin.'
    expect(paragraphRangeForAction(fiveSentences)).toEqual({ min: 4, max: 6 })
  })

  it('counts quoted dialogue as sentences', () => {
    const withDialogue = 'I turn to her. I say "Tell me where the letter is. Now." Then I wait.'
    // 4 sentences total ("Tell me where the letter is." + "Now." count) → 3-5
    expect(paragraphRangeForAction(withDialogue)).toEqual({ min: 3, max: 5 })
  })

  it('treats newlines as sentence breaks', () => {
    const multiline = 'I stand up.\nI walk to the door.\nI open it.\nI step through.'
    expect(paragraphRangeForAction(multiline)).toEqual({ min: 3, max: 5 })
  })

  it('caps the range at 8-10 for very long actions', () => {
    const long = Array.from({ length: 20 }, (_, i) => `Sentence ${i + 1}.`).join(' ')
    expect(paragraphRangeForAction(long)).toEqual({ min: 8, max: 10 })
  })

  it('counts a sentence fragment with no terminator as one sentence', () => {
    expect(paragraphRangeForAction('I open the door')).toEqual({ min: 2, max: 4 })
  })
})
