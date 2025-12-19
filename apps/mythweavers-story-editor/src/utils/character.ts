import type { Character } from '../types/core'

/**
 * Get the full display name for a character
 * Combines firstName, middleName, and lastName
 */
export function getCharacterDisplayName(character: Character): string {
  return [character.firstName, character.middleName, character.lastName].filter(Boolean).join(' ') || 'Unnamed'
}

/**
 * Get a short name for a character
 * Returns nickname if available, otherwise firstName
 */
export function getCharacterShortName(character: Character): string {
  return character.nickname || character.firstName || 'Unnamed'
}

/**
 * Parse a single name string into firstName/lastName components
 * Useful when saving from a single input field
 */
export function parseCharacterName(name: string): { firstName: string; lastName: string | null } {
  const trimmed = name.trim()
  if (!trimmed) {
    return { firstName: 'Unnamed', lastName: null }
  }

  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null }
  }

  // Last part is lastName, everything else is firstName
  const lastName = parts.pop()!
  const firstName = parts.join(' ')

  return { firstName, lastName }
}
