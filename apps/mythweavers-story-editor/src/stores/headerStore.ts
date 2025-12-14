import { createSignal, createEffect } from 'solid-js'

// Initialize from localStorage, default to collapsed on mobile
const savedState = localStorage.getItem('headerCollapsed')
const isMobile = () => window.innerWidth <= 768
const initialState = savedState !== null ? savedState === 'true' : isMobile()

const [isHeaderCollapsed, setIsHeaderCollapsed] = createSignal(initialState)

// Save to localStorage when state changes
createEffect(() => {
  localStorage.setItem('headerCollapsed', isHeaderCollapsed().toString())
})

export const headerStore = {
  isCollapsed: isHeaderCollapsed,
  setCollapsed: setIsHeaderCollapsed,
  toggle: () => setIsHeaderCollapsed(!isHeaderCollapsed()),
}