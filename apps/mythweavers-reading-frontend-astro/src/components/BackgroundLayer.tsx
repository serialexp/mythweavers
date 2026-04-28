import { Show, createEffect, createSignal, untrack } from 'solid-js'
import { useTheme } from '@mythweavers/ui'
import { currentBackgroundUrl } from '../stores/backgroundStore'
import { resolveCoverArtUrl } from '../lib/api'
import * as styles from './BackgroundLayer.css'

/**
 * Two-layer crossfading background image renderer mounted in the global
 * Layout. Listens to {@link currentBackgroundUrl}; whenever it changes,
 * the active layer fades out and the inactive layer fades in to the new
 * image.
 *
 * When no chapter has pushed a background (i.e. `currentBackgroundUrl()`
 * is null), this layer falls back to the theme-appropriate default
 * (`/bg-dark.png` or `/bg-light.png`) so the rest of the site has a
 * consistent backdrop. The `<main>` element is transparent and lets this
 * show through.
 *
 * The element is intentionally a SolidJS island: Astro `transition:persist`
 * on the wrapping element preserves the DOM across page navigations, so
 * the backdrop survives chapter→chapter transitions and crossfades
 * naturally between them.
 *
 * Honours `prefers-reduced-motion` via CSS — the transition collapses to
 * an instant swap there.
 */
export const BackgroundLayer = () => {
  const { resolvedTheme } = useTheme()
  // Two slots so we can crossfade between them — one shows the previous
  // image while the other fades the new one in.
  const [layerA, setLayerA] = createSignal<string | null>(null)
  const [layerB, setLayerB] = createSignal<string | null>(null)
  const [activeIsA, setActiveIsA] = createSignal(true)

  // The image we want to show: an explicit chapter push if there is one,
  // else the theme default. This is the single source of truth for the
  // crossfade — flip the layers whenever it changes.
  const targetUrl = (): string => {
    const explicit = currentBackgroundUrl()
    if (explicit) return resolveCoverArtUrl(explicit) ?? explicit
    return resolvedTheme() === 'chronicle' ? '/bg-dark.png' : '/bg-light.png'
  }

  createEffect(() => {
    const next = targetUrl()
    // Read+flip activeIsA non-reactively so the effect's only dependency
    // is `targetUrl()`. Without untrack, writing setActiveIsA would
    // retrigger this effect, causing infinite recursion.
    untrack(() => {
      if (activeIsA()) {
        // A is currently visible — load the new image into B and flip.
        setLayerB(next)
        setActiveIsA(false)
      } else {
        setLayerA(next)
        setActiveIsA(true)
      }
    })
  })

  return (
    <div class={styles.layerRoot} aria-hidden="true">
      <div
        class={styles.layer}
        style={{
          opacity: activeIsA() ? 1 : 0,
          'background-image': layerA() ? `url(${layerA()})` : 'none',
        }}
      />
      <div
        class={styles.layer}
        style={{
          opacity: activeIsA() ? 0 : 1,
          'background-image': layerB() ? `url(${layerB()})` : 'none',
        }}
      />
      {/* Subtle dark scrim so prose stays legible against bright chapter
          images. Only applied for explicit chapter backgrounds — the
          theme default `/bg-{dark,light}.png` images are already designed
          to sit behind text without an extra scrim. */}
      <Show when={currentBackgroundUrl()}>
        <div class={styles.scrim} />
      </Show>
    </div>
  )
}
