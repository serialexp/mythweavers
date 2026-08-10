import { describe, expect, it } from 'vitest'
import {
  buildConditionsMessages,
  buildSharedHistory,
  CONDITIONS_SYSTEM_PROMPT,
  formatLiveWorldState,
  paragraphRangeForAction,
} from './prompts'
import type {
  AdventureTurn,
  AgendaItem,
  CharacterCard,
  PlotPoint,
} from '../../hooks/useAdventurePersistence'

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

describe('formatLiveWorldState', () => {
  const activePoint: PlotPoint = {
    id: 'p1',
    title: 'The missing manifest',
    description: 'Someone tore a page out of the harbour ledger.',
    status: 'active',
  }

  const resolvedPoint: PlotPoint = {
    id: 'p2',
    title: 'The broken lamp',
    description: 'Already dealt with.',
    status: 'resolved',
  }

  const agendaItem: AgendaItem = {
    id: 'a1',
    description: 'The harbourmaster locks the gate',
    when: 'at dusk',
  }

  describe('full detail (default)', () => {
    it('renders motive and disposition alongside the description', () => {
      const block = formatLiveWorldState({ characters: { c1: rosterChar } })
      expect(block).toContain('motive: Keep his crew alive')
      expect(block).toContain('disposition: warmth')
      expect(block).toContain('A weathered ship captain.')
    })

    it('explains the disposition scale in the roster header', () => {
      const block = formatLiveWorldState({ characters: { c1: rosterChar } })
      expect(block).toContain('7-step scale')
    })

    it('prefixes ids only when asked, leaving the card text otherwise identical', () => {
      const state = { characters: { c1: rosterChar } }
      expect(formatLiveWorldState(state)).toContain(
        '- Captain Voss (motive: Keep his crew alive; disposition: warmth): A weathered ship captain.',
      )
      expect(formatLiveWorldState(state, { includeIds: true })).toContain(
        '- [id: c1] Captain Voss (motive: Keep his crew alive; disposition: warmth): A weathered ship captain.',
      )
    })

    it('treats an explicit "full" the same as the default', () => {
      const state = { characters: { c1: rosterChar } }
      expect(formatLiveWorldState({ ...state, characterDetail: 'full' })).toBe(
        formatLiveWorldState(state),
      )
    })
  })

  describe('description detail', () => {
    const descState = {
      characters: { c1: rosterChar },
      characterDetail: 'description' as const,
    }

    it('renders name and description only', () => {
      const block = formatLiveWorldState(descState)
      expect(block).toContain('- Captain Voss: A weathered ship captain.')
      expect(block).not.toContain('motive')
      expect(block).not.toContain('disposition')
    })

    it('drops the disposition-scale explanation from the roster header', () => {
      const block = formatLiveWorldState(descState)
      expect(block).toContain('[CHARACTER ROSTER')
      expect(block).not.toContain('7-step scale')
    })

    it('still prefixes ids when asked', () => {
      expect(formatLiveWorldState(descState, { includeIds: true })).toContain(
        '- [id: c1] Captain Voss: A weathered ship captain.',
      )
    })

    it('returns null for an empty roster, so nothing is injected at all', () => {
      expect(
        formatLiveWorldState({ characters: {}, characterDetail: 'description' }),
      ).toBeNull()
    })

    it('returns null when every character is archived', () => {
      expect(
        formatLiveWorldState({
          characters: { c2: archivedChar },
          characterDetail: 'description',
        }),
      ).toBeNull()
    })
  })

  it('excludes archived characters in both detail modes', () => {
    const characters = { c1: rosterChar, c2: archivedChar }
    for (const characterDetail of ['full', 'description'] as const) {
      const block = formatLiveWorldState({ characters, characterDetail })
      expect(block).toContain('Captain Voss')
      expect(block).not.toContain('Old Sal')
    }
  })

  it('excludes resolved plot points', () => {
    const block = formatLiveWorldState({
      plotPoints: { p1: activePoint, p2: resolvedPoint },
    })
    expect(block).toContain('The missing manifest')
    expect(block).not.toContain('The broken lamp')
  })

  it('returns null when there is nothing to show', () => {
    expect(formatLiveWorldState({})).toBeNull()
    expect(
      formatLiveWorldState({ plotPoints: { p2: resolvedPoint }, agenda: [] }),
    ).toBeNull()
  })

  describe('closing instruction', () => {
    it('mentions the agenda only when there is one', () => {
      const withAgenda = formatLiveWorldState({
        characters: { c1: rosterChar },
        agenda: [agendaItem],
      })
      expect(withAgenda).toContain('agenda items WILL happen on the timing shown')

      const withoutAgenda = formatLiveWorldState({
        characters: { c1: rosterChar },
      })
      expect(withoutAgenda).not.toContain('agenda')
    })

    it('mentions dispositions and motives only in full detail', () => {
      const full = formatLiveWorldState({ characters: { c1: rosterChar } })
      expect(full).toContain('NPC dispositions and motives do not flex')

      const desc = formatLiveWorldState({
        characters: { c1: rosterChar },
        characterDetail: 'description',
      })
      expect(desc).not.toContain('NPC dispositions and motives do not flex')
      expect(desc).toContain('do not bend to the protagonist')
    })

    it('says nothing about characters when the roster is empty', () => {
      const block = formatLiveWorldState({ plotPoints: { p1: activePoint } })
      expect(block).toContain('The narrative must respect this state.')
      expect(block).toContain('Carry items forward')
      expect(block).not.toContain('NPC dispositions')
      expect(block).not.toContain('agenda')
    })
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

describe('buildSharedHistory cache breakpoints', () => {
  const turn = (i: number): AdventureTurn => ({
    playerAction: i === 0 ? null : `Player action ${i}`,
    narrative: `Narrative for turn ${i}`,
  })

  // Assistant messages that carry a cache breakpoint. The primary assistant
  // narrative for a turn is the message we mark (see addTurnToMessages).
  const markedAssistants = (turns: AdventureTurn[]) => {
    const messages = buildSharedHistory(turns)
    return messages.filter((m) => m.role === 'assistant' && m.cache_control)
  }

  it('always marks the system/world-bible block', () => {
    const messages = buildSharedHistory([turn(0), turn(1), turn(2)])
    expect(messages[0].role).toBe('system')
    expect(messages[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
  })

  it('marks a breakpoint on the last TWO turns, not just the last one', () => {
    // OpenAI explicit caching only reads at a breakpoint re-declared this turn
    // that a previous turn wrote. A single last-turn breakpoint moves every
    // turn and is never re-read; the second (lagging) breakpoint is what makes
    // turn-to-turn reads possible.
    const marked = markedAssistants([turn(0), turn(1), turn(2), turn(3)])
    expect(marked).toHaveLength(2)
    expect(marked[0].content).toContain('turn 2')
    expect(marked[1].content).toContain('turn 3')
  })

  it('marks the single turn when only one exists', () => {
    const marked = markedAssistants([turn(0)])
    expect(marked).toHaveLength(1)
    expect(marked[0].content).toContain('turn 0')
  })
})
