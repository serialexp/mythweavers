import { scenesState } from '../scenes'
import { uiState } from '../ui'

export const currentScene = () => (uiState.currentId ? scenesState.scenes[uiState.currentId] : undefined)
