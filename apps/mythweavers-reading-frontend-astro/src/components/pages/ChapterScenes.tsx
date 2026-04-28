import { For, onCleanup, onMount } from 'solid-js'
import { Prose } from '@mythweavers/ui'
import { resolveCoverArtUrl, type ChapterScene } from '../../lib/api'
import { setBackground } from '../../stores/backgroundStore'
import * as styles from './ChapterScenes.css'

export interface ChapterScenesProps {
  scenes: ChapterScene[]
  enteringBackgroundUrl: string | null
}

/**
 * Renders the structured chapter body: paragraphs blocks become `<Prose>`,
 * background blocks become invisible scroll anchors. A single
 * IntersectionObserver across all anchors on this page pushes the active
 * background URL into {@link setBackground} as the reader scrolls past
 * each anchor.
 *
 * "Active" means: the most recent anchor whose top has crossed a
 * threshold ~40% from the top of the viewport. Walking back up the page
 * re-applies the previous anchor naturally — the threshold check is
 * stateless.
 */
export const ChapterScenes = (props: ChapterScenesProps) => {
  let containerRef: HTMLDivElement | undefined
  let observer: IntersectionObserver | undefined

  // Compute & push the currently-active background based on which
  // anchors have scrolled past the threshold. Uses the actual DOM
  // bounding rects rather than the IntersectionObserver entry, so the
  // result is consistent whether a callback fired for any specific
  // anchor or none did.
  const recomputeActive = () => {
    if (!containerRef) return
    const anchors = Array.from(
      containerRef.querySelectorAll<HTMLElement>('[data-bg-url]'),
    )
    const threshold = window.innerHeight * 0.4
    let activeUrl: string | null = props.enteringBackgroundUrl
    for (const a of anchors) {
      const top = a.getBoundingClientRect().top
      if (top <= threshold) {
        activeUrl = a.dataset.bgUrl ?? null
      } else {
        break
      }
    }
    setBackground(activeUrl)
  }

  onMount(() => {
    // Push the carry-in background immediately on mount.
    setBackground(props.enteringBackgroundUrl)

    if (!containerRef) return
    observer = new IntersectionObserver(() => recomputeActive(), {
      // Trigger when an anchor enters/exits the top 40% band of the
      // viewport. The exact threshold is enforced in recomputeActive —
      // this rootMargin just decides when to re-evaluate.
      rootMargin: '0px 0px -60% 0px',
      threshold: 0,
    })
    for (const a of containerRef.querySelectorAll<HTMLElement>('[data-bg-url]')) {
      observer.observe(a)
    }

    // Also recompute on scroll/resize for the cases where no anchor
    // fired (e.g. user scrolled fast through a region between anchors).
    const onScrollOrResize = () => recomputeActive()
    window.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('resize', onScrollOrResize)
    onCleanup(() => {
      observer?.disconnect()
      window.removeEventListener('scroll', onScrollOrResize)
      window.removeEventListener('resize', onScrollOrResize)
    })

    // Initial recompute in case the page loaded scrolled mid-chapter
    // (e.g. fragment link).
    recomputeActive()
  })

  return (
    <div ref={containerRef} class={styles.scenesContainer}>
      <For each={props.scenes}>
        {(scene) => (
          <div data-scene-id={scene.id}>
            <For each={scene.blocks}>
              {(block) => {
                if (block.type === 'paragraphs') {
                  return <Prose html={block.html} size="lg" center />
                }
                if (block.type === 'audio') {
                  // Inline <audio controls>. No autoplay and no scroll
                  // trigger — the reader presses play themselves, and
                  // there's no global "currently playing" state because
                  // each embed is a discrete moment in the chapter.
                  // preload="metadata" so the duration shows up without
                  // pulling the whole file before they decide to play.
                  const absoluteUrl = resolveCoverArtUrl(block.url) ?? block.url
                  return (
                    <div class={styles.audioWrap}>
                      <audio
                        class={styles.audioPlayer}
                        src={absoluteUrl}
                        controls
                        preload="metadata"
                      >
                        <source src={absoluteUrl} type={block.mimeType} />
                      </audio>
                    </div>
                  )
                }
                // Invisible anchor — IntersectionObserver tracks its
                // position and pushes its URL when it crosses the
                // threshold. Resolve URL once at render so the dataset
                // value is the absolute URL the layer ultimately needs.
                const absoluteUrl = resolveCoverArtUrl(block.url) ?? block.url
                return (
                  <div
                    class={styles.bgAnchor}
                    data-bg-url={absoluteUrl}
                    data-bg-id={block.fileId}
                    aria-hidden="true"
                  />
                )
              }}
            </For>
          </div>
        )}
      </For>
    </div>
  )
}
