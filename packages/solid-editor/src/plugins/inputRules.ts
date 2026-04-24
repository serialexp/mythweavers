import { Fragment, NodeRange, Slice } from '../model'
import type { NodeType } from '../model'
import { type EditorState, Plugin, PluginKey } from '../state'
import type { Transaction } from '../state'
import { findWrapping } from '../transform'

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

// ─── Markdown-style structural input rules ─────────────────────────────────
//
// These rules detect markdown-like prefixes at the start of a textblock
// and convert the block to the appropriate type. They fire when the user
// types the trailing space (e.g. "# " → heading 1).

/**
 * Create an input rule that changes the textblock type when a pattern
 * is typed at the start of a block.
 *
 * The regex should match the prefix including the trailing space that triggers it.
 * The matched text is deleted and the block type is changed.
 */
export function blockTypeRule(match: RegExp, nodeType: NodeType, attrs?: Record<string, unknown>): InputRule {
  return {
    match,
    handler: (state, _match, start, end) => {
      const $from = state.doc.resolve(start)
      // Only apply at the start of a textblock
      if ($from.parentOffset !== 0 && start !== $from.start()) return null
      // Don't apply if already this type with these attrs
      if ($from.parent.type === nodeType) {
        if (!attrs) return null
        // Check if attrs already match
        const allMatch = Object.entries(attrs).every(([k, v]) => $from.parent.attrs[k] === v)
        if (allMatch) return null
      }
      const tr = state.tr()
      tr.delete(start, end)
      tr.setBlockType(start, start, nodeType, attrs ?? null)
      return tr
    },
  }
}

/**
 * Create an input rule that wraps the current textblock in a wrapper node
 * when a pattern is typed at the start of a block.
 */
export function wrapRule(match: RegExp, nodeType: NodeType, attrs?: Record<string, unknown>): InputRule {
  return {
    match,
    handler: (state, _match, start, end) => {
      const $from = state.doc.resolve(start)
      // Only apply at the start of a textblock
      if ($from.parentOffset !== 0 && start !== $from.start()) return null
      // Don't wrap if already wrapped in this type
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type === nodeType) return null
      }
      const tr = state.tr()
      tr.delete(start, end)
      const $pos = tr.doc.resolve(start)
      const range = $pos.blockRange()
      if (!range) return null
      tr.wrap(range, [{ type: nodeType, attrs: attrs ?? null }])
      return tr
    },
  }
}

/**
 * Create an input rule that replaces the current textblock with a
 * different node entirely (e.g. `---` → horizontal_rule).
 */
export function nodeRule(match: RegExp, nodeType: NodeType, attrs?: Record<string, unknown>): InputRule {
  return {
    match,
    handler: (state, _match, start, end) => {
      const $from = state.doc.resolve(start)
      // Only apply when the match IS the entire textblock content
      if ($from.parentOffset !== 0 && start !== $from.start()) return null
      // The match should span the entire textblock content
      const blockStart = $from.before()
      const blockEnd = $from.after()
      const tr = state.tr()
      tr.replaceWith(blockStart, blockEnd, nodeType.create(attrs ?? null))
      return tr
    },
  }
}

/**
 * Create heading input rules for a schema.
 * Matches `# `, `## `, `### ` etc. at the start of a textblock.
 */
export function headingRule(nodeType: NodeType, maxLevel = 6): InputRule[] {
  const rules: InputRule[] = []
  for (let level = 1; level <= maxLevel; level++) {
    const hashes = '#'.repeat(level)
    rules.push(blockTypeRule(new RegExp(`^${hashes}\\s$`), nodeType, { level }))
  }
  return rules
}

/**
 * Horizontal rule input rule: `---` (followed by space or at line end) → hr.
 */
export function horizontalRuleRule(nodeType: NodeType): InputRule {
  return nodeRule(/^---$/, nodeType)
}

/**
 * Code block input rule: ``` at start of line → code_block.
 */
export function codeBlockRule(nodeType: NodeType): InputRule {
  return blockTypeRule(/^```$/, nodeType)
}

/**
 * Blockquote input rule: `> ` at start of line → blockquote.
 */
export function blockquoteRule(nodeType: NodeType): InputRule {
  return wrapRule(/^>\s$/, nodeType)
}

// ─── List input rules ───────────────────────────────────────────────────────

/**
 * Bullet list input rule: `- ` or `* ` at start of line → wrap in bullet_list.
 */
export function bulletListRule(listType: NodeType, itemType: NodeType): InputRule {
  return listWrapRule(/^[-*]\s$/, listType, itemType)
}

/**
 * Ordered list input rule: `1. ` (or any number followed by `. `) at start → wrap in ordered_list.
 */
export function orderedListRule(listType: NodeType, itemType: NodeType): InputRule {
  return listWrapRule(/^(\d+)\.\s$/, listType, itemType, (match) => ({
    order: Number(match[1]),
  }))
}

/**
 * Create an input rule that wraps the current textblock in a list
 * when a pattern is typed at the start.
 */
function listWrapRule(
  match: RegExp,
  listType: NodeType,
  itemType: NodeType,
  getAttrs?: (match: RegExpMatchArray) => Record<string, unknown>,
): InputRule {
  return {
    match,
    handler: (state, ruleMatch, start, end) => {
      const $from = state.doc.resolve(start)
      // Only apply at the start of a textblock
      if ($from.parentOffset !== 0 && start !== $from.start()) return null
      // Don't apply if already inside a list
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type === listType) return null
      }

      const tr = state.tr()
      tr.delete(start, end)

      const $pos = tr.doc.resolve(start)
      const range = $pos.blockRange()
      if (!range) return null

      const wrappers = findWrapping(range, listType, getAttrs?.(ruleMatch) ?? null)
      if (!wrappers) return null

      tr.wrap(range, wrappers)
      return tr
    },
  }
}

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
            // Calculate the start position of the match in the document.
            // fullText = textBefore + text. The match starts at match.index
            // in fullText, so the document position is:
            //   from - textBefore.length + match.index
            // where textBefore.length = fullText.length - text.length
            const matchStart = from - (fullText.length - text.length) + match.index
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
