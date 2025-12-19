import short from 'short-uuid'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

const translator = short()

export const getStoryStatus = protectedProcedure
  .input(z.object({ storyId: z.string() }))
  .query(async ({ ctx, input }) => {
    const { storyId } = input
    const userId = ctx.authenticatedUser.id

    const story = await prisma.story.findFirst({
      where: {
        id: translator.toUUID(storyId),
        ownerId: userId,
      },
      select: {
        updatedAt: true,
        published: true,
      },
    })

    if (!story) {
      throw new Error('Story not found or you do not have access to it.')
    }

    return {
      updatedAt: story.updatedAt,
      published: story.published,
    }
  })
