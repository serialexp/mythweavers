import { storycardFields } from '../lib/storycard-fields.js'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'
import { getStoryAssetUrl } from '../util/get-asset-url.js'

export const getBookshelfStories = protectedProcedure.query(async ({ ctx }) => {
  const userId = ctx.authenticatedUser.id

  const bookshelfStories = await prisma.bookShelfStory.findMany({
    where: { ownerId: userId },
    include: {
      story: {
        select: storycardFields,
      },
    },
  })

  return bookshelfStories.map((bookshelfStory) => ({
    id: bookshelfStory.story.id,
    name: bookshelfStory.story.name,
    kind: bookshelfStory.kind,
    ownerName: bookshelfStory.story.owner.name,
    summary: bookshelfStory.story.summary,
    color: bookshelfStory.story.coverColor,
    textColor: bookshelfStory.story.coverTextColor,
    royalRoadId: bookshelfStory.story.royalRoadId,
    coverArtAsset: getStoryAssetUrl(
      bookshelfStory.story.ownerId,
      bookshelfStory.story.id,
      bookshelfStory.story.coverArtAsset,
    ), // Updated line
    pages: bookshelfStory.story.pages,
  }))
})
