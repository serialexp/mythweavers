import short from 'short-uuid'
import { z } from 'zod'
import { PublishingPlatform, PublishingStatus } from '../generated/prisma/client/index.js'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'
const translator = short()

/**
 * Syncs the publishing status for all chapters that need to be published to Royal Road
 * This will create publishing entities for chapters that have been modified since their last publish
 * @param userId The ID of the user who owns the chapters
 * @returns Object with success status, count of synced chapters, and any errors
 */
export async function syncRoyalRoadPublishing(
  _userId: number,
  _storyId: string,
  chapterData: {
    id: string
    royalRoadId: number
    modifiedAt: string
  }[],
) {
  try {
    let syncedCount = 0
    const errors: string[] = []
    console.log('chapterData', chapterData)

    // For each chapter, check if it needs a publishing record
    for (const chapter of chapterData) {
      try {
        // Check if a publishing record already exists
        const existingPublishing = await prisma.chapterPublishing.findUnique({
          where: {
            platform_platformId: {
              platform: PublishingPlatform.ROYAL_ROAD,
              platformId: chapter.royalRoadId.toString(),
            },
          },
        })

        if (!existingPublishing) {
          // Create a new publishing record
          await prisma.chapterPublishing.create({
            data: {
              chapterId: translator.toUUID(chapter.id),
              platform: PublishingPlatform.ROYAL_ROAD,
              status: PublishingStatus.PUBLISHED,
              publishedAt: new Date(chapter.modifiedAt),
              platformId: chapter.royalRoadId.toString(),
              lastAttempt: new Date(chapter.modifiedAt),
            },
          })
          syncedCount++
        }
      } catch (error) {
        console.error(`Error syncing chapter ${chapter.id}: ${error}`)
        errors.push(`Error syncing chapter ${chapter.id}: ${error}`)
      }
    }

    return {
      success: true,
      syncedCount,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error('Failed to sync Royal Road publishing:', error)
    return {
      success: false,
      syncedCount: 0,
      error: error?.toString() || 'Unknown error',
    }
  }
}

export const syncRoyalRoadPublishingProcedure = protectedProcedure
  .input(
    z.object({
      storyId: z.string(),
      chapterData: z.array(
        z.object({
          id: z.string(),
          royalRoadId: z.number(),
          modifiedAt: z.string().datetime(),
        }),
      ),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return syncRoyalRoadPublishing(ctx.authenticatedUser.id, input.storyId, input.chapterData)
  })
