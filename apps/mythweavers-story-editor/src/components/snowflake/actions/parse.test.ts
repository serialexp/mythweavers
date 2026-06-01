import { describe, expect, it } from 'vitest'
import {
  cleanArcLine,
  deriveTitle,
  determineRefinementLevel,
  fallbackTitle,
  parseDelimitedSummaries,
  parseGeneratedBooks,
  parseLineSummaries,
} from './parse'

describe('parseGeneratedBooks', () => {
  it('parses a single book block with bulleted arcs', () => {
    const raw = `A young wizard discovers his heritage.
- First arc: Setup and initial challenges
- Second arc: Growing complications
- Third arc: Major crisis point
- Fourth arc: Final confrontation
===`
    const books = parseGeneratedBooks(raw)
    expect(books).toHaveLength(1)
    expect(books[0].summary).toBe('A young wizard discovers his heritage.')
    expect(books[0].arcs).toEqual([
      'Setup and initial challenges',
      'Growing complications',
      'Major crisis point',
      'Final confrontation',
    ])
  })

  it('parses multiple book blocks separated by ===', () => {
    const raw = `Book one summary.
- Arc A
- Arc B
===
Book two summary.
- Arc C
- Arc D
===`
    const books = parseGeneratedBooks(raw)
    expect(books).toHaveLength(2)
    expect(books[0].summary).toBe('Book one summary.')
    expect(books[1].summary).toBe('Book two summary.')
    expect(books[1].arcs).toEqual(['Arc C', 'Arc D'])
  })

  it('drops empty blocks and trailing separators', () => {
    const raw = 'Only book.\n- Arc\n===\n\n'
    const books = parseGeneratedBooks(raw)
    expect(books).toHaveLength(1)
    expect(books[0].arcs).toEqual(['Arc'])
  })
})

describe('cleanArcLine', () => {
  it('strips bullets and quarter/arc labels', () => {
    expect(cleanArcLine('- First arc: The setup')).toBe('The setup')
    expect(cleanArcLine('• Second quarter: Rising stakes')).toBe('Rising stakes')
    expect(cleanArcLine('Plain text')).toBe('Plain text')
  })
})

describe('parseDelimitedSummaries', () => {
  it('splits on === and trims', () => {
    const raw = 'First arc paragraph.\n===\nSecond arc paragraph.\n===\nThird.\n===\nFourth.'
    expect(parseDelimitedSummaries(raw)).toEqual(['First arc paragraph.', 'Second arc paragraph.', 'Third.', 'Fourth.'])
  })

  it('ignores blank segments', () => {
    expect(parseDelimitedSummaries('Only one.\n===\n   \n===')).toEqual(['Only one.'])
  })
})

describe('parseLineSummaries', () => {
  it('splits one item per line and strips numbering/bullets', () => {
    const raw = '1. First chapter\n2) Second chapter\n- Third chapter\n\nFourth chapter'
    expect(parseLineSummaries(raw)).toEqual(['First chapter', 'Second chapter', 'Third chapter', 'Fourth chapter'])
  })
})

describe('determineRefinementLevel', () => {
  it('returns 1 for empty or single-sentence text', () => {
    expect(determineRefinementLevel('')).toBe(1)
    expect(determineRefinementLevel('A single sentence.')).toBe(1)
    expect(determineRefinementLevel('No terminal punctuation')).toBe(1)
  })

  it('returns 2 for a short paragraph (2-4 sentences)', () => {
    expect(determineRefinementLevel('One. Two. Three.')).toBe(2)
  })

  it('returns 3 for five or more sentences', () => {
    expect(determineRefinementLevel('A. B. C. D. E. F.')).toBe(3)
  })
})

describe('deriveTitle', () => {
  it('uses the first sentence truncated to ~7 words', () => {
    expect(deriveTitle('The hero leaves home. Then more happens.', 'Book 1')).toBe('The hero leaves home')
  })

  it('truncates long first sentences with an ellipsis', () => {
    const long = 'One two three four five six seven eight nine ten'
    expect(deriveTitle(long, 'Book 1')).toBe('One two three four five six seven…')
  })

  it('falls back when summary is empty', () => {
    expect(deriveTitle('   ', 'Book 1')).toBe('Book 1')
  })
})

describe('fallbackTitle', () => {
  it('builds a 1-based, capitalized label', () => {
    expect(fallbackTitle('book', 0)).toBe('Book 1')
    expect(fallbackTitle('scene', 4)).toBe('Scene 5')
  })
})
