import { z } from 'zod'
import type { Prisma } from '../generated/prisma/client/index.js'
import { storycardFields } from '../lib/storycard-fields.js'
import { prisma } from '../prisma.js'
import { publicProcedure } from '../trpc.js'
import { getStoryAssetUrl } from '../util/get-asset-url.js'

export const listStories = publicProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(500).optional().default(10),
      cursor: z.number().optional(),
      filterAbandoned: z.boolean().optional().default(false),
      genre: z.string().optional(),
    }),
  )
  .query(async ({ input }) => {
    const { limit, cursor, genre, filterAbandoned } = input

    console.log('input', input)
    const baseFilter: Prisma.StoryWhereInput = {
      sortOrder: cursor ? { gte: cursor } : undefined,
      storyTags: genre ? { some: { tag: { name: { equals: genre } } } } : undefined,
      pages: {
        gt: 0,
      },
    }
    const stories = await prisma.story.findMany({
      select: storycardFields,
      take: limit + 1,
      where: {
        ...baseFilter,
        ...(filterAbandoned ? { OR: [{ status: { not: 'HIATUS' } }, { pages: { gt: 400 } }] } : {}),
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })

    let nextCursor: typeof cursor | undefined = undefined
    if (stories.length > limit) {
      const nextItem = stories.pop()

      nextCursor = nextItem?.sortOrder
    }

    return {
      stories: stories.map((s) => {
        const coverArtAsset = getStoryAssetUrl(s.ownerId, s.id, s.coverArtAsset)

        return {
          ...s,
          coverArtAsset: coverArtAsset,
        }
      }),
      nextCursor,
    }
  })
