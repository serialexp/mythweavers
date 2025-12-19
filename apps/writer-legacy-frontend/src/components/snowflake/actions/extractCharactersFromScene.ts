import type { Node } from '@writer/shared'
import { contentSchemaToText } from '../../../lib/persistence/content-schema-to-html'
import { addNotification } from '../../../lib/stores/notifications'
import { scenesState, updateSceneData } from '../../../lib/stores/scenes'
import { setLoadingStates } from '../store'
import { extractNewCharacters } from './extractNewCharacters'

export const extractCharactersFromScene = async (node: Node) => {
  if (!node.oneliner) return

  setLoadingStates({ [`${node.id}_chars`]: true })
  try {
    const currentSceneData = scenesState.scenes[node.id]

    const sceneContent = currentSceneData.paragraphs
      .map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text)))
      .join('\n')

    const { presentCharacters, mentionedCharacters } = await extractNewCharacters([
      sceneContent && sceneContent.length > 0 ? sceneContent : node.oneliner,
    ])

    // Update the scene with the new character IDs
    updateSceneData(node.id, {
      characterIds: [...(currentSceneData.characterIds || []), ...presentCharacters.map((char) => char.id)],
      referredCharacterIds: [
        ...(currentSceneData.referredCharacterIds || []),
        ...mentionedCharacters.map((char) => char.id),
      ],
    })

    if (presentCharacters.length === 0 && mentionedCharacters.length === 0) {
      addNotification({
        type: 'info',
        title: 'No New Characters',
        message: 'No new characters found in this scene.',
      })
    } else {
      addNotification({
        type: 'info',
        title: 'Characters Extracted',
        message: `Found ${presentCharacters.length} present and ${mentionedCharacters.length} mentioned characters.`,
      })
    }
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      title: 'Failed to extract characters',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  } finally {
    setLoadingStates({ [`${node.id}_chars`]: false })
  }
}
