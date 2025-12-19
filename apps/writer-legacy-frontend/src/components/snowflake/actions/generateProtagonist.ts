import type { Node } from '@writer/shared'
import { createCharacter, updateCharacterProperty } from '../../../lib/stores/characters'
import { addNotification } from '../../../lib/stores/notifications'
import { useAi } from '../../../lib/use-ai'
import { setLoadingStates } from '../store'

export const generateProtagonist = async (node: Node) => {
  if (!node.oneliner) {
    addNotification({
      type: 'error',
      title: 'Missing Summary',
      message: 'Please add a one-line summary for the book first.',
    })
    return
  }

  setLoadingStates({ [`${node.id}_char`]: true })
  try {
    const description = await useAi('snowflake_create_protagonist', node.oneliner)

    // Split the response into its three parts
    const [name, age, traits] = description
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.trim())

    // Split the name into parts
    const nameParts = name.split(/\s+/)
    let firstName: string
    let middleName: string | undefined
    let lastName: string | undefined

    if (nameParts.length === 1) {
      firstName = nameParts[0]
    } else if (nameParts.length === 2) {
      ;[firstName, lastName] = nameParts
    } else if (nameParts.length > 2) {
      firstName = nameParts[0]
      lastName = nameParts[nameParts.length - 1]
      middleName = nameParts.slice(1, -1).join(' ')
    } else {
      firstName = name // Fallback case
    }

    // Create a new character
    const characterId = await createCharacter()

    // Update the character with the parsed info
    updateCharacterProperty(characterId, 'firstName', firstName)
    if (middleName) {
      updateCharacterProperty(characterId, 'middleName', middleName)
    }
    if (lastName) {
      updateCharacterProperty(characterId, 'lastName', lastName)
    }
    updateCharacterProperty(characterId, 'age', age)
    updateCharacterProperty(characterId, 'summary', traits)

    const displayName = [firstName, middleName, lastName].filter(Boolean).join(' ')

    addNotification({
      type: 'success',
      title: 'Character Created',
      message: `Created protagonist: ${displayName}`,
    })
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      title: 'Failed to generate character',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  } finally {
    setLoadingStates({ [`${node.id}_char`]: false })
  }
}
