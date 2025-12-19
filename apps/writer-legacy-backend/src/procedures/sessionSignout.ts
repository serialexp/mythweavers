import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

export const sessionSignout = protectedProcedure.mutation(async ({ ctx }) => {
  await prisma.session.delete({
    where: {
      id: ctx.token,
    },
  })
})
