import { setArcsStore } from '../stores/arcs'
import { setBooksStore } from '../stores/books'
import { setChaptersState } from '../stores/chapters'
import { setCharactersState } from '../stores/characters'
import { setItems } from '../stores/items'
import { setLanguageStore } from '../stores/language-store'
import { setLocationsState } from '../stores/locations'
import { setPlotpoints } from '../stores/plot-points'
import { setScenesState } from '../stores/scenes'
import { setStoryState } from '../stores/story'
import { setTree } from '../stores/tree'

export const unloadState = () => {
  setArcsStore({
    arcs: {},
  })
  setCharactersState({
    characters: {},
  })
  setChaptersState({
    chapters: {},
  })
  setScenesState({
    scenes: {},
  })
  setBooksStore({
    books: {},
  })
  setItems({})
  setPlotpoints({
    plotPoints: {},
  })
  setLocationsState({
    locations: {},
  })
  setLanguageStore({
    languages: {
      languages: {},
    },
  })
  setTree([])
  setStoryState({
    storyLoaded: false,
    expectedLastModified: 0,
    story: undefined,
  })
}
