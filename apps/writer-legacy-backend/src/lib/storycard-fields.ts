import type { Prisma } from '../generated/prisma/client/index.js'

export const storycardFields: Prisma.StorySelect = {
  id: true,
  name: true,
  summary: true,
  coverArtFile: true,
  coverColor: true,
  coverTextColor: true,
  coverFontFamily: true,
  firstChapterReleasedAt: true,
  spellingLevel: true,
  lastChapterReleasedAt: true,
  royalRoadId: true,
  sortOrder: true,
  wordsPerWeek: true,
  pages: true,
  status: true,
  ownerId: true,
  owner: {
    select: {
      name: true,
    },
  },
}
