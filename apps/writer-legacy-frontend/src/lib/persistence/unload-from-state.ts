import { resetVectorStore } from '../embeddings/embedding-store'
import { resetArcsStore } from '../stores/arcs'
import { resetBooksStore } from '../stores/books'
import { resetChaptersState } from '../stores/chapters'
import { resetCharactersState } from '../stores/characters'
import { resetItems } from '../stores/items'
import { resetLanguageStore } from '../stores/language-store'
import { resetPlotpoints } from '../stores/plot-points'
import { resetScenesState } from '../stores/scenes'
import { resetStoryState } from '../stores/story'
import { resetTreeState } from '../stores/tree'
import { resetUserState } from '../stores/user'

export const unloadFromState = () => {
  resetArcsStore()
  resetCharactersState()
  resetChaptersState()
  resetScenesState()
  resetBooksStore()
  resetItems()
  resetPlotpoints()
  resetLanguageStore()
  resetTreeState()
  resetStoryState()
  resetUserState()

  // clean up the embeddings store too
  resetVectorStore()
}
