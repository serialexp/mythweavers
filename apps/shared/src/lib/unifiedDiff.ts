/**
 * Strict, tool-call based text replacement utilities for LLM rewrites.
 *
 * Each operation names the exact source text it expects to change. Unlike a
 * unified diff, a replacement cannot silently drift when the model's context
 * or line numbers are wrong: an operation either finds its exact target or is
 * reported as invalid and leaves the source unchanged.
 */

export interface TextReplacement {
  /** Stable ID of the message containing the text to edit. */
  messageId: string
  /** Exact source text to replace. Must be non-empty. */
  find: string
  /** Text to insert in place of `find`. An empty string deletes it. */
  replace: string
  /** Replace every exact occurrence rather than only the first occurrence. */
  replaceAll: boolean
}

export interface RewriteMessage {
  id: string
  content: string
}

export interface ReplacementOutcome {
  operation: TextReplacement
  status: 'applied' | 'noop' | 'failed'
  replacements: number
  error?: string
}

export interface ReplacementApplicationResult {
  messages: Map<string, string>
  outcomes: ReplacementOutcome[]
  appliedCount: number
}

/**
 * OpenAI-compatible function definition. Anthropic and Ollama accept the same
 * JSON Schema through their respective tool APIs.
 */
export const REPLACE_TEXT_TOOL = {
  name: 'replace_text',
  description:
    'Replace exact text in one selected message. The find value must be copied verbatim from the supplied message. Set replaceAll only when every identical occurrence in that message should change.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      messageId: {
        type: 'string',
        description: 'The exact message ID from the editable messages list.',
      },
      find: {
        type: 'string',
        description: 'Non-empty exact text to replace, copied verbatim from the current message.',
      },
      replace: {
        type: 'string',
        description: 'Replacement text. Use an empty string to delete find.',
      },
      replaceAll: {
        type: 'boolean',
        description: 'True only to replace every exact occurrence of find in this message.',
      },
    },
    required: ['messageId', 'find', 'replace', 'replaceAll'],
  },
} as const

/** Convert untrusted tool-call arguments into a replacement operation. */
export function parseTextReplacement(arguments_: unknown): TextReplacement {
  if (!arguments_ || typeof arguments_ !== 'object' || Array.isArray(arguments_)) {
    throw new Error('Replacement arguments must be an object')
  }

  const value = arguments_ as Record<string, unknown>
  if (typeof value.messageId !== 'string' || !value.messageId) {
    throw new Error('Replacement messageId must be a non-empty string')
  }
  if (typeof value.find !== 'string' || !value.find) {
    throw new Error('Replacement find text must be a non-empty string')
  }
  if (typeof value.replace !== 'string') {
    throw new Error('Replacement text must be a string')
  }
  if (typeof value.replaceAll !== 'boolean') {
    throw new Error('Replacement replaceAll must be a boolean')
  }

  return {
    messageId: value.messageId,
    find: value.find,
    replace: value.replace,
    replaceAll: value.replaceAll,
  }
}

/**
 * Applies operations in order. Every operation is matched against the current
 * text, so later operations may deliberately build on prior replacements.
 * Failed operations never mutate a message and are retained in the outcome
 * list for the caller to show the user.
 */
export function applyTextReplacements(
  sourceMessages: readonly RewriteMessage[],
  operations: readonly TextReplacement[],
): ReplacementApplicationResult {
  const messages = new Map(sourceMessages.map((message) => [message.id, message.content]))
  const outcomes: ReplacementOutcome[] = []
  let appliedCount = 0

  for (const operation of operations) {
    const current = messages.get(operation.messageId)
    if (current === undefined) {
      outcomes.push({
        operation,
        status: 'failed',
        replacements: 0,
        error: `Unknown message ID: ${operation.messageId}`,
      })
      continue
    }
    if (!operation.find) {
      outcomes.push({
        operation,
        status: 'failed',
        replacements: 0,
        error: 'Replacement find text must be non-empty',
      })
      continue
    }

    const occurrences = current.split(operation.find).length - 1
    if (occurrences === 0) {
      outcomes.push({
        operation,
        status: 'failed',
        replacements: 0,
        error: 'Exact replacement target was not found in the current message text',
      })
      continue
    }

    if (!operation.replaceAll && occurrences > 1) {
      outcomes.push({
        operation,
        status: 'failed',
        replacements: 0,
        error: `Replacement target appears ${occurrences} times in message ${operation.messageId}. Provide more surrounding context in find, or set replaceAll: true only when every occurrence should change.`,
      })
      continue
    }

    const replacements = operation.replaceAll ? occurrences : 1
    const updated = operation.replaceAll
      ? current.split(operation.find).join(operation.replace)
      : current.replace(operation.find, operation.replace)

    if (updated === current) {
      outcomes.push({ operation, status: 'noop', replacements })
      continue
    }

    messages.set(operation.messageId, updated)
    outcomes.push({ operation, status: 'applied', replacements })
    appliedCount += replacements
  }

  return { messages, outcomes, appliedCount }
}

/** Builds the text prompt used with `REPLACE_TEXT_TOOL`. */
export function buildReplacementRewritePrompt(
  messages: readonly RewriteMessage[],
  instruction: string,
  contextSection?: string,
): string {
  const editableMessages = messages
    .map((message) => `<message id="${message.id}">\n${message.content}\n</message>`)
    .join('\n\n')

  return `${contextSection || ''}Rewrite the editable messages according to this instruction:

${instruction}

Use the replace_text tool for every change. Each call must copy the exact existing text into find and provide only its replacement in replace. Use replaceAll: true only when every exact occurrence of find in that one message must be changed. You may make multiple calls, and later calls operate on the text produced by earlier calls.

Do not call the tool for text that should remain unchanged. If no changes are needed, make no tool calls. Do not return rewritten prose, a diff, explanations, markdown, or any other text.

Editable messages:

${editableMessages}`
}
