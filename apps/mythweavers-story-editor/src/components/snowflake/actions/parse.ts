// Pure parsing + text helpers for the snowflake actions. No store imports, so
// these are trivially unit-testable in isolation.

import type { NodeType } from '../../../types/core'
import type { RefinementLevel } from '../constants'

/** Strip a leading bullet and an optional "First arc:"/"… quarter:" label. */
export function cleanArcLine(line: string): string {
  return line
    .replace(/^[-*•]\s*/, '')
    .replace(/^(first|second|third|fourth|fifth|sixth)\s+(arc|quarter|movement)\s*:\s*/i, '')
    .trim()
}

export interface ParsedBook {
  summary: string
  arcs: string[]
}

/**
 * Parse the expand-story response into book blocks. Blocks are separated by a
 * line of "===". Within a block the first non-empty line is the book one-liner
 * and the rest are arc movements.
 */
export function parseGeneratedBooks(raw: string): ParsedBook[] {
  return raw
    .split(/^\s*={3,}\s*$/m)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      const lines = block
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
      const summary = lines[0] ?? ''
      const arcs = lines
        .slice(1)
        .map(cleanArcLine)
        .filter((l) => l.length > 0)
      return { summary, arcs }
    })
    .filter((book) => book.summary.length > 0)
}

/** Split a "===" separated list (e.g. arc paragraphs). */
export function parseDelimitedSummaries(raw: string): string[] {
  return raw
    .split(/^\s*={3,}\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** Split a one-item-per-line list, dropping blanks, bullets, and numbering. */
export function parseLineSummaries(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) =>
      l
        .replace(/^\s*\d+[.)]\s*/, '')
        .replace(/^[-*•]\s*/, '')
        .trim(),
    )
    .filter((l) => l.length > 0)
}

/**
 * Infer the current detail level of a summary from its shape. Used because the
 * single-`summary` model carries no explicit level history.
 *  - <= 1 sentence  -> level 1 (one sentence)
 *  - 2-4 sentences  -> level 2 (paragraph)
 *  - 5+ sentences   -> level 3 (page)
 */
export function determineRefinementLevel(text: string): RefinementLevel {
  const trimmed = text.trim()
  if (trimmed.length === 0) return 1
  const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  if (sentences.length <= 1) return 1
  if (sentences.length <= 4) return 2
  return 3
}

/**
 * Derive a short, human title from generated summary text. Falls back to a
 * numbered label so the navigator never shows an empty title.
 */
export function deriveTitle(summary: string, fallback: string): string {
  const firstSentence =
    summary
      .trim()
      .split(/[.!?\n]/)[0]
      ?.trim() ?? ''
  if (firstSentence.length === 0) return fallback
  const words = firstSentence.split(/\s+/).slice(0, 7).join(' ')
  return words.length < firstSentence.length ? `${words}…` : words
}

/** Label used as the fallback title for a freshly generated node. */
export function fallbackTitle(type: NodeType, index: number): string {
  const name = type.charAt(0).toUpperCase() + type.slice(1)
  return `${name} ${index + 1}`
}
