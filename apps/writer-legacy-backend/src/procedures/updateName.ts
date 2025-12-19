import z from 'zod'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

export const updateName = protectedProcedure
  .input(
    z.object({
      name: z.string(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    // Update the user's name
    const updatedUser = await prisma.user.update({
      where: {
        id: ctx.authenticatedUser.id,
      },
      data: {
        name: input.name,
      },
    })

    return updatedUser
  })
