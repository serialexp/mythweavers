import { z } from 'zod'
import type { Prisma } from '../generated/prisma/client/index.js'
import { storycardFields } from '../lib/storycard-fields.js'
import { prisma } from '../prisma.js'
import { publicProcedure } from '../trpc.js'
import { getStoryAssetUrl } from '../util/get-asset-url.js'

export const listRandomStories = publicProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100).optional().default(10),
    }),
  )
  .query(async ({ input }) => {
    const { limit } = input

    const whereConditions: Prisma.StoryWhereInput = {
      AND: {
        summary: {
          not: '',
        },
        spellingLevel: {
          gte: 3,
        },

        OR: [
          // last chapter released in the last 60 days (e.g. not on hiatus)
          {
            lastChapterReleasedAt: {
              gt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
            },
          },
          // long completed stories
          {
            pages: {
              gt: 500,
            },
            status: 'COMPLETED',
          },
          // newly created stories with a minimum of content
          {
            firstChapterReleasedAt: {
              // created in the last 3 days
              gt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
            },
            pages: {
              gt: 3,
            },
          },
        ],
      },
    }

    const storiesCount = await prisma.story.count({
      where: whereConditions,
    })
    const randomStoryIndex = Math.max(Math.floor(Math.random() * (storiesCount - limit)), 0)

    const stories = await prisma.story.findMany({
      select: storycardFields,
      orderBy: {
        sortOrder: 'asc',
      },
      where: whereConditions,
      // this works fine as long as we don't have millions of stories...
      skip: randomStoryIndex,
      take: limit,
    })

    return {
      stories: stories.map((s) => {
        const coverArtAsset = getStoryAssetUrl(s.ownerId, s.id, s.coverArtAsset)

        return {
          ...s,
          coverArtAsset: coverArtAsset,
        }
      }),
    }
  })
