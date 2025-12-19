import { z } from 'zod'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

export const setBookshelfState = protectedProcedure
  .input(
    z.object({
      storyId: z.string(),
      kind: z.enum(['FAVORITE', 'FOLLOW', 'READ_LATER']),
      action: z.enum(['ADD', 'REMOVE']), // New input parameter for action
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const { storyId, kind, action } = input
    const userId = ctx.authenticatedUser.id

    // Check if the story already exists in the user's bookshelf
    const existingEntry = await prisma.bookShelfStory.findFirst({
      where: {
        storyId,
        ownerId: userId,
        kind,
      },
    })

    if (action === 'ADD') {
      if (existingEntry) {
        throw new Error('Story already exists in your bookshelf.')
      }

      // Add the story to the user's bookshelf
      const newEntry = await prisma.bookShelfStory.create({
        data: {
          storyId,
          ownerId: userId,
          kind,
        },
      })

      return newEntry
    }

    if (action === 'REMOVE') {
      if (!existingEntry) {
        throw new Error('Story does not exist in your bookshelf.')
      }

      // Remove the story from the user's bookshelf
      await prisma.bookShelfStory.delete({
        where: {
          id: existingEntry.id,
        },
      })

      return { message: 'Story removed from your bookshelf.' }
    }
  })
