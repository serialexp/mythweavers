import { Plugin, PluginKey } from '@writer/solid-editor'
import shortUUID from 'short-uuid'

const assignIdPluginKey = new PluginKey<null>('assignId')

/**
 * Plugin that automatically assigns UUIDs to paragraphs that don't have an ID.
 * This ensures every paragraph has a unique identifier for tracking.
 */
export function createAssignIdPlugin(): Plugin<null> {
  return new Plugin({
    key: assignIdPluginKey,

    // Use appendTransaction to add IDs to any paragraphs missing them
    appendTransaction: (transactions, _oldState, newState) => {
      // Only process if doc changed
      const docChanged = transactions.some((tr) => tr.docChanged)
      if (!docChanged) return null

      // Find paragraphs without IDs
      const paragraphsToFix: Array<{ pos: number; node: typeof newState.doc }> = []

      newState.doc.descendants((node, pos) => {
        if (node.type.name === 'paragraph' && !node.attrs.id) {
          paragraphsToFix.push({ pos, node: node as any })
        }
        return true
      })

      // If no paragraphs need fixing, return null
      if (paragraphsToFix.length === 0) return null

      // Create a transaction to set the IDs
      const tr = newState.tr()

      // Apply in reverse order to avoid position shifts affecting later changes
      for (let i = paragraphsToFix.length - 1; i >= 0; i--) {
        const { pos } = paragraphsToFix[i]
        tr.setNodeMarkup(pos, undefined, {
          ...newState.doc.nodeAt(pos)?.attrs,
          id: shortUUID.generate(),
        })
      }

      // Mark this transaction as not undoable (internal change)
      tr.setMeta('addToHistory', false)

      return tr
    },
  })
}

export { assignIdPluginKey }
