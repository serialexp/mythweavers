import { contentSchemaToText } from '../../../lib/persistence/content-schema-to-html'
import { scenesState } from '../../../lib/stores/scenes'
import { findPathToNode, treeState } from '../../../lib/stores/tree'

// Add this function to get the previous scene's content
const _getPreviousSceneContent = async (node: Node) => {
  const path = findPathToNode(node.id)
  if (!path) return null

  const [bookNode, arcNode, chapterNode] = path
  const book = treeState.structure.find((b) => b.id === bookNode.id)
  const arc = book?.children?.find((a) => a.id === arcNode.id)
  const chapters = arc?.children ?? []
  const currentChapter = chapters.find((c) => c.id === chapterNode.id)
  if (!currentChapter) return null

  const scenes = currentChapter.children ?? []
  const currentSceneIndex = scenes.findIndex((s) => s.id === node.id)

  // Get previous scene, either from current chapter or last scene of previous chapter
  let previousScene
  if (currentSceneIndex > 0) {
    previousScene = scenes[currentSceneIndex - 1]
  } else {
    const chapterIndex = chapters.findIndex((c) => c.id === chapterNode.id)
    if (chapterIndex > 0) {
      const previousChapter = chapters[chapterIndex - 1]
      const previousChapterScenes = previousChapter.children ?? []
      previousScene = previousChapterScenes[previousChapterScenes.length - 1]
    }
  }

  if (!previousScene) return null

  // Get the actual content of the previous scene
  const previousSceneData = scenesState.scenes[previousScene.id]
  if (!previousSceneData?.paragraphs.length) return null

  return previousSceneData.paragraphs
    .map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text)))
    .join('\n\n')
}
