import type { Character } from '../types/core'

/**
 * Get the full display name for a character
 * Combines firstName, middleName, and lastName
 */
export function getCharacterDisplayName(character: Character): string {
  return [character.firstName, character.middleName, character.lastName].filter(Boolean).join(' ') || 'Unnamed'
}

export interface ViewpointResolution {
  /** The POV character, or undefined when there is nobody to show. */
  character: Character | undefined
  /** True when the scene names a viewpoint character rather than inheriting one. */
  isExplicit: boolean
  /**
   * True when the scene names a viewpoint character that no longer exists.
   * Callers should surface this rather than silently showing the protagonist:
   * the scene claims a POV we cannot resolve.
   */
  isDangling: boolean
}

/**
 * Resolve the POV character for a scene.
 *
 * A scene with no `viewpointCharacterId` inherits the story's protagonist —
 * generation treats it that way, so the UI shows the same thing, marked as
 * inherited so a deliberate choice stays distinguishable from a default.
 */
export function resolveViewpointCharacter(
  viewpointCharacterId: string | null | undefined,
  characters: Character[],
): ViewpointResolution {
  if (viewpointCharacterId) {
    const character = characters.find((char) => char.id === viewpointCharacterId)
    return { character, isExplicit: true, isDangling: !character }
  }

  return {
    character: characters.find((char) => char.isMainCharacter),
    isExplicit: false,
    isDangling: false,
  }
}

/**
 * Get a short name for a character
 * Returns nickname if available, otherwise firstName
 */
export function getCharacterShortName(character: Character): string {
  return character.nickname || character.firstName || 'Unnamed'
}

/**
 * Get the initial letter(s) for an avatar placeholder
 */
export function getAvatarInitial(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?'
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
