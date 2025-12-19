import { z } from 'zod'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

export const checkBookshelfState = protectedProcedure
  .input(
    z.object({
      storyId: z.string(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const { storyId } = input
    const userId = ctx.authenticatedUser.id

    // Fetch all kinds for the given storyId and userId
    const shelfEntries = await prisma.bookShelfStory.findMany({
      where: {
        storyId,
        ownerId: userId,
      },
      select: {
        kind: true,
      },
    })

    // Map the results to an object indicating presence of each kind
    const kinds = ['FAVORITE', 'FOLLOW', 'READ_LATER']
    const result = kinds.reduce(
      (acc, kind) => {
        acc[kind] = shelfEntries.some((entry) => entry.kind === kind)
        return acc
      },
      {} as Record<string, boolean>,
    )

    return result
  })
