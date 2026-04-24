/**
 * Rich clipboard plugin — opt-in HTML copy/paste support.
 *
 * Without this plugin, the editor copies/pastes plain text only.
 * With it, copy puts both text/plain and text/html on the clipboard,
 * and paste parses text/html (falling back to text/plain).
 *
 * Pass a `ClipboardFilter` to restrict which node types and marks
 * are serialized/parsed:
 *
 *   richClipboard()                                   // everything
 *   richClipboard({ marks: ['strong', 'em'] })        // only bold + italic
 *   richClipboard({ nodes: ['paragraph', 'heading'] }) // only p + headings
 *   richClipboard({ marks: ['strong'], nodes: ['paragraph'] })
 */
import { Slice } from '../model'
import { Plugin } from '../state/plugin'
import { serializeFragment } from '../clipboard/serialize'
import { parseHtmlToSlice } from '../clipboard/parse'
import type { ClipboardFilter } from '../clipboard/types'
import type { EditorViewRef } from '../state/plugin'

export function richClipboard(filter?: ClipboardFilter): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        copy(view: EditorViewRef, event: Event): boolean {
          const clipEvent = event as ClipboardEvent
          const { from, to, empty } = view.state.selection
          if (empty) return false

          const slice = view.state.selection.content()
          clipEvent.clipboardData?.setData('text/plain', view.state.doc.textBetween(from, to, '\n\n'))
          clipEvent.clipboardData?.setData('text/html', serializeFragment(slice.content, filter))
          clipEvent.preventDefault()
          return true
        },

        cut(view: EditorViewRef, event: Event): boolean {
          const clipEvent = event as ClipboardEvent
          const { from, to, empty } = view.state.selection
          if (empty) return false

          const slice = view.state.selection.content()
          clipEvent.clipboardData?.setData('text/plain', view.state.doc.textBetween(from, to, '\n\n'))
          clipEvent.clipboardData?.setData('text/html', serializeFragment(slice.content, filter))
          clipEvent.preventDefault()

          const tr = view.state.tr()
          tr.deleteSelection()
          view.dispatch(tr)
          return true
        },

        paste(view: EditorViewRef, event: Event): boolean {
          const clipEvent = event as ClipboardEvent
          const html = clipEvent.clipboardData?.getData('text/html')

          if (html) {
            const slice = parseHtmlToSlice(view.state.schema, html, filter)
            if (slice !== Slice.empty) {
              clipEvent.preventDefault()
              const tr = view.state.tr()
              tr.replaceSelection(slice)
              view.dispatch(tr)
              return true
            }
          }

          // No HTML or empty parse result — let default plain-text handler run
          return false
        },
      },
    },
  })
}
