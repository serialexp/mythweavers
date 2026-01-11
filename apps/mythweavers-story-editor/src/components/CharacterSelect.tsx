import { Dropdown } from '@mythweavers/ui'
import { BsChevronDown, BsStarFill } from 'solid-icons/bs'
import { Component, For, Show, createMemo } from 'solid-js'
import { charactersStore } from '../stores/charactersStore'
import type { Character } from '../types/core'
import { getAvatarInitial, getCharacterDisplayName } from '../utils/character'
import * as styles from './CharacterSelect.css'

export interface CharacterSelectProps {
  /** Currently selected character ID */
  value?: string | null
  /** Callback when selection changes */
  onChange: (characterId: string | null) => void
  /** Placeholder text when nothing selected */
  placeholder?: string
  /** Filter characters to show (e.g., only active characters in a scene) */
  characters?: Character[]
  /** Show a "None" option to clear the selection */
  allowNone?: boolean
  /** Label for the none option */
  noneLabel?: string
  /** Size variant */
  size?: 'sm' | 'md'
  /** Additional CSS class */
  class?: string
  /** Disabled state */
  disabled?: boolean
}

/**
 * Reusable character selection dropdown with avatars and protagonist indicator
 */
export const CharacterSelect: Component<CharacterSelectProps> = (props) => {
  // Use provided characters or all characters from store
  const characters = createMemo(() => props.characters ?? charactersStore.characters)

  // Get selected character
  const selectedCharacter = createMemo(() => {
    if (!props.value) return null
    return characters().find((c) => c.id === props.value) || null
  })

  // Sort characters: protagonist first, then alphabetically
  const sortedCharacters = createMemo(() => {
    return [...characters()].sort((a, b) => {
      // Protagonist comes first
      if (a.isMainCharacter && !b.isMainCharacter) return -1
      if (!a.isMainCharacter && b.isMainCharacter) return 1
      // Then alphabetically by display name
      return getCharacterDisplayName(a).localeCompare(getCharacterDisplayName(b))
    })
  })

  const isSmall = () => props.size === 'sm'

  const trigger = (
    <button
      type="button"
      class={`${styles.trigger} ${isSmall() ? styles.triggerSmall : ''} ${props.class ?? ''}`}
      disabled={props.disabled}
    >
      <div class={styles.triggerContent}>
        <Show
          when={selectedCharacter()}
          fallback={<span class={styles.triggerPlaceholder}>{props.placeholder || 'Select character...'}</span>}
        >
          {(char) => (
            <>
              <CharacterAvatar character={char()} size={isSmall() ? 'sm' : 'md'} />
              <span class={styles.characterName}>{getCharacterDisplayName(char())}</span>
              <Show when={char().isMainCharacter}>
                <BsStarFill class={styles.protagonistStar} />
              </Show>
            </>
          )}
        </Show>
      </div>
      <BsChevronDown class={styles.triggerChevron} />
    </button>
  )

  return (
    <Dropdown trigger={trigger} portal>
      <Show when={props.allowNone}>
        <button
          type="button"
          class={`${styles.menuItem} ${styles.clearOption} ${!props.value ? styles.menuItemActive : ''}`}
          onClick={() => props.onChange(null)}
        >
          {props.noneLabel || 'None'}
        </button>
        <div class={styles.menuDivider} />
      </Show>
      <For each={sortedCharacters()}>
        {(character) => (
          <button
            type="button"
            class={`${styles.menuItem} ${props.value === character.id ? styles.menuItemActive : ''}`}
            onClick={() => props.onChange(character.id)}
          >
            <div class={styles.menuItemContent}>
              <CharacterAvatar character={character} size={isSmall() ? 'sm' : 'md'} />
              <span class={styles.characterName}>{getCharacterDisplayName(character)}</span>
              <Show when={character.isMainCharacter}>
                <BsStarFill class={styles.protagonistStar} />
              </Show>
            </div>
          </button>
        )}
      </For>
    </Dropdown>
  )
}

/**
 * Props for CharacterSelectByName - selects by display name instead of ID
 */
