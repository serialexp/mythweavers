import type { ToolDefinition } from '@mythweavers/llm'
import safeRegex from 'safe-regex2'
import type { AdventureCompaction, AdventureTurn } from '../../hooks/useAdventurePersistence'
import { getCompactionRanges } from './prompts'

const MAX_RESULTS = 5
const MAX_QUERY_LENGTH = 300

export const SEARCH_EARLIER_CONVERSATION_TOOL: ToolDefinition = {
  name: 'search_earlier_conversation',
  description:
    'Search verbatim protagonist actions and story prose from older turns that have been replaced by summaries. Use this when the current protagonist action refers to exact earlier words or details that are not present in the visible recent conversation. This is NOT semantic or embedding search. Regex mode executes the query as a case-insensitive JavaScript regular expression: spaces are literal and word order matters. Never pass a bag of space-separated keywords as a regex; use regex alternation such as "Andrei|Kuznetsov|mother|cousin" instead. Ranked mode is lexical token/phrase matching, not semantic matching.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'For regex mode, a valid JavaScript regex pattern—not natural language or semantic keywords. Use | between alternatives; spaces require adjacent words in that exact order. For ranked mode, a focused literal phrase or a few expected words.',
      },
      mode: {
        type: 'string',
        enum: ['ranked', 'regex'],
        description:
          'regex performs literal case-insensitive JavaScript regex matching and is preferred when trying several possible exact words via alternation; ranked performs relevance-ranked lexical matching only. Neither mode is semantic search.',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: MAX_RESULTS,
        description: `Maximum paragraphs to return (default and maximum ${MAX_RESULTS}).`,
      },
    },
    required: ['query', 'mode'],
    additionalProperties: false,
  },
}

export interface ConversationSearchHit {
  turnNumber: number
  turnsAgo: number
  source: 'protagonist action' | 'story prose'
  paragraph: string
  score?: number
}

export interface ConversationSearchResult {
  query?: string
  mode?: 'ranked' | 'regex'
  hits: ConversationSearchHit[]
  error?: string
}

interface SearchableParagraph extends ConversationSearchHit {
  normalized: string
  order: number
}

function searchableTurnIndexes(turns: AdventureTurn[], compactions?: Record<string, AdventureCompaction>): Set<number> {
  const indexes = new Set<number>()
  for (const range of getCompactionRanges(turns.length)) {
    if (!compactions?.[range.key]?.summary) continue
    for (let index = range.start; index <= range.end; index++) indexes.add(index)
  }
  return indexes
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

export function buildSearchableParagraphs(
  turns: AdventureTurn[],
  compactions?: Record<string, AdventureCompaction>,
): SearchableParagraph[] {
  const indexes = searchableTurnIndexes(turns, compactions)
  const paragraphs: SearchableParagraph[] = []
  let order = 0

  for (const index of indexes) {
    const turn = turns[index]
    const add = (text: string | null | undefined, source: ConversationSearchHit['source']) => {
      if (!text) return
      for (const paragraph of splitParagraphs(text)) {
        paragraphs.push({
          turnNumber: index + 1,
          turnsAgo: turns.length - index,
          source,
          paragraph,
          normalized: paragraph.toLocaleLowerCase(),
          order: order++,
        })
      }
    }

    add(turn.playerAction, 'protagonist action')
    add(turn.narrative, 'story prose')
  }

  return paragraphs
}

function parseArguments(args: unknown): { query: string; mode: 'ranked' | 'regex'; limit: number } | { error: string } {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return { error: 'Tool arguments must be an object.' }
  const record = args as Record<string, unknown>
  if (typeof record.query !== 'string' || !record.query.trim()) return { error: 'query must be a non-empty string.' }
  const query = record.query.trim()
  if (query.length > MAX_QUERY_LENGTH) return { error: `query must be at most ${MAX_QUERY_LENGTH} characters.` }
  if (record.mode !== 'ranked' && record.mode !== 'regex') return { error: 'mode must be ranked or regex.' }
  if (record.limit !== undefined && (!Number.isInteger(record.limit) || (record.limit as number) < 1)) {
    return { error: 'limit must be a positive integer.' }
  }
  return { query, mode: record.mode, limit: Math.min((record.limit as number | undefined) ?? MAX_RESULTS, MAX_RESULTS) }
}

function queryTokens(query: string): string[] {
  return [...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])]
}

