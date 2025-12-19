import type { PersistedStory } from '@writer/shared'
import { setArcsStore } from '../stores/arcs'
import { setBooksStore } from '../stores/books'
import { setChaptersState } from '../stores/chapters'
import { setCharactersState } from '../stores/characters'
import { setItems } from '../stores/items'
import { setLanguageStore } from '../stores/language-store'
import { setLocationsState } from '../stores/locations'
import { setPlotpoints } from '../stores/plot-points'
import { getWordCount } from '../stores/scenes'
import { setScenesState } from '../stores/scenes'
import { setStory } from '../stores/story'
import { setTree } from '../stores/tree'

export const loadToState = async (savedStory: PersistedStory) => {
  setArcsStore({
    arcs: savedStory.story.arc,
  })
  setCharactersState({
    characters: savedStory.story.characters,
  })
  setChaptersState({
    chapters: savedStory.story.chapter,
  })
  const scenesToSet = { ...savedStory.story.scene }
  for (const sceneId of Object.keys(scenesToSet)) {
    let sceneWords = 0
    for (const paragraph of scenesToSet[sceneId].paragraphs) {
      // Ensure paragraph has a modifiedAt timestamp
      if (!paragraph.modifiedAt) {
        paragraph.modifiedAt = Date.now()
      }

      const counts = getWordCount(paragraph.text)
      paragraph.words = counts.words
      sceneWords += paragraph.words

      if (paragraph.aiCharacters === undefined || paragraph.humanCharacters === undefined) {
        paragraph.aiCharacters = paragraph.state === 'ai' ? counts.characters : 0
        paragraph.humanCharacters = paragraph.state !== 'ai' ? counts.characters : 0
      }
    }
    scenesToSet[sceneId].words = sceneWords
  }
  setScenesState({
    scenes: scenesToSet,
  })
  setBooksStore({
    books: savedStory.story.book,
  })
  setItems(savedStory.story.item ?? {})
  setPlotpoints({
    plotPoints: savedStory.story.plotPoints,
  })
  setLocationsState({
    locations: savedStory.story.locations ?? {},
  })
  setCharactersState({
    characters: savedStory.story.characters,
  })
  setLanguageStore({
    languages: savedStory.language,
  })
  setTree(savedStory.story.structure ?? {})
  setStory(savedStory.story)
}
