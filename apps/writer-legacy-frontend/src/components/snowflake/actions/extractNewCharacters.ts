import { charactersState, createCharacter, updateCharacterProperty } from '../../../lib/stores/characters'
import { addNotification } from '../../../lib/stores/notifications'
import { useAi } from '../../../lib/use-ai'

export const extractNewCharacters = async (sceneSummaries: string[]) => {
  // Get existing characters with their descriptions
  const existingCharacters = Object.values(charactersState.characters).map((char) => {
    const fullName = [char.firstName, char.middleName, char.lastName].filter(Boolean).join(' ')
    return `${fullName}: ${char.summary}`
  })

  // Create prompt with context about existing characters
  const prompt = [
    'Existing Characters:',
    ...existingCharacters,
    '',
    'Scene Summary:',
    ...sceneSummaries,
    '',
    'Extract characters from the scene summary, distinguishing between characters who are present in the scene and those who are only mentioned.',
    'Format: [PRESENT/MENTIONED]|Name|Description',
  ].join('\n')

  // Extract characters from the summaries
  const characterData = await useAi('snowflake_extract_characters', prompt)

  console.log('characterData', characterData)
  // Process each character
  const existingNames = new Set(
    Object.values(charactersState.characters).map((char) =>
      [char.firstName, char.middleName, char.lastName].filter(Boolean).join(' ').toLowerCase().trim(),
    ),
  )

  const presentCharacters: Array<{ id: string }> = []
  const mentionedCharacters: Array<{ id: string }> = []

  const lines = characterData.split('\n').filter((line) => line.trim())

  for (const line of lines) {
    const [presence, name, description] = line.split('|').map((s) => s.trim())
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

    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').toLowerCase().trim()

    if (!existingNames.has(fullName)) {
      const characterId = await createCharacter()
      updateCharacterProperty(characterId, 'firstName', firstName)
      if (middleName) {
        updateCharacterProperty(characterId, 'middleName', middleName)
      }
      if (lastName) {
        updateCharacterProperty(characterId, 'lastName', lastName)
      }
      updateCharacterProperty(characterId, 'summary', description)
      updateCharacterProperty(characterId, 'isMainCharacter', false) // New characters from scenes are side characters by default

      const displayName = [firstName, middleName, lastName].filter(Boolean).join(' ')

      addNotification({
        type: 'info',
        title: 'New Character Added',
        message: `Created ${presence.toLowerCase()} character: ${displayName}`,
      })

      if (presence.toUpperCase() === 'PRESENT') {
        presentCharacters.push({ id: characterId })
      } else {
        mentionedCharacters.push({ id: characterId })
      }
    }
  }

  return { presentCharacters, mentionedCharacters }
}
