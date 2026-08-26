import type { LLMClient, LLMGenerateOptions, LLMMessage, LLMStreamEvent } from '@mythweavers/llm'
import type { AdventureCompaction, AdventureTurn } from '../../hooks/useAdventurePersistence'
import {
  type ConversationSearchResult,
  SEARCH_EARLIER_CONVERSATION_TOOL,
  buildSearchableParagraphs,
  formatConversationSearchResults,
  searchEarlierConversation,
} from './conversationSearch'

const MAX_SEARCH_ROUNDS = 2
const TOOL_UNSUPPORTED_PATTERNS = [
  /tool(?: calls?| use)? (?:are |is )?not (?:yet )?supported/i,
  /tools? (?:are |is )?unsupported/i,
  /(?:model|endpoint|provider) (?:does not|doesn't|cannot|can't) support (?:tool(?: calls?| use)?|tools?)/i,
]

function isToolUnsupportedError(message: string): boolean {
  return TOOL_UNSUPPORTED_PATTERNS.some((pattern) => pattern.test(message))
}

export interface WriterToolLoopOptions {
  client: LLMClient
  generateOptions: Omit<LLMGenerateOptions, 'messages' | 'tools' | 'tool_choice'>
  messages: LLMMessage[]
  turns: AdventureTurn[]
  compactions?: Record<string, AdventureCompaction>
  onText: (accumulated: string) => void
  onResetText: () => void
  onSearchCount?: (count: number) => void
}

export interface WriterToolLoopResult {
  raw: string
  streamErrors: string[]
  searchCount: number
}

interface CollectedGeneration {
  raw: string
  streamErrors: string[]
  toolCalls: Array<Extract<LLMStreamEvent, { type: 'tool_call' }>>
}

async function collectGeneration(
  client: LLMClient,
  options: LLMGenerateOptions,
  onText: (accumulated: string) => void,
): Promise<CollectedGeneration> {
  let raw = ''
  const streamErrors: string[] = []
  const toolCalls: CollectedGeneration['toolCalls'] = []

  for await (const event of client.generate(options)) {
    if (event.type === 'chunk') {
      raw += event.text
      onText(raw)
    } else if (event.type === 'tool_call') {
      toolCalls.push(event)
    } else if (event.type === 'error') {
      streamErrors.push(event.error)
    }
  }

  return { raw, streamErrors, toolCalls }
}

function executeToolCalls(
  calls: CollectedGeneration['toolCalls'],
  turns: AdventureTurn[],
  compactions?: Record<string, AdventureCompaction>,
): ConversationSearchResult[] {
  return calls.map((call) => {
    if (call.name !== SEARCH_EARLIER_CONVERSATION_TOOL.name) {
      return { hits: [], error: `Unknown tool: ${call.name}` }
    }
    return searchEarlierConversation(turns, compactions, call.arguments)
  })
}

/**
 * Run an Adventure writer generation with a bounded retrieve-and-rerun loop.
 * Tool-bearing responses are provisional: their text is discarded, all search
 * calls are executed locally, and the model is re-run with exact old passages.
 */
export async function runWriterToolLoop(options: WriterToolLoopOptions): Promise<WriterToolLoopResult> {
  const allResults: ConversationSearchResult[] = []
  const allStreamErrors: string[] = []
  const hasSearchableHistory = buildSearchableParagraphs(options.turns, options.compactions).length > 0
  let searchCount = 0
  let messages = options.messages

  for (let searchRound = 0; searchRound <= MAX_SEARCH_ROUNDS; searchRound++) {
    const toolsEnabled = hasSearchableHistory && searchRound < MAX_SEARCH_ROUNDS
    let generation: CollectedGeneration
    try {
      generation = await collectGeneration(
        options.client,
        {
          ...options.generateOptions,
          messages,
          ...(toolsEnabled ? { tools: [SEARCH_EARLIER_CONVERSATION_TOOL], tool_choice: 'auto' as const } : {}),
        },
        options.onText,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!toolsEnabled || !isToolUnsupportedError(message)) throw error
      options.onResetText()
      const fallback = await collectGeneration(options.client, { ...options.generateOptions, messages }, options.onText)
      return { raw: fallback.raw, streamErrors: fallback.streamErrors, searchCount }
    }

    if (
      toolsEnabled &&
      generation.raw.length === 0 &&
      generation.toolCalls.length === 0 &&
      generation.streamErrors.some(isToolUnsupportedError)
    ) {
      options.onResetText()
      const fallback = await collectGeneration(options.client, { ...options.generateOptions, messages }, options.onText)
      return { raw: fallback.raw, streamErrors: fallback.streamErrors, searchCount }
    }

    allStreamErrors.push(...generation.streamErrors)
    if (generation.toolCalls.length === 0 || !toolsEnabled) {
      return { raw: generation.raw, streamErrors: allStreamErrors, searchCount }
    }

    searchCount += generation.toolCalls.length
    options.onSearchCount?.(searchCount)
    allResults.push(...executeToolCalls(generation.toolCalls, options.turns, options.compactions))
    options.onResetText()
    messages = [
      ...options.messages,
      {
        role: 'system',
        content: formatConversationSearchResults(allResults),
      },
    ]
  }

  throw new Error('Writer tool loop exhausted unexpectedly')
}
