import { z } from 'zod'
import { prisma } from '../prisma.js'
import { publicProcedure } from '../trpc.js'

export const getChapter = publicProcedure.input(z.object({ chapterId: z.string() })).query(async ({ input }) => {
  const { chapterId } = input

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: {
      scenes: {
        orderBy: { sortOrder: 'asc' },
        include: {
          paragraphs: {
            orderBy: { sortOrder: 'asc' },
            include: {
              paragraphRevisions: {
                orderBy: { createdAt: 'desc' },
                distinct: ['paragraphId'],
                select: {
                  id: true,
                  body: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
      book: {
        select: {
          chapters: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true },
            where: {
              publishedOn: {
                lte: new Date(),
              },
            },
          },
        },
      },
    },
  })

  if (!chapter) {
    throw new Error('Chapter not found')
  }

  const chapters = chapter.book?.chapters
  const currentIndex = chapters?.findIndex((ch) => ch.id === chapterId)
  if (currentIndex === undefined) {
    throw new Error('Chapter not found')
  }
  if (!chapters) {
    throw new Error('Chapters not found')
  }
  const previousChapterId = currentIndex > 0 ? chapters[currentIndex - 1].id : null
  const nextChapterId = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1].id : null

  return {
    id: chapter.id,
    name: chapter.name,
    scenes: chapter.scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      paragraphs: scene.paragraphs.map((paragraph) => ({
        id: paragraph.id,
        latestRevision: paragraph.paragraphRevisions[0],
      })),
    })),
    previousChapterId,
    nextChapterId,
  }
})
