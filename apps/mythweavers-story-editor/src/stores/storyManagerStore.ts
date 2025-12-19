import { createSignal } from 'solid-js'

const [showStoryManager, setShowStoryManager] = createSignal(false)

export const storyManagerStore = {
  get isOpen() {
    return showStoryManager()
  },

  open() {
    setShowStoryManager(true)
  },

  close() {
    setShowStoryManager(false)
  },

  toggle() {
    setShowStoryManager(!showStoryManager())
  },
}
