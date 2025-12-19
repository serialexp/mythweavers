import { PayloadAction, createSlice } from '@reduxjs/toolkit'

interface BookshelfState {
  isOpen: boolean
  storyId: string | null
}

const initialState: BookshelfState = {
  isOpen: false,
  storyId: null,
}

const bookshelfSlice = createSlice({
  name: 'bookshelf',
  initialState,
  reducers: {
    openAddToBookshelf(state, action: PayloadAction<string>) {
      state.isOpen = true
      state.storyId = action.payload
    },
    closeAddToBookshelf(state) {
      state.isOpen = false
      state.storyId = null
    },
  },
})

export const { openAddToBookshelf, closeAddToBookshelf } = bookshelfSlice.actions
export default bookshelfSlice.reducer
