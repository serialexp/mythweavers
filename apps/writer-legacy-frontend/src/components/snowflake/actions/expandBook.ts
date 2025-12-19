import { createArc } from '../../../lib/stores/arcs'
import { addNotification } from '../../../lib/stores/notifications'
import { storyState } from '../../../lib/stores/story'
import { treeState, updateNode } from '../../../lib/stores/tree'
import { useAi } from '../../../lib/use-ai'
import { setLoadingStates } from '../store'

import type { Node } from '@writer/shared'

export const expandBook = async (node: Node) => {
  if (!node.oneliner) {
    addNotification({
      type: 'error',
      title: 'Missing Summary',
      message: 'Please add a one-line summary for the book first.',
    })
    return
  }

  setLoadingStates({ [node.id]: true })
  try {
    // Find all books and their position in the series
    const allBooks = treeState.structure
    const currentBookIndex = allBooks.findIndex((b) => b.id === node.id)

    const prompt = [
      'Story Context:',
      `Overall Story: ${storyState.story?.oneliner ?? ''}`,
      '',
      'Previous Books:',
      ...allBooks.slice(0, currentBookIndex).map((b, i) => `Book ${i + 1}: ${b.oneliner}`),
      '',
      `Current Book (${currentBookIndex + 1}): ${node.oneliner}`,
      '',
      'Upcoming Books:',
      ...allBooks.slice(currentBookIndex + 1).map((b, i) => `Book ${currentBookIndex + 2 + i}: ${b.oneliner}`),
    ].join('\n')

    const summaries = await useAi('snowflake_expand_book', prompt)
    const arcSummaries = summaries
      .split('===')
      .map((s) => s.trim())
      .filter(Boolean)

    if (arcSummaries.length !== 4) {
      addNotification({
        type: 'error',
        title: 'Invalid AI Response',
        message: `Expected 4 arc summaries but received ${arcSummaries.length}`,
      })
      return
    }

    for (const summary of arcSummaries) {
      const arc = await createArc(node.id)
      updateNode(arc.id, { oneliner: summary.trim() })
    }
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      title: 'Failed to expand book',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  } finally {
    setLoadingStates({ [node.id]: false })
  }
}
