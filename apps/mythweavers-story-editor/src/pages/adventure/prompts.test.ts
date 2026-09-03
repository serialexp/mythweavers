import { describe, expect, it } from 'vitest'
import type { AdventureTurn, AgendaItem, CharacterCard, PlotPoint } from '../../hooks/useAdventurePersistence'
import type { LLMMessage } from '../../types/llm'
import {
  CONDITIONS_SYSTEM_PROMPT,
  CONTINUE_STORY_INSTRUCTION,
  RESOLUTION_INSTRUCTION,
  WORLD_STEP_INSTRUCTION,
  buildConditionsMessages,
  buildDirectorMessages,
  buildPartnerActionMessages,
  buildResolutionMessages,
  buildRevisionMessages,
  buildSettingGenerationMessages,
  buildSharedHistory,
  buildWorldStepMessages,
  formatLiveWorldState,
  paragraphRangeForAction,
} from './prompts'

const protag = 'Maren, a young field medic with steady hands.'

const settingParameters = {
  era: 'Far Future',
  location: 'Floating',
  tone: 'Mystery',
  magictech: 'Sci-fi tech',
  scale: 'Regional',
}

describe('setting generation', () => {
  it('keeps a rough world concept separate from the world-only instruction', () => {
    const messages = buildSettingGenerationMessages({
      parameters: settingParameters,
      baseConcept: 'A civilization living above a permanent storm.',
    })
    expect(messages[0].content).toContain('Do NOT invent an inciting incident')
    expect(messages[1].content).toContain('Rough world concept:')
    expect(messages[1].content).not.toContain('Modification request:')
  })

  it('sends the current setting and modification as distinct fields', () => {
    const messages = buildSettingGenerationMessages({
      parameters: settingParameters,
      currentSetting: 'Sky-cities trade between the clouds.',
      modification: 'Remove advanced weapons and add political tension.',
    })
    expect(messages[1].content).toContain('Current world setting:\nSky-cities')
    expect(messages[1].content).toContain('Modification request:\nRemove advanced weapons')
  })
})

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

describe('response length', () => {
  const UNBOUNDED = 'Length: as long as the scene needs and no longer.'
  const turns: AdventureTurn[] = [
    { playerAction: null, narrative: 'The harbour wakes around you.' },
    { playerAction: 'I ask the captain about the ledger.', narrative: 'He stiffens.' },
  ]
  // Five sentences → the scaled 4-6 band, so a bounded build is visibly
  // different from the 2-4 default and we can tell the two apart.
  const longAction =
    'I stand up. I walk over to the captain. I ask him about the missing crew. If he lies, I call him out. Then I search his cabin.'

  const systemContents = (messages: LLMMessage[]) =>
    messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')

  describe('writer instruction constants', () => {
    const INSTRUCTIONS = [
      ['RESOLUTION_INSTRUCTION', RESOLUTION_INSTRUCTION],
      ['WORLD_STEP_INSTRUCTION', WORLD_STEP_INSTRUCTION],
      ['CONTINUE_STORY_INSTRUCTION', CONTINUE_STORY_INSTRUCTION],
    ] as const

    for (const [name, instruction] of INSTRUCTIONS) {
      it(`${name} renders the paragraph target it is given`, () => {
        expect(instruction({ min: 5, max: 7 })).toContain('- 5-7 paragraphs.')
      })

      it(`${name} defaults to the 2-4 band`, () => {
        expect(instruction()).toContain('- 2-4 paragraphs.')
      })

      it(`${name} drops the target entirely for null`, () => {
        const text = instruction(null)
        expect(text).not.toContain('paragraphs.')
        expect(text).toContain(UNBOUNDED)
      })
    }
  })

  describe('buildResolutionMessages', () => {
    it('separates persistent world lore from the one-time opening prompt', () => {
      const messages = buildResolutionMessages(
        [],
        'The treaty ceremony begins when every engine stops.',
        null,
        undefined,
        undefined,
        undefined,
        'Sky-cities drift above a permanent storm.',
      )
      const openingMessage = messages[messages.length - 1]
      expect(messages[0].content).toContain('[WORLD BIBLE')
      expect(messages[0].content).toContain('Sky-cities drift')
      expect(openingMessage.content).toContain('Adventure start:')
      expect(openingMessage.content).toContain('treaty ceremony')
      expect(openingMessage.content).not.toContain('Sky-cities drift')
    })

    const build = (action: string | null, options?: { unboundedLength: boolean }) =>
      systemContents(
        buildResolutionMessages(
          turns,
          'A storm-battered coastal town.',
          action,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          options,
        ),
      )

    it('scales the target off the player action by default', () => {
      expect(build(longAction)).toContain('- 4-6 paragraphs.')
    })

    it('replaces the target with the unbounded rule when unlocked', () => {
      const text = build(longAction, { unboundedLength: true })
      expect(text).toContain(UNBOUNDED)
      expect(text).not.toContain('paragraphs.')
    })
  })

  describe('buildResolutionMessages party-split block', () => {
    const build = (options?: { unboundedLength: boolean }) =>
      systemContents(
        buildResolutionMessages(
          turns,
          'A storm-battered coastal town.',
          longAction,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          'Maren, a field medic.',
          'Lyra, a quick-witted rogue.',
          true,
          options,
        ),
      )

    it('gives each half its own paragraph budget by default', () => {
      const text = build()
      expect(text).toContain('4-6 paragraphs.]')
      // The deuteragonist half has its own, smaller budget.
      expect(text).toContain('1-3 paragraphs.]')
    })

    it('unlocks both halves together', () => {
      const text = build({ unboundedLength: true })
      expect(text).not.toContain('paragraphs.')
      expect(text).toContain('as long as the scene needs.]')
    })
  })

  describe('buildWorldStepMessages', () => {
    for (const mode of ['world-step', 'continue'] as const) {
      it(`${mode} keeps the default band when bounded`, () => {
        const text = systemContents(
          buildWorldStepMessages(
            turns,
            'A storm-battered coastal town.',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            mode,
          ),
        )
        expect(text).toContain('- 2-4 paragraphs.')
      })

      it(`${mode} honours the unbounded option`, () => {
        const text = systemContents(
          buildWorldStepMessages(
            turns,
            'A storm-battered coastal town.',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            mode,
            { unboundedLength: true },
          ),
        )
        expect(text).toContain(UNBOUNDED)
        expect(text).not.toContain('paragraphs.')
      })
    }
  })

  // The director instruction lives in a user message, not a system one, so
  // this reads the whole conversation rather than reusing systemContents.
  describe('director beat skeleton', () => {
    const skeleton = (action: string | null) => {
      const all = buildDirectorMessages(
        turns,
        'A storm-battered coastal town.',
        action,
        undefined,
        'resolution',
      )
        .map((m) => m.content)
        .join('\n\n')
      const start = all.indexOf('OUTPUT FORMAT')
      return all.slice(start, all.indexOf('HARD RULES', start))
    }

    // Regression: the skeleton used to hardcode four numbered beats directly
    // above a "N–M beats" rule, so a long action asking for 8–10 beats was
    // shown a 4-beat template.
    it('matches the beat budget it was given', () => {
      const short = skeleton('I open the door.')
      expect(short).toContain('2. <beat>')
      expect(short).not.toContain('3. <beat>')
      expect(short).toContain('up to 4 beats')

      const long = skeleton(longAction)
      expect(long).toContain('4. <beat>')
      expect(long).not.toContain('5. <beat>')
      expect(long).toContain('up to 6 beats')
    })
  })

  describe('buildRevisionMessages', () => {
    const build = (
      kind: 'resolution' | 'world-step' | 'continue',
      options?: { unboundedLength: boolean },
    ) =>
      systemContents(
        buildRevisionMessages(
          turns,
          'A storm-battered coastal town.',
          longAction,
          'The original narrative.',
          '1. He knows something he was never told.',
          undefined,
          kind,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          options,
        ),
      )

    it('scales off the action for resolution revisions only', () => {
      expect(build('resolution')).toContain('- 4-6 paragraphs.')
      expect(build('world-step')).toContain('- 2-4 paragraphs.')
      expect(build('continue')).toContain('- 2-4 paragraphs.')
    })

    // A turn generated unbounded must not be revised back under a cap.
    for (const kind of ['resolution', 'world-step', 'continue'] as const) {
      it(`${kind} revisions inherit the unbounded setting`, () => {
        const text = build(kind, { unboundedLength: true })
        expect(text).toContain(UNBOUNDED)
        expect(text).not.toContain('paragraphs.')
      })
    }
  })
})

