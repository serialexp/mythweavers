import { createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { RefinementLevel } from './constants'

type LoadingState = {
  [nodeId: string]: boolean
}

type BookRefinements = Record<
  string,
  {
    text: string
    level: RefinementLevel
  }
>

type RefinementPreview = {
  original: string
  refined: string
  onAccept: () => void
  onReject: () => void
  level: 1 | 2 | 3
} | null

type State = {
  loadingStates: Record<string, boolean>
  refinementPreview: RefinementPreview
}

const [state, setState] = createStore<State>({
  loadingStates: {},
  refinementPreview: null,
})

export const loadingStates = state.loadingStates

export const setLoadingStates = (newStates: Record<string, boolean>) => {
  setState('loadingStates', (current) => ({
    ...current,
    ...newStates,
  }))
}

export const refinementPreview = () => state.refinementPreview

export const setRefinementPreview = (preview: RefinementPreview) => {
  setState('refinementPreview', preview)
}

export const [bookRefinements, setBookRefinements] = createStore<BookRefinements>({})

export const [storyRefinement, setStoryRefinement] = createSignal<string | null>(null)

export const [highlightsPreview, setHighlightsPreview] = createSignal<string | null>(null)
