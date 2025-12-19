import z from 'zod'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

export const updateClientName = protectedProcedure
  .input(
    z.object({
      description: z.string(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    // Get the token from the context
    const token = ctx.token
    if (!token) {
      throw new Error('No authorization token provided')
    }

    // Update the access key description
    const updatedAccessKey = await prisma.accessKey.update({
      where: {
        key: token,
      },
      data: {
        description: input.description,
      },
    })

    return updatedAccessKey
  })
