import { Component, Show } from 'solid-js'
import type { Character } from '../types/core'
import { getAvatarInitial, getCharacterDisplayName } from '../utils/character'
import * as styles from './CharacterAvatar.css'

export type CharacterAvatarSize = 'xs' | 'sm' | 'md'

export interface CharacterAvatarProps {
  character: Character
  /** Defaults to `md` (24px). */
  size?: CharacterAvatarSize
  /**
   * Render dimmed. Use when the character was inferred rather than chosen —
   * e.g. a scene with no viewpoint character falling back to the protagonist.
   */
  muted?: boolean
  /** Tooltip. Falls back to the character's display name. */
  title?: string
  class?: string
}

export interface AvatarInitialProps {
  /** The name to derive the initial from. */
  name: string
  size?: CharacterAvatarSize
  muted?: boolean
  title?: string
  class?: string
}

const avatarClasses = (base: string, muted?: boolean, extra?: string) =>
  [base, muted ? styles.muted : '', extra ?? ''].filter(Boolean).join(' ')

/**
 * The initial-letter placeholder on its own, for names with no character
 * record behind them (manual entry in CharacterSelect).
 */
export const AvatarInitial: Component<AvatarInitialProps> = (props) => (
  <span
    class={avatarClasses(styles.placeholder[props.size ?? 'md'], props.muted, props.class)}
    title={props.title ?? props.name}
    aria-label={props.name}
  >
    {getAvatarInitial(props.name)}
  </span>
)

/**
 * A character's profile picture, falling back to their initial when there is
 * no image. `profileImageData` holds either a resolved URL (server-loaded, see
 * App.tsx) or a base64 data URI (freshly picked, pre-upload) — both work as an
 * `img` src, so neither case needs special handling here.
 */
export const CharacterAvatar: Component<CharacterAvatarProps> = (props) => {
  const size = () => props.size ?? 'md'
  const displayName = () => getCharacterDisplayName(props.character)
  const title = () => props.title ?? displayName()

  return (
    <Show
      when={props.character.profileImageData}
      fallback={
        <AvatarInitial name={displayName()} size={size()} muted={props.muted} title={title()} class={props.class} />
      }
    >
      <img
        src={props.character.profileImageData!}
        alt={displayName()}
        title={title()}
        class={avatarClasses(styles.image[size()], props.muted, props.class)}
      />
    </Show>
  )
}
