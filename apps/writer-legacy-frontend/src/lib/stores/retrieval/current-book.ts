import { booksStore } from '../books'
import { uiState } from '../ui'

export const currentBook = () => (uiState.currentId ? booksStore.books[uiState.currentId] : undefined)
