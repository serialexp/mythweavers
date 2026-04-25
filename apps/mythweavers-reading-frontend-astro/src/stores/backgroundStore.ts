import { createSignal } from 'solid-js'

/**
 * Reader-app background image store. Drives the persistent background
 * layer mounted at the layout level, which crossfades to whatever URL is
 * currently set. Multiple components write to it (chapter-mount sets the
 * entering background; scroll-driven anchor crossings update as the user
 * scrolls; chapter navigation resets to the next chapter's entering
 * background).
 *
 * Plain Solid signals — the store is global state for a SolidJS island
 * tree, not a Zustand-style store. The layer subscribes via the exported
 * `currentBackgroundUrl` accessor.
 */
const [currentBackgroundUrl, setCurrentBackgroundUrlInternal] = createSignal<string | null>(null)

export { currentBackgroundUrl }

/**
 * Update the active background. No-op when the URL is unchanged so we
 * don't re-trigger the CSS crossfade against the same image (e.g. when
 * a SPA-style navigation lands on a chapter that inherits the same
 * carry-in background as the one already shown).
 */
export function setBackground(url: string | null): void {
  if (url === currentBackgroundUrl()) return
  setCurrentBackgroundUrlInternal(url)
}
