import { convertFileSrc } from '@tauri-apps/api/core'
import type { Character } from '@writer/shared'
import { BsGenderTrans } from 'solid-icons/bs'
import { FaSolidHeart, FaSolidHeartCrack } from 'solid-icons/fa'
import {
  TbGenderAgender,
  TbGenderBigender,
  TbGenderFemale,
  TbGenderGenderfluid,
  TbGenderMale,
  TbGenderThird,
} from 'solid-icons/tb'
import { For, createSignal } from 'solid-js'
import { charactersState, createCharacter, removeCharacter, setSelectedCharacterId } from '../lib/stores/characters'
import { storyState } from '../lib/stores/story'
import { CharacterModal } from './CharacterModal'
import { getColorValue } from './ColorPicker'
import { NoItems } from './NoItems'

const getGenderIcon = (gender: string | undefined) => {
  switch (gender?.toLowerCase()) {
    case 'male':
      return <TbGenderMale class="text-blue-500" title="Male" />
    case 'female':
      return <TbGenderFemale class="text-pink-500" title="Female" />
    case 'non-binary':
      return <TbGenderThird class="text-purple-500" title="Non-binary" />
    case 'genderfluid':
      return <TbGenderGenderfluid class="text-teal-500" title="Genderfluid" />
    case 'agender':
      return <TbGenderAgender class="text-gray-500" title="Agender" />
    case 'transgender':
      return <BsGenderTrans class="text-blue-300" title="Transgender" />
    case 'genderqueer':
      return <TbGenderBigender class="text-purple-300" title="Genderqueer" />
    default:
      return null
  }
}

const getOrientationIcon = (orientation: string | undefined) => {
  switch (orientation?.toLowerCase()) {
    case 'straight':
      return <FaSolidHeart class="text-red-500" title="Straight" />
    case 'gay':
      return <FaSolidHeart class="text-pink-400" title="Gay" />
    case 'lesbian':
      return <FaSolidHeart class="text-violet-400" title="Lesbian" />
    case 'bisexual':
      return <FaSolidHeart class="text-purple-500" title="Bisexual" />
    case 'pansexual':
      return <FaSolidHeart class="text-yellow-500" title="Pansexual" />
    case 'asexual':
      return <FaSolidHeartCrack class="text-gray-500" title="Asexual" />
    case 'demisexual':
      return <FaSolidHeart class="text-green-500" title="Demisexual" />
    default:
      return null
  }
}

const getFullName = (char: Character) => {
  const parts = [char.firstName, char.middleName, char.lastName].filter(Boolean)
  const fullName = parts.join(' ')
  return char.nickname ? `${fullName} "${char.nickname}"` : fullName
}

export const CharacterPanel = () => {
  const [charModal, setCharacterModal] = createSignal(false)
  const [_characterId, _setCharacterId] = createSignal('')
  const openPath = storyState.openPath
  const characters = charactersState.characters

  console.log(characters)

  const mainCharacters = () => Object.values(characters).filter((char) => char.isMainCharacter ?? true)
  const sideCharacters = () => Object.values(characters).filter((char) => !(char.isMainCharacter ?? true))

  const CharacterCard = ({ char }: { char: Character }) => (
    <div
      onClick={() => {
        setCharacterModal(true)
        setSelectedCharacterId(char.id)
      }}
      class="relative p-2 h-48 w-48 border border-black border-solid bg-gray-500 group cursor-pointer"
      style={{
        'background-image': `url(${convertFileSrc(`${openPath}/data/${char.picture}`)})`,
        'background-size': 'cover',
        'background-position': 'center',
      }}
    >
      <div class="flex flex-col text-white text-shadow-2px-2px-3px-black">
        <div class="text-lg font-bold">{getFullName(char)}</div>
        <div class="text-sm">
          {char.age} years • {char.height ?? 170}cm
        </div>
      </div>

      {/* Character attributes */}
      <div class="absolute bottom-2 left-2 flex gap-1 items-center bg-black/50 p-1 rounded">
        {getGenderIcon(char.gender)}
        {getOrientationIcon(char.sexualOrientation)}
        {char.hairColor && (
          <div
            class="w-4 h-4 rounded-full border border-white relative"
            style={{
              'background-color': getColorValue(char.hairColor),
            }}
            title={`Hair: ${char.hairColor}`}
          >
            <span
              class="absolute inset-0 flex items-center justify-center text-[8px] font-bold"
              style={{
                color: ['White', 'Light Blonde', 'Platinum'].includes(char.hairColor) ? '#000' : '#fff',
              }}
            >
              H
            </span>
          </div>
        )}
        {char.eyeColor && (
          <div
            class="w-4 h-4 rounded-full border border-white relative"
            style={{
              'background-color': getColorValue(char.eyeColor),
            }}
            title={`Eyes: ${char.eyeColor}`}
          >
            <span
              class="absolute inset-0 flex items-center justify-center text-[8px] font-bold"
              style={{
                color: ['White', 'Light Grey'].includes(char.eyeColor) ? '#000' : '#fff',
              }}
            >
              E
            </span>
          </div>
        )}
        {(char.significantActions?.length ?? 0) > 0 && (
          <div
            class="badge badge-sm badge-accent"
            title={`${char.significantActions?.length ?? 0} significant actions`}
          >
            {char.significantActions?.length ?? 0}
          </div>
        )}
      </div>

      <button
        type="button"
        class="btn btn-error btn-xs absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          removeCharacter(char.id)
        }}
      >
        X
      </button>
    </div>
  )

  return (
    <div class="flex flex-col gap-2 p-2 w-full h-full">
      {charModal() && (
        <CharacterModal
          onClose={() => {
            setCharacterModal(false)
          }}
        />
      )}

      {Object.values(characters).length === 0 ? (
        <NoItems itemKind="characters" />
      ) : (
        <div class="flex gap-4 flex-1 min-h-0">
          {/* Main Characters Column */}
          <div class="flex flex-col w-1/3">
            <h3 class="text-lg font-semibold mb-2 text-center">Main Characters</h3>
            <div class="flex-1 overflow-auto">
              <div class="flex flex-wrap gap-2">
                <For each={mainCharacters()}>{(char) => <CharacterCard char={char} />}</For>
              </div>
            </div>
          </div>

          {/* Side Characters Column */}
          <div class="flex flex-col w-2/3">
            <h3 class="text-lg font-semibold mb-2 text-center">Side Characters</h3>
            <div class="flex-1 overflow-auto">
              <div class="flex flex-wrap gap-2">
                <For each={sideCharacters()}>{(char) => <CharacterCard char={char} />}</For>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        class="btn btn-primary"
        onClick={() => {
          createCharacter()
        }}
      >
        Add character
      </button>
    </div>
  )
}
