import { z } from 'zod'
import { StoryStatus, StoryType } from '../generated/prisma/client/index.js'
import { storycardFields } from '../lib/storycard-fields.js'
import { prisma } from '../prisma.js'
import { publicProcedure } from '../trpc.js'
import { getStoryAssetUrl } from '../util/get-asset-url.js'

export const searchStories = publicProcedure
  .input(
    z.object({
      query: z.string().optional(),
      status: z.nativeEnum(StoryStatus).optional(),
      type: z.nativeEnum(StoryType).optional(),
      tags: z.array(z.string()).optional(),
      minWordsPerWeek: z.number().optional(),
      maxWordsPerWeek: z.number().optional(),
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    }),
  )
  .query(async ({ input }) => {
    const { query, status, type, tags, minWordsPerWeek, maxWordsPerWeek, limit, offset } = input

    // Base conditions that don't depend on the search query
    const baseConditions = [
      // Filter by status if provided
      status ? { status } : {},
      // Filter by type if provided
      type ? { type } : {},
      // Filter by words per week range if provided
      minWordsPerWeek ? { wordsPerWeek: { gte: minWordsPerWeek } } : {},
      maxWordsPerWeek ? { wordsPerWeek: { lte: maxWordsPerWeek } } : {},
      // Filter by tags if provided
      tags && tags.length > 0
        ? {
            storyTags: {
              some: {
                tag: {
                  name: {
                    in: tags,
                  },
                },
              },
            },
          }
        : {},
    ]

    const where = {
      AND: [
        ...baseConditions,
        // Add search conditions if query is provided
        query
          ? {
              OR: [{ name: { contains: query } }, { summary: { contains: query } }],
            }
          : {},
      ],
    }

    // Get all matching stories first
    const stories = await prisma.story.findMany({
      where,
      select: {
        ...storycardFields,
        storyTags: {
          select: {
            tag: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      skip: offset,
      take: limit,
    })

    const totalCount = await prisma.story.count({ where })

    // If there's a search query, sort results by relevance
    if (query) {
      const lowerQuery = query.toLowerCase()
      stories.sort((a, b) => {
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()
        const aSummary = (a.summary || '').toLowerCase()
        const bSummary = (b.summary || '').toLowerCase()

        // Calculate relevance scores
        let aScore = 0
        let bScore = 0

        // Exact name matches get highest priority
        if (aName === lowerQuery) aScore += 100
        if (bName === lowerQuery) bScore += 100

        // Name contains query gets high priority
        if (aName.includes(lowerQuery)) aScore += 50
        if (bName.includes(lowerQuery)) bScore += 50

        // Summary contains query gets lower priority
        if (aSummary.includes(lowerQuery)) aScore += 10
        if (bSummary.includes(lowerQuery)) bScore += 10

        // Word boundary matches in name get bonus points
        const aNameWords = aName.split(/\s+/)
        const bNameWords = bName.split(/\s+/)
        if (aNameWords.some((word) => word === lowerQuery)) aScore += 25
        if (bNameWords.some((word) => word === lowerQuery)) bScore += 25

        // If scores are equal, maintain original sort order
        if (aScore === bScore) {
          return a.sortOrder - b.sortOrder
        }

        return bScore - aScore
      })
    }

    return {
      stories: stories.map((s) => ({
        ...s,
        coverArtAsset: getStoryAssetUrl(s.ownerId, s.id, s.coverArtAsset),
        tags: s.storyTags.map((st) => st.tag.name),
      })),
      totalCount,
    }
  })
