import { ContentNode } from '@writer/shared'
import { toggleMark } from 'prosemirror-commands'
import { EditorState, Transaction } from 'prosemirror-state'
import { contentSchemaToText } from '../../../lib/persistence/content-schema-to-html'
import { useAi } from '../../../lib/use-ai'
import { contentSchema } from '../schema'

const TRANSLATION_LANGUAGES = ['en', 'nl', 'gd', 'de']
const TRANSLATION_LANGUAGES_NAMES = ['English', 'Dutch', 'Scots Gaelic', 'German']

export function toggleTranslationMark(
  options: {
    from: string
    to: string
  },
  state: EditorState,
  dispatch: (tr: Transaction) => void,
) {
  const translationMarkType = contentSchema.marks.translation
  const { from, to } = state.selection
  const hasMark = state.doc.rangeHasMark(from, to, translationMarkType)

  if (hasMark) {
    return toggleMark(translationMarkType)(state, dispatch)
  }

  const fromLanguage = TRANSLATION_LANGUAGES_NAMES[TRANSLATION_LANGUAGES.indexOf(options.from)]
  const toLanguage = TRANSLATION_LANGUAGES_NAMES[TRANSLATION_LANGUAGES.indexOf(options.to)]
  console.log('current doc', state.doc.toJSON())
  useAi(
    'free',
    `<paragraph>${contentSchemaToText(state.doc.toJSON() as unknown as ContentNode, {
      translationsInline: true,
    })}</paragraph>\n\nTranslate the following text from ${fromLanguage} to ${toLanguage}. Try to keep the original meaning and tone. You can refer the full paragraph earlier for context. Output only the translation, nothing else:\n\n${state.doc.textBetween(
      from,
      to,
      ' ',
    )}`,
    false,
  ).then((res) => {
    if (res) {
      const attrs = { title: res, from: options.from, to: options.to }
      return toggleMark(translationMarkType, attrs)(state, dispatch)
    }
  })

  return false
}
