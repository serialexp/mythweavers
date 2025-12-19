import { arcsStore } from '../arcs'
import { uiState } from '../ui'

export const currentArc = () => (uiState.currentId ? arcsStore.arcs[uiState.currentId] : undefined)
