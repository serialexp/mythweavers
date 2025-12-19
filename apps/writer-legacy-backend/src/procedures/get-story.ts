import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

export const getStory = protectedProcedure.input(z.object({ storyId: z.string() })).query(async ({ ctx, input }) => {
  const story = await prisma.story.findUnique({
    where: { id: input.storyId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      books: {
        where: { nodeType: 'story' },
        include: {
          chapters: {
            where: { nodeType: 'story', publishedOn: { lte: new Date() } },
            include: {
              scenes: {
                where: { nodeType: 'story' },
                orderBy: { sortOrder: 'asc' },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!story) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Story not found',
    })
  }

  return story
})
