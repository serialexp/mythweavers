import { findPathToNode, treeState } from '../../../lib/stores/tree'

import type { Node } from '@writer/shared'

export const getNodeContext = (node: Node) => {
  const _tree = treeState.structure

  // Find the book by traversing up the tree
  const path = findPathToNode(node.id)
  const book = path.find((n) => n.type === 'book')

  if (!book) return { bookSummary: '' }

  if (node.type === 'book') {
    return { bookSummary: book.oneliner || '' }
  }

  // Find the arc
  const arc = path.find((n) => n.type === 'arc')

  if (!arc) return { bookSummary: book.oneliner || '' }

  if (node.type === 'arc') {
    // Find surrounding arcs and all previous chapters
    const arcIndex = book.children?.findIndex((a) => a.id === arc.id) ?? -1
    const prevArcs = book.children?.slice(0, arcIndex) || []
    const nextArc = book.children?.[arcIndex + 1]

    // Get ALL chapters from previous arcs
    const previousChapters = prevArcs.flatMap((prevArc, arcIndex) =>
      (prevArc.children || []).map(
        (chapter, chapterIndex) => `Arc ${arcIndex + 1}, Chapter ${chapterIndex + 1}: ${chapter.oneliner}`,
      ),
    )

    return {
      bookSummary: book.oneliner || '',
      prevArcs: prevArcs.map((a) => a.oneliner),
      previousChapters,
      nextArcSummary: nextArc?.oneliner || '',
    }
  }

  // Find the chapter
  const chapter = path.find((n) => n.type === 'chapter')

  if (!chapter)
    return {
      bookSummary: book.oneliner || '',
      arcSummary: arc.oneliner || '',
    }

  // Find surrounding chapters
  const chapterIndex = arc.children?.findIndex((c) => c.id === chapter.id) ?? -1
  const prevChapter = chapterIndex > 0 ? arc.children?.[chapterIndex - 1] : undefined
  const nextChapter = arc.children?.[chapterIndex + 1]

  return {
    bookSummary: book.oneliner || '',
    arcSummary: arc.oneliner || '',
    prevChapterSummary: prevChapter?.oneliner || '',
    nextChapterSummary: nextChapter?.oneliner || '',
  }
}
