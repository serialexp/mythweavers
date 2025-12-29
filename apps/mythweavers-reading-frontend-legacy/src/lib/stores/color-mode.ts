import { createSignal } from 'solid-js'
import { isServer } from 'solid-js/web'

// Create a reactive signal for the color mode
const [colorMode, setColorMode] = createSignal<'light' | 'dark'>('light')

// Function to initialize the color mode based on system preference
export const initColorMode = () => {
  if (isServer) return

  // Check for stored preference
  const storedMode = localStorage.getItem('colorMode') as 'light' | 'dark' | null

  if (storedMode) {
    setColorMode(storedMode)
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setColorMode('dark')
  }

  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('colorMode')) {
      setColorMode(e.matches ? 'dark' : 'light')
    }
  })
}

// Function to toggle the color mode
export const toggleColorMode = () => {
  const newMode = colorMode() === 'light' ? 'dark' : 'light'
  setColorMode(newMode)
  localStorage.setItem('colorMode', newMode)
}

export { colorMode }
