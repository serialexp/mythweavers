import type { Node } from '@writer/shared'
import { unwrap } from 'solid-js/store'
import { contentSchemaToText } from '../../../lib/persistence/content-schema-to-html'
import { charactersState, updateCharacterProperty } from '../../../lib/stores/characters'
import { addNotification } from '../../../lib/stores/notifications'
import { scenesState } from '../../../lib/stores/scenes'
import { useAi } from '../../../lib/use-ai'
import { setLoadingStates } from '../store'

export const extractCharacterActions = async (node: Node) => {
  const scene = scenesState.scenes[node.id]
  if (!scene || !scene.characterIds?.length) return

  setLoadingStates({ [`${node.id}_actions`]: true })

  try {
    const sceneContent = scene.paragraphs
      .map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text)))
      .join('\n')

    // Create a map of character names to IDs for the AI to reference
    const characterInfo = scene.characterIds
      .map((id) => {
        const char = charactersState.characters[id]
        if (!char) return undefined
        const name = [char.firstName, char.middleName, char.lastName].filter(Boolean).join(' ')
        return {
          id,
          name: char.nickname ? `${name} "${char.nickname}"` : name,
        }
      })
      .filter(Boolean)

    const actionsData = await useAi('snowflake_extract_character_actions', [
      {
        text: `<characters>${characterInfo.map((char) => `${char?.id}: ${char?.name}`).join('\n')}</characters>`,
        canCache: false,
      },
      {
        text: sceneContent,
        canCache: true,
      },
    ])

    console.log('chara result', actionsData)

    const actions = JSON.parse(actionsData)

    // Update each character's significant actions
    for (const action of actions) {
      const character = charactersState.characters[action.characterId]
      if (!character) continue

      const significantActions = [...(unwrap(character.significantActions) ?? [])]
      significantActions.push({
        action: action.action,
        sceneId: node.id,
        timestamp: Date.now(),
      })

      updateCharacterProperty(action.characterId, 'significantActions', significantActions)
    }

    addNotification({
      type: 'success',
      title: 'Character Actions Extracted',
      message: `Added ${actions.length} significant actions to character histories.`,
    })
  } catch (error) {
    console.error('Error extracting character actions:', error)
    addNotification({
      type: 'error',
      title: 'Error',
      message: 'Failed to extract character actions from scene content.',
    })
  } finally {
    setLoadingStates({ [`${node.id}_actions`]: false })
  }
}
