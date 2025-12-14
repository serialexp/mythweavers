import { createStore, unwrap } from 'solid-js/store'
import { createEffect, batch } from 'solid-js'
import { Character } from '../types/core'
import { storage } from '../utils/storage'
import { saveService } from '../services/saveService'
import { currentStoryStore } from './currentStoryStore'
import { getCharacterDisplayName } from '../utils/character'

// Track if characters have been loaded
let charactersLoaded = false

const [charactersState, setCharactersState] = createStore({
  characters: [] as Character[],
  showCharacters: false
})

// Load characters from storage asynchronously
const loadCharacters = async () => {
  try {
    const saved = await storage.get<Character[]>('story-characters')
    if (saved) {
      batch(() => {
        setCharactersState('characters', saved)
      })
    }
    charactersLoaded = true
  } catch (error) {
    console.error('Error loading characters from storage:', error)
    charactersLoaded = true
  }
}

// Start loading immediately
loadCharacters()

// Auto-save characters to storage
createEffect(() => {
  const characters = charactersState.characters
  // Only save if characters have been loaded from storage first
  if (charactersLoaded) {
    // Run async save without blocking
    // Unwrap the proxy objects before saving
    const plainCharacters = unwrap(characters)
    storage.set('story-characters', plainCharacters).catch(error => {
      console.error('Error saving characters to storage:', error)
    })
  }
})

export const charactersStore = {
  // Getters
  get characters() { return charactersState.characters },
  get showCharacters() { return charactersState.showCharacters },

  // Actions
  setCharacters: (characters: Character[]) => setCharactersState('characters', characters),
  
  addCharacter: (character: Character) => {
    setCharactersState('characters', prev => [...prev, character])
    // SaveService handles local vs server logic
    if (currentStoryStore.id) {
      saveService.createCharacter(currentStoryStore.id, character)
    }
  },
  
  updateCharacter: (id: string, updates: Partial<Character>) => {
    setCharactersState('characters', char => char.id === id, updates)
    // SaveService handles local vs server logic
    if (currentStoryStore.id) {
      const character = charactersState.characters.find(c => c.id === id)
      if (character) {
        saveService.updateCharacter(currentStoryStore.id, id, { ...character, ...updates })
      }
    }
  },
  
  deleteCharacter: (id: string) => {
    setCharactersState('characters', prev => prev.filter(char => char.id !== id))
    // SaveService handles local vs server logic
    if (currentStoryStore.id) {
      saveService.deleteCharacter(currentStoryStore.id, id)
    }
  },
  
  setShowCharacters: (show: boolean) => setCharactersState('showCharacters', show),
  
  toggleCharacters: () => setCharactersState('showCharacters', !charactersState.showCharacters),

  getCharacterContext: () => {
    if (charactersState.characters.length === 0) return ''

    const characterList = charactersState.characters
      .map(char => `${getCharacterDisplayName(char)}${char.isMainCharacter ? ' (protagonist)' : ''}: ${char.description}`)
      .join('\n')

    return `Known characters in this story:\n${characterList}\n\n`
  }
}