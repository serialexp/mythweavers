import {
  applyTextReplacements,
  buildReplacementRewritePrompt,
  parseTextReplacement,
  REPLACE_TEXT_TOOL,
  type ReplacementApplicationResult,
  type RewriteMessage,
  type TextReplacement,
} from '@mythweavers/shared'
import type { LLMClient, LLMGenerateOptions, LLMMessage } from '../../types/llm'

const MAX_REPAIR_ROUNDS = 3

export interface GenerateReplacementRewriteOptions {
  client: LLMClient
  model: string
  messages: RewriteMessage[]
  instruction: string
  contextSection?: string
  providerOptions?: Record<string, unknown>
  metadata: Record<string, unknown>
}

export interface GenerateReplacementRewriteResult extends ReplacementApplicationResult {
  /** Invalid tool calls that were excluded from the proposed rewrite. */
  failures: string[]
}

interface ToolCallCollection {
  operations: TextReplacement[]
  errors: string[]
}

function buildRepairMessage(issues: string[]): LLMMessage {
  return {
    role: 'user',
    content: `The previous rewrite response was invalid:\n${issues.map((issue) => `- ${issue}`).join('\n')}\n\nTry again using the same editable messages. Reissue the complete set of replacement tool calls needed for the requested rewrite. For a target that appears more than once, either copy enough surrounding text into find to make it unique, or set replaceAll: true only when every identical occurrence should change. Return only replacement tool calls.`,
  }
}

async function collectToolCalls(client: LLMClient, request: LLMGenerateOptions): Promise<ToolCallCollection> {
  const operations: TextReplacement[] = []
  const errors: string[] = []
  let textResponse = ''

  for await (const event of client.generate(request)) {
    if (event.type === 'tool_call') {
      if (event.name !== REPLACE_TEXT_TOOL.name) {
        errors.push(`The model called an unsupported tool: ${event.name || '(unnamed)'}`)
        continue
      }
      try {
        operations.push(parseTextReplacement(event.arguments))
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'The model emitted invalid replacement arguments')
      }
    } else if (event.type === 'chunk') {
      textResponse += event.text
    } else if (event.type === 'error') {
      errors.push(event.error)
    }
  }

  if (textResponse.trim()) {
    errors.push('The model returned prose instead of replacement tool calls')
  }

  return { operations, errors }
}

/**
 * Ask a model to emit structured replacement tool calls, validate every call,
 * and apply only exact matches. Ambiguous or stale calls receive up to three
 * repair rounds that retain the original prompt prefix for provider caching.
 */
export async function generateReplacementRewrite(
  options: GenerateReplacementRewriteOptions,
): Promise<GenerateReplacementRewriteResult> {
  const messages: LLMMessage[] = [
    {
      role: 'user',
      content: buildReplacementRewritePrompt(options.messages, options.instruction, options.contextSection),
    },
  ]
  let failures: string[] = []
  let result = applyTextReplacements(options.messages, [])

  for (let round = 0; round < MAX_REPAIR_ROUNDS; round++) {
    const collection = await collectToolCalls(options.client, {
      model: options.model,
      messages,
      tools: [REPLACE_TEXT_TOOL],
      tool_choice: 'auto',
      providerOptions: options.providerOptions,
      metadata: options.metadata,
    })
    result = applyTextReplacements(options.messages, collection.operations)

    const failedOutcomes = result.outcomes.filter((outcome) => outcome.status === 'failed')
    const issues = [
      ...collection.errors,
      ...failedOutcomes.map((outcome) => outcome.error || 'A replacement operation failed'),
    ]
    if (issues.length === 0) {
      return { ...result, failures: [] }
    }

    if (round === MAX_REPAIR_ROUNDS - 1) {
      failures = [`Unable to validate all replacement calls after ${MAX_REPAIR_ROUNDS} attempts.`, ...issues]
      break
    }

    messages.push({ role: 'assistant', content: '<replacement tool calls failed validation>' })
    messages.push(buildRepairMessage(issues))
  }

  return { ...result, failures }
}
