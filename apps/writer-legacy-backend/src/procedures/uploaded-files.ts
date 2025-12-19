import { z } from 'zod'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

export const listUploadedFiles = protectedProcedure
  .input(
    z.object({
      storyId: z.string(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const files = await prisma.file.findMany({
      where: {
        ownerId: ctx.authenticatedUser.id,
        storyId: input.storyId,
      },
      select: {
        id: true,
        localPath: true,
        path: true,
        sha256: true,
        mimeType: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return files.map((file) => {
      return {
        ...file,
        fullUrl: `https://team.wtf/${file.path}`,
      }
    })
  })
