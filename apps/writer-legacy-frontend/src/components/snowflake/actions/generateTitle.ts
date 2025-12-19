import type { Node } from '@writer/shared'
import { contentSchemaToText } from '../../../lib/persistence/content-schema-to-html'
import { updateArc } from '../../../lib/stores/arcs'
import { updateBookValue } from '../../../lib/stores/books'
import { updateChapter } from '../../../lib/stores/chapters'
import { addNotification } from '../../../lib/stores/notifications'
import { scenesState, updateSceneData } from '../../../lib/stores/scenes'
import { useAi } from '../../../lib/use-ai'
import { setLoadingStates } from '../store'

export const generateTitle = async (node: Node) => {
  setLoadingStates({ [`${node.id}_title`]: true })
  try {
    let content = ''

    if (node.type === 'scene') {
      // For scenes, use the actual scene content if available
      const scene = scenesState.scenes[node.id]
      if (scene?.paragraphs?.length) {
        content = scene.paragraphs
          .map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text)))
          .join('\n\n')
      }
    }

    // If no scene content or not a scene, use the oneliner
    if (!content && node.oneliner) {
      content = node.oneliner
    }

    if (!content) {
      throw new Error('No content available to generate title from')
    }

    const title = await useAi('snowflake_generate_title', content)
    const trimmedTitle = title.trim()

    // Update the appropriate store based on node type
    switch (node.type) {
      case 'book':
        updateBookValue(node.id, 'title', trimmedTitle)
        break
      case 'arc':
        updateArc(node.id, { title: trimmedTitle })
        break
      case 'chapter':
        updateChapter(node.id, { title: trimmedTitle })
        break
      case 'scene':
        updateSceneData(node.id, { title: trimmedTitle })
        break
    }
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      title: 'Failed to generate title',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  } finally {
    setLoadingStates({ [`${node.id}_title`]: false })
  }
}
