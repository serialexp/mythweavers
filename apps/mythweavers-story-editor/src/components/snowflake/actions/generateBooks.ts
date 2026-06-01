// Story concept -> N books, each seeded with its arcs.
//
// The model returns one block per book, blocks separated by a line containing
// only "===". Within a block the first non-empty line is the book's one-liner
// and the remaining lines are its arc movements (often bulleted). We create a
// book per block and an arc per arc-line, writing each summary onto the node.

import { errorStore } from '../../../stores/errorStore'
import { nodeStore } from '../../../stores/nodeStore'
import { runSnowflakePrompt } from '../ai'
import { SNOWFLAKE_EXPAND_STORY } from '../prompts'
import { snowflakeStore } from '../store'
import { deriveTitle, fallbackTitle, parseGeneratedBooks, rootBooks } from './helpers'

const STORY_KEY = 'story'

export async function generateBooks(storyConcept: string, bookCount: number): Promise<void> {
  if (storyConcept.trim().length === 0) {
    errorStore.addError('Write a story concept before generating books.', 'warning')
    return
  }

  snowflakeStore.setLoading(STORY_KEY, true)
  try {
    const raw = await runSnowflakePrompt({
      system: SNOWFLAKE_EXPAND_STORY,
      instruction: `Overarching story concept:\n${storyConcept.trim()}\n\nGenerate ${bookCount} book summaries that together tell a complete story. Separate each book with a line containing only "===".`,
      callType: 'outline:expand',
    })

    const books = parseGeneratedBooks(raw)
    if (books.length === 0) {
      errorStore.addError('The model returned no usable books. Try again.', 'error')
      return
    }

    const existingBookCount = rootBooks().length
    books.forEach((book, bookIdx) => {
      const bookNode = nodeStore.addNode(
        null,
        'book',
        deriveTitle(book.summary, fallbackTitle('book', existingBookCount + bookIdx)),
      )
      nodeStore.updateNode(bookNode.id, { summary: book.summary })

      book.arcs.forEach((arcSummary, arcIdx) => {
        const arcNode = nodeStore.addNode(bookNode.id, 'arc', deriveTitle(arcSummary, fallbackTitle('arc', arcIdx)))
        nodeStore.updateNode(arcNode.id, { summary: arcSummary })
      })
    })
  } catch (error) {
    console.error('[snowflake] generateBooks failed:', error)
    errorStore.addError(`Failed to generate books: ${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    snowflakeStore.setLoading(STORY_KEY, false)
  }
}
