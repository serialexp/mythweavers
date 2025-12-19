import { baseKeymap, toggleMark } from 'prosemirror-commands'
import { history, redo, undo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { createEffect, onCleanup } from 'solid-js'
import './style.css'
import type { ContentNode } from '@writer/shared'
import { ellipsis, emDash, inputRules, smartQuotes } from 'prosemirror-inputrules'
import type { Node } from 'prosemirror-model'
import { registerEditor, unregisterEditor } from '../../lib/stores/editor'
import { assignIdPlugin } from './plugins/assign-id'
import { inlineMenuPlugin } from './plugins/inline-menu'
import { contentSchema } from './schema'

const italic = toggleMark(contentSchema.marks.em)

export const Editor = (props: {
  paragraphId?: string
  defaultValue: object | string
  onChange: (data: ContentNode) => void
}) => {
  let containerRef: HTMLDivElement | undefined
  let view: EditorView | undefined

  onCleanup(() => {
    console.log('onCleanup', props.paragraphId)
    if (props.paragraphId) {
      unregisterEditor(props.paragraphId)
    }
    if (view) {
      view.destroy()
    }
  })

  createEffect(() => {
    console.log('createEffect', props.paragraphId)
    if (!props.paragraphId || view) return

    // Create a new div element for the editor
    const editorNode = document.createElement('div')
    editorNode.className = 'editor'
    containerRef?.appendChild(editorNode)

    let doc: Node
    if (typeof props.defaultValue === 'string') {
      doc = contentSchema.node(
        'doc',
        null,
        contentSchema.node('paragraph', null, !props.defaultValue ? [] : [contentSchema.text(props.defaultValue)]),
      )
    } else {
      doc = contentSchema.nodeFromJSON(props.defaultValue)
    }

    const state = EditorState.create({
      doc: doc,
      schema: contentSchema,
      plugins: [
        history(),
        keymap({
          'Mod-z': undo,
          'Mod-y': redo,
          'Mod-i': italic,
          'Control-Enter': () => {
            console.log('new paragraph editor shortcut')
            return true
          },
        }),
        keymap(baseKeymap),
        inlineMenuPlugin,
        assignIdPlugin,
        inputRules({ rules: smartQuotes.concat([emDash, ellipsis]) }),
      ],
    })

    view = new EditorView(editorNode, {
      state,
      dispatchTransaction(transaction) {
        const newState = view!.state.apply(transaction)
        view!.updateState(newState)
        if (transaction.docChanged) {
          props.onChange(newState.doc.toJSON())
        }
      },
    })

    registerEditor(props.paragraphId, view)
  })

  return <div ref={containerRef} />
}
