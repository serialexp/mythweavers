import { z } from 'zod'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

export const updateStoryReadStatus = protectedProcedure
  .input(
    z.object({
      storyId: z.string(),
      lastChapterId: z.string().optional(),
      override: z.boolean().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const { storyId, lastChapterId } = input
    const userId = ctx.authenticatedUser.id

    const existingStatus = await prisma.storyReadStatus.findFirst({
      where: {
        storyId,
        userId,
      },
      include: {
        lastChapter: true,
      },
    })

    const currentChapter = await prisma.chapter.findUnique({
      where: {
        id: lastChapterId,
      },
    })

    if (
      currentChapter &&
      existingStatus?.lastChapter &&
      currentChapter.sortOrder < existingStatus.lastChapter.sortOrder &&
      !input.override
    ) {
      return {
        success: false,
        errorCode: 'CHAPTER_OUT_OF_ORDER',
        message: "You can't set you read status to an earlier chapter when you've already read a later chapter.",
      }
    }

    if (existingStatus) {
      // Update the existing read status
      await prisma.storyReadStatus.update({
        where: { id: existingStatus.id },
        data: {
          lastChapterId,
          lastChapterReadAt: new Date(),
        },
      })
    } else {
      // Create a new read status entry
      await prisma.storyReadStatus.create({
        data: {
          storyId,
          userId,
          lastChapterId,
          lastChapterReadAt: new Date(),
        },
      })
    }

    return { success: true }
  })
