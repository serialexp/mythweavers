import { createStore } from 'solid-js/store'

type BookshelfState = {
  isOpen: boolean
  storyId: string | null
}

const [bookshelfState, setBookshelfState] = createStore<BookshelfState>({
  isOpen: false,
  storyId: null,
})

export const openAddToBookshelf = (storyId: string) => {
  setBookshelfState({ isOpen: true, storyId })
}

export const closeAddToBookshelf = () => {
  setBookshelfState({ isOpen: false, storyId: null })
}

export { bookshelfState }
