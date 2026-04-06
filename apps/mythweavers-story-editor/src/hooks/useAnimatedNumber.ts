import { Accessor, createEffect, createSignal, on, onCleanup } from 'solid-js'

/**
 * Returns a display value that smoothly increments toward the target number.
 * Uses time-based interpolation so animation speed is consistent regardless
 * of display refresh rate.
 *
 * @param target - Accessor returning the target number
 * @param durationMs - Time in ms to animate from current to target (default 500)
 */
export function useAnimatedNumber(target: Accessor<number>, durationMs = 500): Accessor<number> {
  const [display, setDisplay] = createSignal(target())
  let animationFrame: number | undefined
  let startValue = target()
  let startTime = 0
  let goalValue = target()

  const animate = (timestamp: number) => {
    const elapsed = timestamp - startTime
    const progress = Math.min(elapsed / durationMs, 1)

    // Ease-out curve for a natural feel
    const eased = 1 - (1 - progress) ** 3

    const current = Math.round(startValue + (goalValue - startValue) * eased)
    setDisplay(current)

    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate)
    } else {
      animationFrame = undefined
    }
  }

  createEffect(
    on(target, (newTarget) => {
      // If the target decreased (e.g. switching scenes), snap immediately
      if (newTarget < display()) {
        if (animationFrame !== undefined) {
          cancelAnimationFrame(animationFrame)
          animationFrame = undefined
        }
        setDisplay(newTarget)
        startValue = newTarget
        goalValue = newTarget
        return
      }

      // Start a new animation from current display value to new target
      startValue = display()
      goalValue = newTarget
      startTime = performance.now()

      if (animationFrame === undefined) {
        animationFrame = requestAnimationFrame(animate)
      }
    }),
  )

  onCleanup(() => {
    if (animationFrame !== undefined) {
      cancelAnimationFrame(animationFrame)
    }
  })

  return display
}
