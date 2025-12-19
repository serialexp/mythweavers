import type { Node } from '@writer/shared'
import { arcsStore } from '../../../lib/stores/arcs'
import { createChapter } from '../../../lib/stores/chapters'
import { charactersState } from '../../../lib/stores/characters'
import { addNotification } from '../../../lib/stores/notifications'
import { storyState } from '../../../lib/stores/story'
import { findPathToNode, updateNode } from '../../../lib/stores/tree'
import { useAi } from '../../../lib/use-ai'
import { setLoadingStates } from '../store'
import { getNodeContext } from './getNodeContext'

export const expandArc = async (node: Node, chapterCount: number) => {
  if (!node.oneliner) {
    addNotification({
      type: 'error',
      title: 'Missing Summary',
      message: 'Please add a one-line summary for the arc first.',
    })
    return
  }

  setLoadingStates({ [node.id]: true })
  try {
    const context = getNodeContext(node)

    // Add character context to the prompt
    const _characterContext = Object.values(charactersState.characters)
      .map((char) => `${char.firstName} ${char.lastName}: ${char.summary}`)
      .join('\n')

    // Get highlights from the previous arc if it exists
    let previousArcHighlights = ''
    const path = findPathToNode(node.id)
    const book = path.find((n: Node) => n.type === 'book')
    if (book?.children) {
      const arcIndex = book.children.findIndex((a: Node) => a.id === node.id)
      if (arcIndex > 0) {
        const prevArcNode = book.children[arcIndex - 1]
        const prevArc = arcsStore.arcs[prevArcNode.id]
        if (prevArc?.highlights?.length) {
          previousArcHighlights = [
            '',
            'Important elements from the previous arc:',
            ...prevArc.highlights.map((h) => `- [${h.category}] ${h.text} (${h.importance})`),
            '',
          ].join('\n')
        }
      }
    }

    // Group previous arcs with their chapters
    const previousArcsWithChapters = (context.prevArcs || []).map((arc, arcIndex) => {
      const arcChapters = (context.previousChapters || [])
        .filter((chapter) => chapter.startsWith(`Arc ${arcIndex + 1}, `))
        .map((chapter) => chapter.replace(`Arc ${arcIndex + 1}, `, ''))

      return [
        `Arc ${arcIndex + 1}: ${arc}`,
        ...(arcChapters.length ? ['Chapters:', ...arcChapters] : []),
        '', // Empty line between arcs
      ].join('\n')
    })

    const prompt = [
      '<story_context>',
      `${storyState.story?.oneliner ?? ''}`,
      '</story_context>',
      '',
      '<previous_arcs>',
      ...previousArcsWithChapters,
      '</previous_arcs>',
      '',
      previousArcHighlights
        ? ['<previous_arc_highlights>', previousArcHighlights, '</previous_arc_highlights>', ''].join('\n')
        : '',
      '<current_arc>',
      `${node.oneliner}`,
      '</current_arc>',
      '',
      context.nextArcSummary ? ['<next_arc>', context.nextArcSummary, '</next_arc>', ''].join('\n') : '',
      '<instructions>',
      `Generate ${chapterCount} chapters for this arc.`,
      '</instructions>',
    ]
      .filter(Boolean)
      .join('\n')

    console.log(prompt)
    const summaries = await useAi('snowflake_expand_arc', prompt)
    const chapterSummaries = summaries.split('\n').filter((s: string) => s.trim())

    // Create the chapters without character extraction
    for (const summary of chapterSummaries) {
      const chapter = await createChapter(node.id)
      updateNode(chapter.id, { oneliner: summary.trim() })
    }
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      title: 'Failed to expand arc',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  } finally {
    setLoadingStates({ [node.id]: false })
  }
}