export interface CharacterSelectByNameProps {
  /** Currently selected character display name */
  value?: string
  /** Callback when selection changes */
  onChange: (characterName: string) => void
  /** Placeholder text when nothing selected */
  placeholder?: string
  /** Filter characters to show */
  characters?: Character[]
  /** Size variant */
  size?: 'sm' | 'md'
  /** Additional CSS class */
  class?: string
  /** Disabled state */
  disabled?: boolean
}

/**
 * Character selection dropdown that works with character display names
 * Useful for inventory actions where we store character name strings
 */
export const CharacterSelectByName: Component<CharacterSelectByNameProps> = (props) => {
  // Use provided characters or all characters from store
  const characters = createMemo(() => props.characters ?? charactersStore.characters)

  // Get selected character by name
  const selectedCharacter = createMemo(() => {
    if (!props.value) return null
    return characters().find((c) => getCharacterDisplayName(c) === props.value) || null
  })

  // Sort characters: protagonist first, then alphabetically
  const sortedCharacters = createMemo(() => {
    return [...characters()].sort((a, b) => {
      if (a.isMainCharacter && !b.isMainCharacter) return -1
      if (!a.isMainCharacter && b.isMainCharacter) return 1
      return getCharacterDisplayName(a).localeCompare(getCharacterDisplayName(b))
    })
  })

  const isSmall = () => props.size === 'sm'

  const trigger = (
    <button
      type="button"
      class={`${styles.trigger} ${isSmall() ? styles.triggerSmall : ''} ${props.class ?? ''}`}
      disabled={props.disabled}
    >
      <div class={styles.triggerContent}>
        <Show
          when={selectedCharacter()}
          fallback={
            // Show value even if no matching character (for manual entry)
            props.value ? (
              <>
                <div class={`${styles.avatarPlaceholder} ${isSmall() ? styles.avatarPlaceholderSmall : ''}`}>
                  {getAvatarInitial(props.value)}
                </div>
                <span class={styles.characterName}>{props.value}</span>
              </>
            ) : (
              <span class={styles.triggerPlaceholder}>{props.placeholder || 'Select character...'}</span>
            )
          }
        >
          {(char) => (
            <>
              <CharacterAvatar character={char()} size={isSmall() ? 'sm' : 'md'} />
              <span class={styles.characterName}>{getCharacterDisplayName(char())}</span>
              <Show when={char().isMainCharacter}>
                <BsStarFill class={styles.protagonistStar} />
              </Show>
            </>
          )}
        </Show>
      </div>
      <BsChevronDown class={styles.triggerChevron} />
    </button>
  )

  return (
    <Dropdown trigger={trigger} portal>
      <For each={sortedCharacters()}>
        {(character) => {
          const displayName = getCharacterDisplayName(character)
          return (
            <button
              type="button"
              class={`${styles.menuItem} ${props.value === displayName ? styles.menuItemActive : ''}`}
              onClick={() => props.onChange(displayName)}
            >
              <div class={styles.menuItemContent}>
                <CharacterAvatar character={character} size={isSmall() ? 'sm' : 'md'} />
                <span class={styles.characterName}>{displayName}</span>
                <Show when={character.isMainCharacter}>
                  <BsStarFill class={styles.protagonistStar} />
                </Show>
              </div>
            </button>
          )
        }}
      </For>
    </Dropdown>
  )
}

// Internal avatar component
function CharacterAvatar(props: { character: Character; size: 'sm' | 'md' }) {
  const isSmall = () => props.size === 'sm'
  const displayName = () => getCharacterDisplayName(props.character)

  return (
    <Show
      when={props.character.profileImageData}
      fallback={
        <div class={`${styles.avatarPlaceholder} ${isSmall() ? styles.avatarPlaceholderSmall : ''}`}>
          {getAvatarInitial(displayName())}
        </div>
      }
    >
      <img
        src={props.character.profileImageData!}
        alt={displayName()}
        class={`${styles.avatar} ${isSmall() ? styles.avatarSmall : ''}`}
      />
    </Show>
  )
}
