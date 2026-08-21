export interface TaskProgress {
  completed: number
  total: number
}

/** Run asynchronous work with a fixed upper bound on concurrent tasks. */
export async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
  onProgress?: (progress: TaskProgress) => void,
): Promise<PromiseSettledResult<void>[]> {
  const results: PromiseSettledResult<void>[] = new Array(items.length)
  const workerCount = Math.min(items.length, Math.max(1, Math.floor(concurrency)))
  let nextIndex = 0
  let completed = 0

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      try {
        await task(items[index])
        results[index] = { status: 'fulfilled', value: undefined }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      } finally {
        completed += 1
        onProgress?.({ completed, total: items.length })
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker))
  return results
}
