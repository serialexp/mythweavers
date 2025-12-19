import { z } from 'zod'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

export const addParagraphComment = protectedProcedure
  .input(
    z.object({
      paragraphRevisionId: z.string(),
      ownerId: z.number(),
      body: z.string(),
      type: z.enum(['COMMENT', 'SUGGESTION']).optional().default('COMMENT'),
    }),
  )
  .mutation(async ({ input }) => {
    const { paragraphRevisionId, ownerId, body, type } = input

    const comment = await prisma.paragraphComment.create({
      data: {
        paragraphRevisionId,
        ownerId,
        body,
        type,
      },
    })

    return comment
  })
