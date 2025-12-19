import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { getParagraphIdAtPos, getParagraphRange } from '../utils/paragraph-conversion'

const activeParagraphPluginKey = new PluginKey('activeParagraph')

interface ActiveParagraphState {
  currentParagraphId: string | null
}

export function createActiveParagraphPlugin() {
  return new Plugin<ActiveParagraphState>({
    key: activeParagraphPluginKey,

    state: {
      init(): ActiveParagraphState {
        return { currentParagraphId: null }
      },

      apply(tr, state): ActiveParagraphState {
        // Only check selection changes, not all transactions
        if (tr.selectionSet) {
          const paragraphId = getParagraphIdAtPos(tr.doc, tr.selection.from)
          // Only return new state if paragraph actually changed
          if (paragraphId !== state.currentParagraphId) {
            return { currentParagraphId: paragraphId }
          }
        }
        return state
      },
    },

    props: {
      decorations(state) {
        const pluginState = activeParagraphPluginKey.getState(state)
        if (!pluginState?.currentParagraphId) {
          return DecorationSet.empty
        }

        // Find the paragraph range for the current paragraph
        const range = getParagraphRange(state.doc, pluginState.currentParagraphId)
        if (!range) {
          return DecorationSet.empty
        }

        // Create a node decoration that adds the active-paragraph class
        const decoration = Decoration.node(range.from, range.to, {
          class: 'active-paragraph',
        })

        return DecorationSet.create(state.doc, [decoration])
      },
    },
  })
}
