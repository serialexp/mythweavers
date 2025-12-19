export const BOOK_COUNT_OPTIONS = [3, 5, 7] as const
export const CHAPTER_COUNT_OPTIONS = {
  Short: 8,
  Medium: 12,
  Long: 16,
  'Extra Long': 20,
} as const

export type RefinementLevel = 1 | 2 | 3

export const LEVEL_DESCRIPTIONS = {
  1: 'A single powerful sentence that captures the core concept',
  2: 'A paragraph that expands on key elements and developments',
  3: 'A detailed page that fully explores all aspects and connections',
} as const
