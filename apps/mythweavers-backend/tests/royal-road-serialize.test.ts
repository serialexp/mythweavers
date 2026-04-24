import { describe, expect, test } from 'bun:test'
import {
  isSeparatorParagraph,
  serializeScenesToHtml,
} from '../src/lib/royal-road/serialize.js'

/**
 * Pure-unit tests for the serializer. Exercising DB walking is deferred to
 * the integration tests that accompany Phase C (publishing worker) since
 * building the full Scene → Message → Paragraph fixture graph is cheapest
 * once the other routes exist.
 */

describe('royal-road serializer', () => {
  test('wraps plain text paragraphs in <p> tags', () => {
    const out = serializeScenesToHtml([['Hello world']])
    expect(out).toBe('<p>Hello world</p>')
  })

  test('passes through paragraphs that already start with a block element', () => {
    const out = serializeScenesToHtml([
      ['<p>Already wrapped</p>', '<blockquote>Quoted</blockquote>'],
    ])
    expect(out).toContain('<p>Already wrapped</p>')
    expect(out).toContain('<blockquote>Quoted</blockquote>')
    // No double-wrapping.
    expect(out).not.toContain('<p><p>')
    expect(out).not.toContain('<p><blockquote>')
  })

  test('renders separator paragraphs as the Royal Road divider image', () => {
    const out = serializeScenesToHtml([['<p>Before</p>', '<p>* * *</p>', '<p>After</p>']])
    expect(out).toContain('<img')
    expect(out).toContain('Group.png')
    // Separator text must not survive.
    expect(out).not.toContain('* * *')
  })

  test('joins scenes with the divider image', () => {
    const out = serializeScenesToHtml([['<p>One</p>'], ['<p>Two</p>']])
    // Divider between them.
    expect(out.split('Group.png').length - 1).toBe(1)
    // Both paragraph bodies survive.
    expect(out).toContain('<p>One</p>')
    expect(out).toContain('<p>Two</p>')
  })

  test('drops empty scenes and empty paragraphs', () => {
    const out = serializeScenesToHtml([['<p>Only</p>'], [], ['', '<p>Trailing</p>']])
    expect(out).toContain('<p>Only</p>')
    expect(out).toContain('<p>Trailing</p>')
    // Two non-empty scenes → one divider.
    expect(out.split('Group.png').length - 1).toBe(1)
  })

  test('returns empty string for an all-empty input', () => {
    expect(serializeScenesToHtml([])).toBe('')
    expect(serializeScenesToHtml([[], []])).toBe('')
  })

  test('isSeparatorParagraph matches known markers', () => {
    expect(isSeparatorParagraph('<p>* * *</p>')).toBe(true)
    expect(isSeparatorParagraph('<p>***</p>')).toBe(true)
    expect(isSeparatorParagraph('<p>*</p>')).toBe(true)
    expect(isSeparatorParagraph('<p>-----</p>')).toBe(true)
    expect(isSeparatorParagraph('<p>----- * * * -----</p>')).toBe(true)
  })

  test('isSeparatorParagraph ignores ordinary text', () => {
    expect(isSeparatorParagraph('<p>A normal paragraph.</p>')).toBe(false)
    expect(isSeparatorParagraph('<p>10 * 5 = 50</p>')).toBe(false)
    expect(isSeparatorParagraph('<p></p>')).toBe(false)
    expect(isSeparatorParagraph('')).toBe(false)
  })
})
