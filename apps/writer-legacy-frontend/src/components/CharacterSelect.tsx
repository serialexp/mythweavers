import type { Character } from '@writer/shared'
import { For } from 'solid-js'
import { charactersState } from '../lib/stores/characters'

export type CharacterSelectProps = {
  placeholder?: string
  value?: string
  onChange: (characterId: string | null) => void
  characters?: string[]
  emptyMessage?: string
  filter?: (character: Character) => boolean
}

export const CharacterSelect = (props: CharacterSelectProps) => {
  const characters = () => {
    let chars = props.characters
      ? props.characters.map((id) => charactersState.characters[id])
      : Object.values(charactersState.characters)

    if (props.filter) {
      chars = chars.filter(props.filter)
    }

    chars = chars.sort((a, b) => {
      return a.firstName.localeCompare(b.firstName)
    })

    return chars
  }

  return (
    <select
      class="select select-bordered w-full"
      value={props.value ?? ''}
      onChange={(e) => {
        const value = e.currentTarget.value
        props.onChange(value || null)
      }}
    >
      <option value="">{props.placeholder ?? 'Select character...'}</option>
      <For each={characters()}>
        {(character) => {
          if (!character) return null
          const fullName = [
            character.firstName,
            character.middleName,
            character.lastName,
            character.nickname ? `"${character.nickname}"` : undefined,
          ]
            .filter(Boolean)
            .join(' ')
          return <option value={character.id}>{fullName}</option>
        }}
      </For>
      {characters().length === 0 && props.emptyMessage && <option disabled>{props.emptyMessage}</option>}
    </select>
  )
}
