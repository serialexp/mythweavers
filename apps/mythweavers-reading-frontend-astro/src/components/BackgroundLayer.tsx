import { Show, createEffect, createSignal } from 'solid-js'
import { currentBackgroundUrl } from '../stores/backgroundStore'
import { resolveCoverArtUrl } from '../lib/api'
import * as styles from './BackgroundLayer.css'

/**
 * Two-layer crossfading background image renderer mounted in the global
 * Layout. Listens to {@link currentBackgroundUrl}; whenever it changes,
 * the active layer fades out and the inactive layer fades in to the new
 * image.
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
  // Two slots so we can crossfade between them — one shows the previous
  // image while the other fades the new one in.
  const [layerA, setLayerA] = createSignal<string | null>(null)
  const [layerB, setLayerB] = createSignal<string | null>(null)
  const [activeIsA, setActiveIsA] = createSignal(true)

  createEffect(() => {
    const next = currentBackgroundUrl()
    const resolved = resolveCoverArtUrl(next)
    if (activeIsA()) {
      // A is currently visible — load the new image into B and flip.
      setLayerB(resolved)
      setActiveIsA(false)
    } else {
      setLayerA(resolved)
      setActiveIsA(true)
    }
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
      {/* Subtle dark scrim so prose stays legible against bright images.
          Hidden when no background is set so the page background shows
          through cleanly. */}
      <Show when={currentBackgroundUrl()}>
        <div class={styles.scrim} />
      </Show>
    </div>
  )
}
