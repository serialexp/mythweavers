import type { Character } from '@writer/shared'
import { generate as short } from 'short-uuid'
import { createStore } from 'solid-js/store'
import { removeEntityFromEmbeddingsCache, removeEntityIdsFromEmbeddings } from '../embeddings/load-story-to-embeddings'
import { addNotification } from './notifications'

export type CharactersState = {
  characters: Record<string, Character>
  selectedCharacterId: string
  selectedCharacter?: Character
}
const charactersStateDefault: CharactersState = {
  selectedCharacterId: '',
  characters: {},
  get selectedCharacter() {
    return this.characters[this.selectedCharacterId]
  },
}
export const [charactersState, setCharactersState] = createStore<CharactersState>(charactersStateDefault)

export const resetCharactersState = () => {
  setCharactersState({
    characters: {},
    selectedCharacterId: '',
  })
}

export const createCharacter = () => {
  const id = short()
  const character = {
    id,
    isMainCharacter: true,
    firstName: '',
    lastName: '',
    middleName: '',
    nickname: '',
    age: '0',
    picture: '',
    summary: '',
    background: '',
    personality: '',
    personalityQuirks: '',
    likes: '',
    dislikes: '',
    gender: '',
    sexualOrientation: '',
    height: 170,
    hairColor: '',
    eyeColor: '',
    distinguishingFeatures: '',
    writingStyle: '',
    modifiedAt: Date.now(),
    significantActions: [],
  } satisfies Character
  setCharactersState('characters', id, character)
  return id
}

export const updateCharacterProperty = <T extends keyof Character>(
  characterId: string,
  property: T,
  value: Character[T],
) => {
  setCharactersState('characters', characterId, property, value)
  setCharactersState('characters', characterId, 'modifiedAt', Date.now())
  removeEntityFromEmbeddingsCache(`character/${characterId}/identity`)
  removeEntityFromEmbeddingsCache(`character/${characterId}/appearance`)
  removeEntityFromEmbeddingsCache(`character/${characterId}/role`)
  removeEntityFromEmbeddingsCache(`character/${characterId}/summary`)
}

export const setSelectedCharacterId = (characterId: string) => {
  setCharactersState('selectedCharacterId', characterId)
}

export const removeCharacter = (characterId: string) => {
  // @ts-expect-error: yes, this is a valid operation
  setCharactersState('characters', characterId, undefined)
  removeEntityIdsFromEmbeddings(/character\/${characterId}.*/).catch((_error) => {
    addNotification({
      type: 'error',
      title: 'Failed to clear embedding cache for character',
      message: 'Failed to clear embedding cache on character deletion',
    })
  })
}

export const getCharacterName = (characterId: string) => {
  const character = charactersState.characters[characterId]
  return `${character?.firstName} ${character?.middleName} ${character?.lastName}${character?.nickname ? ` "(${character.nickname})"` : ''}`
}
