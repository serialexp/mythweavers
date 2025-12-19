import type { ContentNode } from '@mythweavers/shared'
import { baseKeymap, toggleMark } from 'prosemirror-commands'
import { history, redo, undo } from 'prosemirror-history'
import { ellipsis, emDash, inputRules, smartQuotes } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import type { Node } from 'prosemirror-model'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { createEffect, onCleanup } from 'solid-js'
import { assignIdPlugin } from './prosemirror-plugins/assign-id'
import { createInlineMenuPlugin } from './prosemirror-plugins/inline-menu'
import { contentSchema } from './schema'
import { editor } from './style.css'

const italic = toggleMark(contentSchema.marks.em)

export const Editor = (props: {
  paragraphId?: string
  defaultValue: object | string
  onChange: (data: ContentNode) => void
}) => {
  let containerRef: HTMLDivElement | undefined
  let view: EditorView | undefined

  onCleanup(() => {
    if (view) {
      view.destroy()
    }
  })

  createEffect(() => {
    console.log('createEffect', props.paragraphId)
    if (!props.paragraphId || view) return

    // Create a new div element for the editor
    const editorNode = document.createElement('div')
    editorNode.className = editor
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
        createInlineMenuPlugin(), // Use default config (bold only)
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
  })

  return <div ref={containerRef} />
}
