import type { Node } from '@writer/shared'
import { addNotification } from '../../../lib/stores/notifications'
import { setLoadingStates } from '../store'
import { generateParentSummary } from './generateParentSummary'
import { generateSceneSummary } from './generateSceneSummary'

export const generateFullSummary = async (node: Node) => {
  setLoadingStates({ [node.id]: true })
  try {
    if (!node.children?.length) {
      if (node.type === 'scene') {
        await generateSceneSummary(node.id)
      }
      return
    }

    if (node.type === 'book') {
      // First process all scenes in parallel
      const scenePromises: Promise<void>[] = []
      for (const arc of node.children) {
        for (const chapter of arc.children ?? []) {
          for (const scene of chapter.children ?? []) {
            if (!scene.oneliner) {
              scenePromises.push(generateSceneSummary(scene.id))
            }
          }
        }
      }
      await Promise.all(scenePromises)

      // Then process all chapters in parallel
      const chapterPromises: Promise<void>[] = []
      for (const arc of node.children) {
        for (const chapter of arc.children ?? []) {
          if (!chapter.oneliner) {
            chapterPromises.push(generateParentSummary(chapter))
          }
        }
      }
      await Promise.all(chapterPromises)

      // Then process all arcs in parallel
      const arcPromises = node.children.map((arc) => (!arc.oneliner ? generateParentSummary(arc) : Promise.resolve()))
      await Promise.all(arcPromises)

      // Finally process the book
      await generateParentSummary(node)
    } else if (node.type === 'arc') {
      // Process all scenes in parallel
      const scenePromises: Promise<void>[] = []
      for (const chapter of node.children) {
        for (const scene of chapter.children ?? []) {
          if (!scene.oneliner) {
            scenePromises.push(generateSceneSummary(scene.id))
          }
        }
      }
      await Promise.all(scenePromises)

      // Process all chapters in parallel
      const chapterPromises = node.children.map((chapter) =>
        !chapter.oneliner ? generateParentSummary(chapter) : Promise.resolve(),
      )
      await Promise.all(chapterPromises)

      // Finally process the arc
      await generateParentSummary(node)
    } else if (node.type === 'chapter') {
      // Process all scenes in parallel
      const scenePromises = (node.children ?? []).map((scene) =>
        !scene.oneliner ? generateSceneSummary(scene.id) : Promise.resolve(),
      )
      await Promise.all(scenePromises)

      // Then process the chapter
      await generateParentSummary(node)
    }
  } catch (error) {
    addNotification({
      type: 'error',
      title: 'Failed to generate summaries',
      message: error.message,
    })
  } finally {
    setLoadingStates({ [node.id]: false })
  }
}