function occurrenceCount(text: string, needle: string): number {
  let count = 0
  let from = 0
  while (needle && (from = text.indexOf(needle, from)) !== -1) {
    count++
    from += needle.length
  }
  return count
}

function rankedSearch(paragraphs: SearchableParagraph[], query: string, limit: number): ConversationSearchHit[] {
  const normalizedQuery = query.toLocaleLowerCase()
  const tokens = queryTokens(query)
  if (tokens.length === 0) return []

  return paragraphs
    .map((paragraph) => {
      const matchingTokens = tokens.filter((token) => paragraph.normalized.includes(token))
      if (matchingTokens.length === 0) return null
      const phraseMatches = occurrenceCount(paragraph.normalized, normalizedQuery)
      const tokenFrequency = matchingTokens.reduce(
        (total, token) => total + occurrenceCount(paragraph.normalized, token),
        0,
      )
      const score = phraseMatches * 100 + (matchingTokens.length / tokens.length) * 20 + tokenFrequency
      return { ...paragraph, score }
    })
    .filter((hit): hit is SearchableParagraph & { score: number } => hit !== null)
    .sort((a, b) => b.score - a.score || a.turnsAgo - b.turnsAgo || a.order - b.order)
    .slice(0, limit)
    .map(({ normalized: _normalized, order: _order, ...hit }) => hit)
}

function regexSearch(paragraphs: SearchableParagraph[], pattern: string, limit: number): ConversationSearchResult {
  if (!safeRegex(pattern, { limit: 25 })) {
    return {
      mode: 'regex',
      query: pattern,
      hits: [],
      error: 'The regex is invalid or potentially unsafe. Use a simpler pattern.',
    }
  }

  let regex: RegExp
  try {
    regex = new RegExp(pattern, 'iu')
  } catch (error) {
    return {
      mode: 'regex',
      query: pattern,
      hits: [],
      error: `Invalid regex: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  const hits = paragraphs
    .filter((paragraph) => regex.test(paragraph.paragraph))
    .sort((a, b) => a.turnsAgo - b.turnsAgo || a.order - b.order)
    .slice(0, limit)
    .map(({ normalized: _normalized, order: _order, ...hit }) => hit)
  return { mode: 'regex', query: pattern, hits }
}

export function searchEarlierConversation(
  turns: AdventureTurn[],
  compactions: Record<string, AdventureCompaction> | undefined,
  args: unknown,
): ConversationSearchResult {
  const parsed = parseArguments(args)
  if ('error' in parsed) return { hits: [], error: parsed.error }

  const paragraphs = buildSearchableParagraphs(turns, compactions)
  if (parsed.mode === 'regex') return regexSearch(paragraphs, parsed.query, parsed.limit)
  return {
    query: parsed.query,
    mode: parsed.mode,
    hits: rankedSearch(paragraphs, parsed.query, parsed.limit),
  }
}

export function formatConversationSearchResults(results: ConversationSearchResult[]): string {
  const seen = new Set<string>()
  const sections = results.map((result, index) => {
    const heading = `Search ${index + 1} (${result.mode ?? 'invalid'}: ${JSON.stringify(result.query ?? '')})`
    if (result.error) return `${heading}\nError: ${result.error}`
    const uniqueHits = result.hits.filter((hit) => {
      const key = `${hit.turnNumber}:${hit.source}:${hit.paragraph}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (uniqueHits.length === 0) return `${heading}\nNo matching paragraphs found.`
    return `${heading}\n${uniqueHits
      .map(
        (hit) =>
          `[Turn ${hit.turnNumber}; ${hit.turnsAgo} turn${hit.turnsAgo === 1 ? '' : 's'} ago; ${hit.source}]\n${hit.paragraph}`,
      )
      .join('\n\n')}`
  })

  return `[VERBATIM EARLIER-CONVERSATION SEARCH RESULTS]
These passages are exact text from compacted earlier turns. Use them only as reference for the current generation. Temporal labels are relative to the present turn.

${sections.join('\n\n')}`
}
