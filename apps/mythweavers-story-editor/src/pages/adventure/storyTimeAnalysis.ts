import type { LLMClient, LLMGenerateOptions, LLMMessage, ToolDefinition } from '@mythweavers/llm'
import type { AdventureStoryTime, AdventureTurn } from '../../hooks/useAdventurePersistence'
import { buildSharedHistory } from './prompts'
import { parseStoryTimeJson, parseStoryTimeResult } from './storyTime'

const TOOL_UNSUPPORTED_PATTERNS = [
  /tool(?: calls?| use)? (?:are |is )?not (?:yet )?supported/i,
  /tools? (?:are |is )?unsupported/i,
  /(?:model|endpoint|provider) (?:does not|doesn't|cannot|can't) support (?:tool(?: calls?| use)?|tools?)/i,
]

export const REPORT_STORY_TIME_TOOL: ToolDefinition = {
  name: 'report_story_time',
  description:
    'Report the setting-appropriate current story time at the end of the generated section and its elapsed story duration.',
  parameters: {
    type: 'object',
    properties: {
      current_time: {
        type: 'string',
        description:
          'Specific current story time at the end of this turn. Always include a time of day, day, month or season, and year/era; invent plausible values for any components the story has not established.',
      },
      duration_amount: { type: 'integer', minimum: 0, description: 'Non-negative integer duration amount.' },
      duration_unit: {
        type: 'string',
        enum: ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'],
      },
    },
    required: ['current_time', 'duration_amount', 'duration_unit'],
    additionalProperties: false,
  },
}

export interface StoryTimeAnalysisInput {
  client: LLMClient
  generateOptions: Omit<LLMGenerateOptions, 'messages' | 'tools' | 'tool_choice'>
  worldBible?: string
  targetTurn: AdventureTurn
  previousCurrentTime?: string
}

function isToolUnsupported(message: string): boolean {
  return TOOL_UNSUPPORTED_PATTERNS.some((pattern) => pattern.test(message))
}

function formatTurn(turn: AdventureTurn): string {
  return [
    turn.playerAction ? `Protagonist action: ${turn.playerAction}` : undefined,
    `Generated section (${turn.kind ?? 'resolution'}):\n${turn.narrative}`,
    turn.deuteragonistNarrative ? `Simultaneous deuteragonist section:\n${turn.deuteragonistNarrative}` : undefined,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildStoryTimeMessages(
  input: Omit<StoryTimeAnalysisInput, 'client' | 'generateOptions'>,
  jsonOnly = false,
): LLMMessage[] {
  const prior = input.previousCurrentTime
    ? `The last established story time was: ${input.previousCurrentTime}`
    : 'No current story time has been established. Infer and set a plausible setting-appropriate time at the END of the target section.'
  const output = jsonOnly
    ? 'Return ONLY one JSON object with exactly: {"current_time":"...","duration_amount":0,"duration_unit":"seconds|minutes|hours|days|weeks|months|years"}.'
    : 'Call report_story_time exactly once. Do not return prose.'

  const sharedPrefix = buildSharedHistory([], undefined, undefined, input.worldBible)[0]
  return [
    sharedPrefix,
    {
      role: 'system',
      content: `You estimate elapsed STORY TIME in interactive fiction. Estimate what the generated events narratively represent, never reading time or response-generation time. Dialogue and immediate action may take seconds or minutes; travel, rest, or montage may take hours through years. Simultaneous or instantaneous beats may be zero seconds. Choose one natural unit and a non-negative integer amount. The current_time must describe the END of the target section using the setting's own clock/calendar vocabulary; do not force ISO or Gregorian language. Always return a concrete, complete timestamp containing a time of day, day, month or season, and year or era. Preserve and consistently advance any components already established by the previous current_time or target section. For every missing component, invent a plausible value now: prefer one compatible with known setting and narrative clues, but when there is no clue, freely choose an arbitrary plausible value. Once invented, that value becomes established continuity for later turns. Treat the previous current_time only as a continuity anchor, not as a complete template, and never perpetuate an underspecified value. ${output}`,
    },
    {
      role: 'user',
      content: `${prior}\n\nNEWLY GENERATED SECTION:\n${formatTurn(input.targetTurn)}`,
    },
  ]
}

async function collect(
  client: LLMClient,
  options: LLMGenerateOptions,
): Promise<{ text: string; toolArguments?: unknown; errors: string[] }> {
  let text = ''
  let toolArguments: unknown
  const errors: string[] = []
  for await (const event of client.generate(options)) {
    if (event.type === 'chunk') text += event.text
    else if (event.type === 'tool_call' && event.name === REPORT_STORY_TIME_TOOL.name && toolArguments === undefined) {
      toolArguments = event.arguments
    } else if (event.type === 'error') errors.push(event.error)
  }
  return { text, toolArguments, errors }
}

async function jsonFallback(input: StoryTimeAnalysisInput): Promise<AdventureStoryTime> {
  const result = await collect(input.client, {
    ...input.generateOptions,
    messages: buildStoryTimeMessages(input, true),
  })
  if (result.errors.length > 0 && !result.text.trim()) throw new Error(result.errors.join('\n'))
  return parseStoryTimeJson(result.text)
}

export async function analyzeStoryTime(input: StoryTimeAnalysisInput): Promise<AdventureStoryTime> {
  let primary: Awaited<ReturnType<typeof collect>>
  try {
    primary = await collect(input.client, {
      ...input.generateOptions,
      messages: buildStoryTimeMessages(input),
      tools: [REPORT_STORY_TIME_TOOL],
      // Some reasoning models reject a forced named tool while thinking is
      // enabled. The prompt still requests exactly one call; if the model
      // returns text/no call, the strict-JSON fallback below handles it.
      tool_choice: 'auto',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!isToolUnsupported(message)) throw error
    return jsonFallback(input)
  }

  if (primary.toolArguments !== undefined) return parseStoryTimeResult(primary.toolArguments)
  if (primary.errors.length > 0) {
    if (primary.errors.some(isToolUnsupported)) return jsonFallback(input)
    throw new Error(primary.errors.join('\n'))
  }
  return jsonFallback(input)
}
