import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import { TypedUseSelectorHook } from 'react-redux'
import bookshelfReducer from './slices/bookshelf-slice'

const store = configureStore({
  reducer: {
    bookshelf: bookshelfReducer,
  },
})

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
export const useAppDispatch = () => useDispatch<AppDispatch>()

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export default store
