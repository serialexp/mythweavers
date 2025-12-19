import short from 'short-uuid'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

const translator = short()

export const publishStory = protectedProcedure
  .input(
    z.object({
      storyId: z.string(),
      publish: z.boolean(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const { storyId, publish } = input
    const userId = ctx.authenticatedUser.id

    const story = await prisma.story.findFirst({
      where: {
        id: translator.toUUID(storyId),
        ownerId: userId,
      },
    })

    if (!story) {
      throw new Error('Story not found or you do not have access to it.')
    }

    await prisma.story.update({
      where: { id: translator.toUUID(storyId) },
      data: { published: publish },
    })

    return { success: true, published: publish }
  })
