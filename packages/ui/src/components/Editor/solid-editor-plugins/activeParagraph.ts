import { DecorationSet, Plugin, PluginKey, node as nodeDecoration } from '@writer/solid-editor'
import { getParagraphIdAtPos, getParagraphRange } from '../solid-editor/paragraph-conversion'

const activeParagraphPluginKey = new PluginKey<ActiveParagraphState>('activeParagraph')

interface ActiveParagraphState {
  currentParagraphId: string | null
}

/**
 * Plugin that tracks which paragraph the cursor is in and adds an
 * "active-paragraph" class decoration to it.
 */
export function createActiveParagraphPlugin(): Plugin<ActiveParagraphState> {
  return new Plugin({
    key: activeParagraphPluginKey,

    state: {
      init: (): ActiveParagraphState => ({ currentParagraphId: null }),

      apply: (tr, state): ActiveParagraphState => {
        // Only check selection changes
        if (tr.selectionSet || tr.docChanged) {
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
      decorations: (state) => {
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
        const decoration = nodeDecoration(range.from, range.to, {
          class: 'active-paragraph',
        })

        return DecorationSet.create(state.doc, [decoration])
      },
    },
  })
}

export { activeParagraphPluginKey }
