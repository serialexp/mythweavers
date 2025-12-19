import { type EditorState, Plugin, PluginKey } from '../state'
import type { Transaction } from '../state'

/**
 * An input rule describes a pattern to match in typed text and a handler
 * to transform the match.
 */
export interface InputRule {
  /** The regex pattern to match. Must end with $ to match at cursor. */
  match: RegExp
  /**
   * Handler that returns the replacement.
   * Can return:
   * - A string to replace the matched text
   * - null to not apply the rule
   * - A transaction to apply custom changes
   */
  handler: (state: EditorState, match: RegExpMatchArray, start: number, end: number) => string | Transaction | null
}

/**
 * Create a simple text replacement input rule.
 */
export function textRule(match: RegExp, replacement: string): InputRule {
  return {
    match,
    handler: () => replacement,
  }
}

/**
 * Smart quotes input rules.
 * Converts straight quotes to curly quotes based on context.
 */
export const smartQuotes: InputRule[] = [
  // Opening double quote: after whitespace, start of text, or opening punctuation
  {
    match: /(?:^|[\s\(\[\{])"$/,
    handler: (_state, match) => {
      // Replace just the quote, keeping the preceding character
      const prefix = match[0].slice(0, -1)
      return `${prefix}\u201C` // "
    },
  },
  // Closing double quote: after any other character
  {
    match: /[^\s\(\[\{]"$/,
    handler: (_state, match) => {
      const prefix = match[0].slice(0, -1)
      return `${prefix}\u201D` // "
    },
  },
  // Opening single quote: after whitespace, start of text, or opening punctuation
  {
    match: /(?:^|[\s\(\[\{])'$/,
    handler: (_state, match) => {
      const prefix = match[0].slice(0, -1)
      return `${prefix}\u2018` // '
    },
  },
  // Closing single quote / apostrophe: after any other character
  {
    match: /[^\s\(\[\{]'$/,
    handler: (_state, match) => {
      const prefix = match[0].slice(0, -1)
      return `${prefix}\u2019` // '
    },
  },
]

/**
 * Em dash input rule: -- → —
 */
export const emDash: InputRule = textRule(/--$/, '\u2014')

/**
 * Ellipsis input rule: ... → …
 */
export const ellipsis: InputRule = textRule(/\.\.\.$/, '\u2026')

/**
 * Plugin key for the input rules plugin
 */
export const inputRulesKey = new PluginKey<InputRulesState>('inputRules')

interface InputRulesState {
  rules: InputRule[]
}

/**
 * Creates an input rules plugin that transforms text as the user types.
 */
export function inputRules(options: { rules: InputRule[] }): Plugin<InputRulesState> {
  return new Plugin({
    key: inputRulesKey,

    state: {
      init: () => ({ rules: options.rules }),
      apply: (_tr, value) => value,
    },

    // Input rules are applied via handleTextInput in props
    props: {
      handleTextInput: (view, from, to, text) => {
        const state = view.state
        const pluginState = inputRulesKey.getState(state)
        if (!pluginState) return false

        const { rules } = pluginState

        // Get the text before the cursor plus the new input
        const $from = state.doc.resolve(from)
        const textBefore = $from.parent.textBetween(
          Math.max(0, $from.parentOffset - 50), // Look back up to 50 chars
          $from.parentOffset,
          undefined,
          '\ufffc',
        )
        const fullText = textBefore + text

        // Try each rule
        for (const rule of rules) {
          const match = rule.match.exec(fullText)
          if (match) {
            // Calculate the start position of the match in the document
            const matchStart = from - (fullText.length - match.index - match[0].length + text.length)
            const matchEnd = from

            const result = rule.handler(state, match, matchStart, matchEnd)
            if (result === null) continue

            if (typeof result === 'string') {
              // Simple text replacement
              const tr = state.tr()
              // Delete from match start to where we are after inserting the typed text
              tr.delete(matchStart, to)
              // Insert the replacement
              tr.insertText(result, matchStart)
              view.dispatch(tr)
              return true
            }
            // Custom transaction
            view.dispatch(result)
            return true
          }
        }

        return false
      },
    },
  })
}

/**
 * Convenience function to create an input rules plugin with common rules.
 * Includes: smart quotes, em dash, ellipsis
 */
export function smartTypography(): Plugin<InputRulesState> {
  return inputRules({
    rules: [...smartQuotes, emDash, ellipsis],
  })
}
