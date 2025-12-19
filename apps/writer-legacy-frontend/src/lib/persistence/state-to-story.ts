import type { PersistedStory } from '@writer/shared'
import { unwrap } from 'solid-js/store'
import { arcsStore } from '../stores/arcs'
import { booksStore } from '../stores/books'
import { chaptersState } from '../stores/chapters'
import { charactersState } from '../stores/characters'
import { items } from '../stores/items'
import { languageStore } from '../stores/language-store'
import { locationsState } from '../stores/locations'
import { plotpoints } from '../stores/plot-points'
import { scenesState } from '../stores/scenes'
import { storyState } from '../stores/story'
import { treeState } from '../stores/tree'

/**
 * Transforms the current application state into a PersistedStory object
 * that can be used for saving or uploading.
 *
 * @returns A PersistedStory object containing all the story data from the current state
 * @throws Error if no story is loaded or if the story has no ID
 */
export const stateToStory = (): PersistedStory => {
  const story = unwrap(storyState).story
  if (!story?.id) {
    throw new Error('Story has no id')
  }

  // Construct the complete story data from stores
  return {
    story: {
      ...story,
      characters: unwrap(charactersState).characters,
      plotPoints: unwrap(plotpoints).plotPoints,
      scene: unwrap(scenesState).scenes,
      book: unwrap(booksStore).books,
      arc: unwrap(arcsStore).arcs,
      locations: unwrap(locationsState).locations,
      chapter: unwrap(chaptersState).chapters,
      item: unwrap(items).items,
      structure: unwrap(treeState).structure,
    },
    language: unwrap(languageStore.languages),
  }
}
