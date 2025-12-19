import type { Node } from '@writer/shared'
import { addNotification } from '../../../lib/stores/notifications'
import { storyState } from '../../../lib/stores/story'
import { treeState } from '../../../lib/stores/tree'
import { useAi } from '../../../lib/use-ai'
import { setBookRefinements, setLoadingStates } from '../store'

export const foreshadowBook = async (node: Node) => {
  if (!node.oneliner || !node.summaries?.some((s) => s.level === 3)) {
    return
  }

  // Find all books and their position in the series
  const allBooks = treeState.structure
  const currentBookIndex = allBooks.findIndex((b) => b.id === node.id)
  const futureBooks = allBooks.slice(currentBookIndex + 1)

  if (futureBooks.length === 0) {
    addNotification({
      type: 'warning',
      title: 'No Future Books',
      message: 'There are no future books to foreshadow.',
    })
    return
  }

  setLoadingStates({ [`${node.id}_foreshadow`]: true })
  try {
    const currentSynopsis = node.summaries.find((s) => s.level === 3)?.text
    const prompt = [
      'Story Context:',
      `Overall Story: ${storyState.story?.oneliner ?? ''}`,
      '',
      `Current Book Synopsis: ${currentSynopsis}`,
      '',
      'Future Books:',
      ...futureBooks.map((b, i) => `Book ${currentBookIndex + 2 + i}: ${b.oneliner}`),
    ].join('\n')

    const foreshadowedSynopsis = await useAi('snowflake_foreshadow_book', prompt)
    setBookRefinements({
      [node.id]: {
        text: foreshadowedSynopsis.trim(),
        level: 3,
      },
    })
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      title: 'Failed to foreshadow',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  } finally {
    setLoadingStates({ [`${node.id}_foreshadow`]: false })
  }
}
