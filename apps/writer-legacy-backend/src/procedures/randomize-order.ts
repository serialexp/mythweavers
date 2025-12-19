import PQueue from 'p-queue'
import { prisma } from '../prisma.js'
import { adminProcedure } from '../trpc.js'

export const randomizeOrder = adminProcedure.mutation(async () => {
  const stories = await prisma.story.findMany({
    select: {
      id: true,
    },
  })

  // make array with new unique (no duplicates) random numbers
  const uniqueRandomNumbers = Array.from(
    new Set(Array.from({ length: 1000000 }, () => Math.floor(Math.random() * 1000000))).values(),
  )

  // shuffle the array
  uniqueRandomNumbers.sort(() => Math.random() - 0.5)

  const queue = new PQueue({ concurrency: 20 })
  const batchSize = 50
  const batches = []

  // Create batches of stories
  for (let i = 0; i < stories.length; i += batchSize) {
    const batch = stories.slice(i, i + batchSize)
    batches.push(batch)
  }

  // Process each batch concurrently
  await Promise.all(
    batches.map((batch) =>
      queue.add(async () => {
        const updates = batch.map((story) => ({
          where: { id: story.id },
          data: { sortOrder: uniqueRandomNumbers.shift() },
        }))

        // Use prisma transaction for batch update
        await prisma.$transaction(updates.map((update) => prisma.story.update(update)))
      }),
    ),
  )
})
