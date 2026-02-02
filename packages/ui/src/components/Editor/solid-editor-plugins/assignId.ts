import { Plugin, PluginKey } from '@writer/solid-editor'
import shortUUID from 'short-uuid'

const assignIdPluginKey = new PluginKey<null>('assignId')

/**
 * Plugin that automatically assigns UUIDs to paragraphs that don't have an ID,
 * and fixes duplicate IDs (which can happen when splitting a paragraph with Enter).
 * This ensures every paragraph has a unique identifier for tracking.
 */
export function createAssignIdPlugin(): Plugin<null> {
  return new Plugin({
    key: assignIdPluginKey,

    // Use appendTransaction to add IDs to any paragraphs missing them or with duplicates
    appendTransaction: (transactions, _oldState, newState) => {
      // Only process if doc changed
      const docChanged = transactions.some((tr) => tr.docChanged)
      if (!docChanged) return null

      // Find paragraphs without IDs or with duplicate IDs
      const paragraphsToFix: Array<{ pos: number; node: typeof newState.doc }> = []
      const seenIds = new Set<string>()

      newState.doc.descendants((node, pos) => {
        if (node.type.name === 'paragraph') {
          const id = node.attrs.id as string | undefined
          if (!id || seenIds.has(id)) {
            // No ID or duplicate ID - needs fixing
            paragraphsToFix.push({ pos, node: node as any })
          } else {
            seenIds.add(id)
          }
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
        const newId = shortUUID.generate()
        seenIds.add(newId) // Track to avoid generating duplicates
        tr.setNodeMarkup(pos, undefined, {
          ...newState.doc.nodeAt(pos)?.attrs,
          id: newId,
        })
      }

      // Mark this transaction as not undoable (internal change)
      tr.setMeta('addToHistory', false)

      return tr
    },
  })
}

export { assignIdPluginKey }
