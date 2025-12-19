import { chaptersState } from '../chapters'
import { uiState } from '../ui'

export const currentChapter = () => (uiState.currentId ? chaptersState.chapters[uiState.currentId] : undefined)
