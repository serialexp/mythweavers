import { describe, expect, it } from 'vitest'
import { applyTextReplacements, parseTextReplacement, type RewriteMessage, type TextReplacement } from './unifiedDiff'

const messages: RewriteMessage[] = [
  { id: 'first', content: 'Ada entered. Ada smiled.' },
  { id: 'second', content: 'Ada waited outside.' },
]

function operation(overrides: Partial<TextReplacement> = {}): TextReplacement {
  return {
    messageId: 'first',
    find: 'Ada',
    replace: 'Bea',
    replaceAll: false,
    ...overrides,
  }
}

describe('applyTextReplacements', () => {
  it('replaces a unique exact occurrence by default', () => {
    const result = applyTextReplacements(messages, [operation({ find: 'Ada entered', replace: 'Bea arrived' })])

    expect(result.messages.get('first')).toBe('Bea arrived. Ada smiled.')
    expect(result.outcomes).toMatchObject([{ status: 'applied', replacements: 1 }])
  })

  it('rejects an ambiguous match unless replaceAll is explicit', () => {
    const result = applyTextReplacements(messages, [operation()])

    expect(result.messages.get('first')).toBe(messages[0].content)
    expect(result.outcomes).toMatchObject([{ status: 'failed', replacements: 0 }])
    expect(result.outcomes[0].error).toContain('appears 2 times')
  })

  it('replaces every exact occurrence only when replaceAll is explicit', () => {
    const result = applyTextReplacements(messages, [operation({ replaceAll: true })])

    expect(result.messages.get('first')).toBe('Bea entered. Bea smiled.')
    expect(result.outcomes).toMatchObject([{ status: 'applied', replacements: 2 }])
  })

  it('applies replacements independently across messages', () => {
    const result = applyTextReplacements(messages, [
      operation({ messageId: 'first', replaceAll: true }),
      operation({ messageId: 'second' }),
    ])

    expect(result.messages.get('first')).toBe('Bea entered. Bea smiled.')
    expect(result.messages.get('second')).toBe('Bea waited outside.')
  })

  it('uses the current text for sequential operations', () => {
    const result = applyTextReplacements(messages, [
      operation({ find: 'Ada entered', replace: 'Bea arrived' }),
      operation({ find: 'Bea arrived', replace: 'Bea slipped inside' }),
    ])

    expect(result.messages.get('first')).toBe('Bea slipped inside. Ada smiled.')
  })

  it('does not modify a message when its exact target is absent', () => {
    const result = applyTextReplacements(messages, [operation({ find: 'Not present' })])

    expect(result.messages.get('first')).toBe(messages[0].content)
    expect(result.outcomes).toMatchObject([{ status: 'failed', replacements: 0 }])
  })

  it('rejects unknown messages and empty find text without mutating source', () => {
    const result = applyTextReplacements(messages, [operation({ messageId: 'missing' }), operation({ find: '' })])

    expect(result.messages.get('first')).toBe(messages[0].content)
    expect(result.outcomes.map((outcome) => outcome.status)).toEqual(['failed', 'failed'])
  })

  it('records a no-op when replacement text equals a unique exact target', () => {
    const result = applyTextReplacements(messages, [operation({ find: 'Ada entered', replace: 'Ada entered' })])

    expect(result.messages.get('first')).toBe(messages[0].content)
    expect(result.outcomes).toMatchObject([{ status: 'noop', replacements: 1 }])
  })
})

describe('parseTextReplacement', () => {
  it('accepts valid structured tool arguments', () => {
    expect(parseTextReplacement(operation())).toEqual(operation())
  })

  it('rejects missing, malformed, and unsafe arguments', () => {
    expect(() => parseTextReplacement(null)).toThrow('arguments must be an object')
    expect(() => parseTextReplacement({ ...operation(), find: '' })).toThrow('find text')
    expect(() => parseTextReplacement({ ...operation(), replaceAll: 'yes' })).toThrow('replaceAll')
  })
})
