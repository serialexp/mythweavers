import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

export const connectedClients = protectedProcedure.query(async ({ ctx }) => {
  const _key = prisma.accessKey.findMany({
    where: {
      owner: {
        id: ctx.accessKey?.ownerId,
      },
    },
  })
})
