import { describe, expect, it } from 'vitest'
import type { AdventureCompaction, AdventureTurn } from '../../hooks/useAdventurePersistence'
import {
  SEARCH_EARLIER_CONVERSATION_TOOL,
  buildSearchableParagraphs,
  formatConversationSearchResults,
  searchEarlierConversation,
} from './conversationSearch'

function makeTurns(count: number): AdventureTurn[] {
  return Array.from({ length: count }, (_, index) => ({
    playerAction: `Action ${index + 1}: I mention token-${index + 1}.`,
    narrative: `First paragraph of turn ${index + 1}.\n\nSecond paragraph with relic-${index + 1}.`,
    deuteragonistNarrative: `Secret deuteragonist-${index + 1}.`,
  }))
}

const compaction = (summary = 'summary'): AdventureCompaction => ({
  summary,
  generatedAt: '2026-01-01T00:00:00.000Z',
})

describe('Adventure earlier-conversation search', () => {
  it('tells the writer that regex search is literal rather than semantic', () => {
    expect(SEARCH_EARLIER_CONVERSATION_TOOL.description).toContain('NOT semantic')
    expect(SEARCH_EARLIER_CONVERSATION_TOOL.description).toContain('spaces are literal')
    expect(SEARCH_EARLIER_CONVERSATION_TOOL.description).toContain('Andrei|Kuznetsov|mother|cousin')

    expect(JSON.stringify(SEARCH_EARLIER_CONVERSATION_TOOL.parameters)).toContain('Use | between alternatives')
  })

  it('indexes paragraphs only from ranges replaced by available compactions', () => {
    const turns = makeTurns(55)
    const paragraphs = buildSearchableParagraphs(turns, { '0-9': compaction() })

    expect(paragraphs).toHaveLength(30)
    expect(paragraphs[0]).toMatchObject({ turnNumber: 1, turnsAgo: 55, source: 'protagonist action' })
    expect(paragraphs[paragraphs.length - 1]).toMatchObject({ turnNumber: 10, turnsAgo: 46, source: 'story prose' })
    expect(paragraphs.some((paragraph) => paragraph.paragraph.includes('deuteragonist'))).toBe(false)
    expect(paragraphs.some((paragraph) => paragraph.paragraph.includes('turn 11'))).toBe(false)
  })

  it('does not index an eligible range until its summary exists', () => {
    expect(buildSearchableParagraphs(makeTurns(40), undefined)).toEqual([])
    expect(buildSearchableParagraphs(makeTurns(40), { '0-9': compaction('') })).toEqual([])
  })

  it('ranks exact phrases above token-only matches and uses recency as a tie-breaker', () => {
    const turns = makeTurns(50)
    turns[1].narrative = 'The silver fox crosses the moonlit bridge.'
    turns[5].narrative = 'A fox watches a silver coin fall.'
    turns[8].narrative = 'The silver fox waits beside the gate.'

    const result = searchEarlierConversation(
      turns,
      { '0-9': compaction() },
      {
        mode: 'ranked',
        query: 'silver fox',
      },
    )

    expect(result.error).toBeUndefined()
    expect(result.hits.map((hit) => hit.turnNumber)).toEqual([9, 2, 6])
  })

  it('caps ranked results at five', () => {
    const result = searchEarlierConversation(
      makeTurns(50),
      { '0-9': compaction() },
      {
        mode: 'ranked',
        query: 'paragraph',
        limit: 99,
      },
    )
    expect(result.hits).toHaveLength(5)
  })

  it('returns regex matches newest-first', () => {
    const result = searchEarlierConversation(
      makeTurns(50),
      { '0-9': compaction() },
      {
        mode: 'regex',
        query: 'relic-(?:2|7|9)\\.',
      },
    )
    expect(result.hits.map((hit) => hit.turnNumber)).toEqual([9, 7, 2])
  })

  it.each([
    ['invalid', '['],
    ['unsafe', '(x+x+)+y'],
  ])('returns a structured error for %s regex', (_label, query) => {
    const result = searchEarlierConversation(
      makeTurns(50),
      { '0-9': compaction() },
      {
        mode: 'regex',
        query,
      },
    )
    expect(result.hits).toEqual([])
    expect(result.error).toBeTruthy()
  })

  it('returns a structured error for overlong queries', () => {
    const result = searchEarlierConversation(
      makeTurns(50),
      { '0-9': compaction() },
      {
        mode: 'ranked',
        query: 'x'.repeat(301),
      },
    )
    expect(result.error).toContain('at most 300')
  })

  it('formats exact paragraphs with temporal labels and deduplicates repeated hits', () => {
    const hit = {
      turnNumber: 4,
      turnsAgo: 42,
      source: 'story prose' as const,
      paragraph: '“The north door,” she says.',
    }
    const formatted = formatConversationSearchResults([
      { mode: 'ranked', query: 'north door', hits: [hit] },
      { mode: 'regex', query: 'north.*door', hits: [hit] },
    ])

    expect(formatted).toContain('[Turn 4; 42 turns ago; story prose]')
    expect(formatted.match(/“The north door,” she says\./g)).toHaveLength(1)
    expect(formatted).toContain('No matching paragraphs found.')
  })
})
