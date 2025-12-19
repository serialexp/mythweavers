import { Plugin } from 'prosemirror-state'
import shortUUID from 'short-uuid'

export const assignIdPlugin = new Plugin({
  appendTransaction(_transactions, _oldState, newState) {
    let tr = newState.tr
    let modified = false

    newState.doc.descendants((node, pos) => {
      if (node.isBlock && !node.attrs.id) {
        const newAttrs = { ...node.attrs, id: shortUUID.generate() }
        tr = tr.setNodeMarkup(pos, undefined, newAttrs)
        modified = true
      }
    })

    return modified ? tr : null
  },
})
