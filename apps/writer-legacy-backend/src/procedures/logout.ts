import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

export const logout = protectedProcedure.mutation(async ({ ctx }) => {
  await prisma.accessKey.delete({
    where: {
      key: ctx.token,
    },
  })
})
