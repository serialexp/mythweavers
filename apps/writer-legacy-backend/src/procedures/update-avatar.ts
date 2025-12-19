import z from 'zod'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

export const updateAvatar = protectedProcedure
  .input(
    z.object({
      avatarUrl: z.string(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    // Update the user's avatar URL
    const updatedUser = await prisma.user.update({
      where: {
        id: ctx.authenticatedUser.id,
      },
      data: {
        avatarUrl: input.avatarUrl,
      },
    })

    return updatedUser
  })
