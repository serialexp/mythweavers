import type { Node } from '@writer/shared'
import { contentSchemaToText } from '../../../lib/persistence/content-schema-to-html'
import { addNotification } from '../../../lib/stores/notifications'
import { createScene, scenesState } from '../../../lib/stores/scenes'
import { findPathToNode, updateNode } from '../../../lib/stores/tree'
import { useAi } from '../../../lib/use-ai'
import { setLoadingStates } from '../store'
import { getNodeContext } from './getNodeContext'

export const expandChapter = async (node: Node) => {
  if (!node.oneliner) {
    addNotification({
      type: 'error',
      title: 'Missing Summary',
      message: 'Please add a one-line summary for the chapter first.',
    })
    return
  }

  setLoadingStates({ [node.id]: true })
  try {
    const _context = getNodeContext(node)
    const path = findPathToNode(node.id)
    const [book, arc, chapter] = path

    // Get surrounding chapters, including across arcs
    const arcIndex = book.children?.findIndex((a) => a.id === arc.id) ?? -1
    const chapterIndex = arc.children?.findIndex((c) => c.id === chapter.id) ?? -1

    let prevChapter = null
    let nextChapter = null

    // Try to get previous chapter from current arc
    if (chapterIndex > 0) {
      prevChapter = arc.children?.[chapterIndex - 1]
    }
    // If we're at the start of an arc, get the last chapter of previous arc
    else if (arcIndex > 0) {
      const prevArc = book.children?.[arcIndex - 1]
      if (prevArc?.children?.length) {
        prevChapter = prevArc.children[prevArc.children.length - 1]
      }
    }

    // Try to get next chapter from current arc
    if (chapterIndex < (arc.children?.length ?? 0) - 1) {
      nextChapter = arc.children?.[chapterIndex + 1]
    }
    // If we're at the end of an arc, get the first chapter of next arc
    else if (arcIndex < (book.children?.length ?? 0) - 1) {
      const nextArc = book.children?.[arcIndex + 1]
      if (nextArc?.children?.length) {
        nextChapter = nextArc.children[0]
      }
    }

    // Get the last scene of the previous chapter and first scene of the next chapter
    let prevChapterLastScene = ''
    let nextChapterFirstScene = ''

    if (prevChapter?.children?.length) {
      const lastScene = prevChapter.children[prevChapter.children.length - 1]
      // First try to get the scene content
      const sceneContent = scenesState.scenes[lastScene.id]?.paragraphs
      if (sceneContent?.length) {
        const lastParagraph = sceneContent[sceneContent.length - 1]
        prevChapterLastScene =
          typeof lastParagraph.text === 'string' ? lastParagraph.text : contentSchemaToText(lastParagraph.text)
      } else if (lastScene?.oneliner) {
        // Fall back to oneliner if no content
        prevChapterLastScene = lastScene.oneliner
      }
    }

    if (nextChapter?.children?.length) {
      const firstScene = nextChapter.children[0]
      // First try to get the scene content
      const sceneContent = scenesState.scenes[firstScene.id]?.paragraphs
      if (sceneContent?.length) {
        const firstParagraph = sceneContent[0]
        nextChapterFirstScene =
          typeof firstParagraph.text === 'string' ? firstParagraph.text : contentSchemaToText(firstParagraph.text)
      } else if (firstScene?.oneliner) {
        // Fall back to oneliner if no content
        nextChapterFirstScene = firstScene.oneliner
      }
    }

    const prompt = [
      '<story_context>',
      `Book: ${book.oneliner}`,
      `Arc: ${arc.oneliner}`,
      '</story_context>',
      '',
      prevChapter && ['<previous_chapter>', prevChapter.oneliner, '</previous_chapter>', ''].join('\n'),
      '<current_chapter>',
      node.oneliner,
      '</current_chapter>',
      '',
      nextChapter && ['<next_chapter>', nextChapter.oneliner, '</next_chapter>', ''].join('\n'),
      prevChapterLastScene && ['<previous_scene>', prevChapterLastScene, '</previous_scene>', ''].join('\n'),
      nextChapterFirstScene && ['<next_scene>', nextChapterFirstScene, '</next_scene>', ''].join('\n'),
      '<instructions>',
      "Generate a sequence of scenes that tell this chapter's story.",
      '</instructions>',
    ]
      .filter(Boolean)
      .join('\n')

    const summaries = await useAi('snowflake_expand_chapter', prompt)
    const sceneSummaries = summaries.split('\n').filter((s: string) => s.trim())

    for (const summary of sceneSummaries) {
      const scene = await createScene(node.id)
      updateNode(scene.id, { oneliner: summary.trim() })
    }
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      title: 'Failed to expand chapter',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  } finally {
    setLoadingStates({ [node.id]: false })
  }
}
