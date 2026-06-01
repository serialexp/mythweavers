// Snowflake outliner constants — ported from the legacy writer app.

/** Detail levels for a node's one-line summary (the snowflake mechanic). */
export type RefinementLevel = 1 | 2 | 3

/** How many books "Generate Books" can produce in one go. */
export const BOOK_COUNT_OPTIONS = [3, 5, 7] as const

/** Chapter-count presets offered when expanding an arc into chapters. */
export const CHAPTER_COUNT_OPTIONS: Record<string, number> = {
  Short: 8,
  Medium: 12,
  Long: 16,
  'Extra Long': 20,
}

/** Human-readable description of each detail level, surfaced in the UI. */
export const LEVEL_DESCRIPTIONS: Record<RefinementLevel, string> = {
  1: 'A single powerful sentence that captures the core concept',
  2: 'A paragraph that expands on key elements and developments',
  3: 'A detailed page that fully explores all aspects and connections',
}
