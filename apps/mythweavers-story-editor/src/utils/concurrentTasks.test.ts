import { describe, expect, it } from 'vitest'
import { runWithConcurrency } from './concurrentTasks'

describe('runWithConcurrency', () => {
  it('limits concurrent tasks and reports completion progress', async () => {
    let active = 0
    let maxActive = 0
    const releases: Array<() => void> = []
    const progress: number[] = []

    const running = runWithConcurrency(
      [1, 2, 3, 4, 5, 6, 7],
      5,
      async () => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await new Promise<void>((resolve) => releases.push(resolve))
        active -= 1
      },
      ({ completed }) => progress.push(completed),
    )

    await Promise.resolve()
    expect(active).toBe(5)

    while (releases.length > 0) {
      releases.shift()?.()
      await Promise.resolve()
    }
    await running

    expect(maxActive).toBe(5)
    expect(progress).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('continues after failures and returns results in input order', async () => {
    const results = await runWithConcurrency([1, 2, 3], 2, async (item) => {
      if (item === 2) throw new Error('failed')
    })

    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled'])
  })
})
