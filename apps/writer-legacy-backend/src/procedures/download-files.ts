import z from 'zod'
import { protectedProcedure } from '../trpc.js'

export const downloadFiles = protectedProcedure
  .input(
    z.object({
      storyId: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {})
