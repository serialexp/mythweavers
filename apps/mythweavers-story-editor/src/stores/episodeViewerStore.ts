import { createSignal } from 'solid-js'

const DOCKED_MODE_MIN_WIDTH = 1400 // Minimum window width for docked mode

const [isOpen, setIsOpen] = createSignal(false)
const [windowWidth, setWindowWidth] = createSignal(window.innerWidth)

// Track window width for determining docked vs modal mode
if (typeof window !== 'undefined') {
  const handleResize = () => {
    setWindowWidth(window.innerWidth)
  }
  window.addEventListener('resize', handleResize)
  // Note: cleanup is handled by the component that imports this
}

export const episodeViewerStore = {
  get isOpen() {
    return isOpen()
  },

  get isDocked() {
    // Show docked mode on wide screens (>= 1400px)
    return windowWidth() >= DOCKED_MODE_MIN_WIDTH
  },

  get windowWidth() {
    return windowWidth()
  },

  show() {
    setIsOpen(true)
  },

  hide() {
    setIsOpen(false)
  },

  toggle() {
    setIsOpen(!isOpen())
  },

  // Internal method to update window width (called by resize listener)
  _setWindowWidth(width: number) {
    setWindowWidth(width)
  }
}