describe('buildSharedHistory opening context', () => {
  it('reconstructs the start prompt once while keeping world lore in the system prefix', () => {
    const messages = buildSharedHistory(
      [{ playerAction: null, narrative: 'The engines fall silent.' }],
      undefined,
      'A treaty ceremony is interrupted.',
      'Sky-cities drift above a permanent storm.',
    )
    expect(messages[0].content).toContain('Sky-cities drift')
    expect(messages.filter((message) => message.content.includes('treaty ceremony'))).toHaveLength(1)
    expect(messages[1].content).toBe('Begin the adventure.\n\nA treaty ceremony is interrupted.')
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

describe('narrative prompts carry the current story time', () => {
  // The last turn has no story time yet (analysis runs after finalize), so
  // the builders must fall back to the newest known time.
  const timedTurns: AdventureTurn[] = [
    {
      playerAction: null,
      narrative: 'Dawn breaks over the harbour.',
      storyTime: { currentTime: 'First Bell, Frostwane 12', duration: { amount: 2, unit: 'hours' } },
    },
    {
      playerAction: 'I ask about the ledger.',
      narrative: 'They point to the docks.',
      storyTime: { currentTime: 'Third Bell, Frostwane 12', duration: { amount: 1, unit: 'hours' } },
    },
    { playerAction: 'I go to the docks.', narrative: 'The fog rolls in.' },
  ]

  const systemText = (messages: LLMMessage[]) =>
    messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')

  it('injects the latest known story time into the resolution prompt', () => {
    const text = systemText(buildResolutionMessages(timedTurns, 'A coastal town.', 'I knock.', undefined))
    expect(text).toContain('[STORY TIME')
    expect(text).toContain('Third Bell, Frostwane 12')
    expect(text).not.toContain('First Bell, Frostwane 12')
  })

  it('omits the block when no turn has an estimated story time', () => {
    const text = systemText(buildResolutionMessages([], 'A coastal town.', null, undefined))
    expect(text).not.toContain('[STORY TIME')
  })

  it('carries the story time into the director, world-step, partner-action and revision prompts', () => {
    expect(
      systemText(buildDirectorMessages(timedTurns, 'A coastal town.', 'I knock.', undefined, 'resolution')),
    ).toContain('Third Bell, Frostwane 12')
    expect(systemText(buildWorldStepMessages(timedTurns, 'A coastal town.'))).toContain('Third Bell, Frostwane 12')
    expect(
      systemText(buildPartnerActionMessages(timedTurns, 'A coastal town.', 'I knock.', 'Lyra, a quick-witted rogue.')),
    ).toContain('Third Bell, Frostwane 12')
    expect(
      systemText(
        buildRevisionMessages(
          timedTurns,
          'A coastal town.',
          'I knock.',
          'The original.',
          '1. X.',
          undefined,
          'resolution',
        ),
      ),
    ).toContain('Third Bell, Frostwane 12')
  })
})
