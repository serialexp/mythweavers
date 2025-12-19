import type { Character } from '@writer/shared'

export interface CharacterVersion {
  character: Character
  type: 'past' | 'current' | 'future'
  index: number // Index within its type group (e.g., Past Timeline 1, 2, etc.)
}

export function getAllCharacterVersions(
  characterId: string | null,
  characters: Record<string, Character>,
): CharacterVersion[] {
  if (!characterId) return []

  const getEarlierVersion = (charId: string): Character | null => {
    const char = characters[charId]
    return char?.laterVersionOf ? characters[char.laterVersionOf] : null
  }

  const getLaterVersions = (charId: string): Character[] => {
    return Object.values(characters).filter((char) => char.laterVersionOf === charId)
  }

  // Get all later versions recursively
  const getAllLaterVersions = (charId: string): Character[] => {
    const directLaterVersions = getLaterVersions(charId)
    return directLaterVersions.reduce(
      (acc, version) => [...acc, version, ...getAllLaterVersions(version.id)],
      [] as Character[],
    )
  }

  // Get past versions (oldest to newest)
  const pastVersions: Character[] = []
  let currentVersion = getEarlierVersion(characterId)
  while (currentVersion) {
    pastVersions.unshift(currentVersion)
    currentVersion = getEarlierVersion(currentVersion.id)
  }

  // Get future versions
  const futureVersions = getAllLaterVersions(characterId)

  // Combine all versions with their types
  const allVersions: CharacterVersion[] = [
    ...pastVersions.map((char, index) => ({
      character: char,
      type: 'past' as const,
      index: index + 1,
    })),
    {
      character: characters[characterId],
      type: 'current' as const,
      index: 0,
    },
    ...futureVersions.map((char, index) => ({
      character: char,
      type: 'future' as const,
      index: index + 1,
    })),
  ]

  return allVersions
}
