import { toggleMark } from 'prosemirror-commands'
import { EditorState, Transaction } from 'prosemirror-state'
import { contentSchema } from '../schema'

/**
 * Toggle translation mark on selected text
 *
 * If the mark exists, it removes it.
 * If the mark doesn't exist, it adds it with the given language pair.
 *
 * Note: This function only manages the mark itself. For AI-powered translation,
 * the parent app should handle calling the translation service and updating the mark
 * with the translated text.
 */
export function toggleTranslationMark(
  options: {
    from: string
    to: string
    translatedText?: string // Optional: pre-translated text to add to the mark
  },
  state: EditorState,
  dispatch: (tr: Transaction) => void,
) {
  const translationMarkType = contentSchema.marks.translation
  const { from, to } = state.selection
  const hasMark = state.doc.rangeHasMark(from, to, translationMarkType)

  if (hasMark) {
    // Remove the mark
    return toggleMark(translationMarkType)(state, dispatch)
  }

  // Add the mark with language pair and optional translation
  const attrs = {
    title: options.translatedText || '', // Empty if translation not provided yet
    from: options.from,
    to: options.to,
  }

  return toggleMark(translationMarkType, attrs)(state, dispatch)
}

/**
 * Helper to get selected text for translation
 */
export function getSelectedTextForTranslation(state: EditorState): string {
  const { from, to } = state.selection
  return state.doc.textBetween(from, to, ' ')
}
