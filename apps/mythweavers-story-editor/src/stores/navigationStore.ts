import { createSignal } from 'solid-js'

export interface NavigationStore {
  showNavigation: boolean
  setShowNavigation: (show: boolean) => void
  toggleNavigation: () => void
  selectedStorylineId: string | null
  setSelectedStorylineId: (id: string | null) => void
  clearStorylineFilter: () => void
}

function createNavigationStore(): NavigationStore {
  const [showNavigation, setShowNavigation] = createSignal(false)
  const [selectedStorylineId, setSelectedStorylineId] = createSignal<string | null>(null)

  return {
    get showNavigation() {
      return showNavigation()
    },
    setShowNavigation,
    toggleNavigation: () => setShowNavigation(!showNavigation()),
    get selectedStorylineId() {
      return selectedStorylineId()
    },
    setSelectedStorylineId,
    clearStorylineFilter: () => setSelectedStorylineId(null),
  }
}

export const navigationStore = createNavigationStore()
