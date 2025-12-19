import type { Node } from '@writer/shared'
import { contentSchemaToText } from '../../../lib/persistence/content-schema-to-html'
import { createLocation } from '../../../lib/stores/locations'
import { addNotification } from '../../../lib/stores/notifications'
import { scenesState } from '../../../lib/stores/scenes'
import { useAi } from '../../../lib/use-ai'
import { setLoadingStates } from '../store'

export const extractLocationFromScene = async (node: Node) => {
  const scene = scenesState.scenes[node.id]
  if (!scene) return

  setLoadingStates({ [`${node.id}_location`]: true })

  try {
    const sceneContent = scene.paragraphs
      .map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text)))
      .join('\n')

    console.log('cen', sceneContent)

    const locationData = await useAi('snowflake_extract_location', [{ text: sceneContent, canCache: false }])
    console.log('locationData', locationData)

    const location = JSON.parse(locationData)
    const locationId = await createLocation({
      name: location.name,
      description: location.description,
      picture: '',
    })

    addNotification({
      type: 'success',
      title: 'Location Extracted',
      message: `Location "${location.name}" has been created.`,
    })

    return locationId
  } catch (error) {
    console.error('Error extracting location:', error)
    addNotification({
      type: 'error',
      title: 'Error',
      message: 'Failed to extract location from scene content.',
    })
  } finally {
    setLoadingStates({ [`${node.id}_location`]: false })
  }
}
