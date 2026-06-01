// Book -> 4 arcs. The model returns arc paragraphs separated by "===".

import { currentStoryStore } from '../../../stores/currentStoryStore'
import { errorStore } from '../../../stores/errorStore'
import { nodeStore } from '../../../stores/nodeStore'
import type { Node } from '../../../types/core'
import { runSnowflakePrompt } from '../ai'
import { SNOWFLAKE_EXPAND_BOOK } from '../prompts'
import { snowflakeStore } from '../store'
import {
  childrenOf,
  deriveTitle,
  fallbackTitle,
  parseDelimitedSummaries,
  siblingIndex,
  siblingsOf,
  summaryOf,
} from './helpers'

export async function expandBook(book: Node): Promise<void> {
  if (summaryOf(book).trim().length === 0) {
    errorStore.addError('Write a one-liner for this book before expanding it into arcs.', 'warning')
    return
  }

  snowflakeStore.setLoading(book.id, true)
  try {
    const siblings = siblingsOf(book)
    const index = siblingIndex(book)
    const previousBooks = siblings
      .slice(0, index)
      .map((b, i) => `Book ${i + 1}: ${summaryOf(b)}`)
      .join('\n')
    const upcomingBooks = siblings
      .slice(index + 1)
      .map((b, i) => `Book ${index + i + 2}: ${summaryOf(b)}`)
      .join('\n')

    const instruction = [
      `Overall Story: ${currentStoryStore.summary ?? ''}`,
      previousBooks ? `\nPrevious Books:\n${previousBooks}` : '',
      `\nCurrent Book (${index + 1}): ${summaryOf(book)}`,
      upcomingBooks ? `\nUpcoming Books:\n${upcomingBooks}` : '',
      '\nGenerate exactly 4 story arcs for the current book, separated by "===".',
    ]
      .filter(Boolean)
      .join('\n')

    const raw = await runSnowflakePrompt({
      system: SNOWFLAKE_EXPAND_BOOK,
      instruction,
      callType: 'outline:expand',
    })

    const arcs = parseDelimitedSummaries(raw)
    if (arcs.length === 0) {
      errorStore.addError('The model returned no arcs. Try again.', 'error')
      return
    }
    if (arcs.length !== 4) {
      errorStore.addError(
        `Expected 4 arcs but the model returned ${arcs.length}; creating what was returned.`,
        'warning',
      )
    }

    const existing = childrenOf(book.id).filter((n) => n.type === 'arc').length
    arcs.forEach((arcSummary, i) => {
      const arc = nodeStore.addNode(book.id, 'arc', deriveTitle(arcSummary, fallbackTitle('arc', existing + i)))
      nodeStore.updateNode(arc.id, { summary: arcSummary })
    })
  } catch (error) {
    console.error('[snowflake] expandBook failed:', error)
    errorStore.addError(`Failed to expand book: ${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    snowflakeStore.setLoading(book.id, false)
  }
}
