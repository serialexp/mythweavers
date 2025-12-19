import { Router } from 'express'
import { prisma } from '../../lib/prisma'

const router = Router()

// POST new chapter
router.post('/chapters', async (req, res) => {
  try {
    const { storyId, title, afterMessageId } = req.body
    console.log('[/api/chapters POST] Creating chapter:', {
      storyId,
      title,
      afterMessageId,
    })

    // Start a transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get the story to verify it exists
      console.log('[/api/chapters POST] Looking for story with ID:', storyId)

      // First, let's check what stories exist
      const allStories = await tx.story.findMany({
        select: { id: true, name: true },
      })
      console.log('[/api/chapters POST] All stories in database:', allStories)

      const story = await tx.story.findUnique({
        where: { id: storyId },
        include: {
          chapters: true,
          messages: {
            where: { deleted: false },
            orderBy: { order: 'asc' },
          },
        },
      })

      if (!story) {
        console.log('[/api/chapters POST] Story not found with ID:', storyId)

        // Get list of existing story IDs to help debug
        const existingStories = await tx.story.findMany({
          select: { id: true, name: true },
          take: 10, // Limit to avoid exposing too much data
          orderBy: { updatedAt: 'desc' },
        })

        // Throw a plain object instead of Error to avoid inheritance issues
        res.status(404).json({
          message: 'Story not found',
          existingStories: existingStories,
          requestedId: storyId,
        })
        return
      }
      console.log('[/api/chapters POST] Found story:', story.name)

      // Create the chapter (no order field anymore)
      const chapter = await tx.chapter.create({
        data: {
          storyId,
          title,
        },
      })

      return { chapter }
    })

    res.json(result)
  } catch (error) {
    console.error('Error creating chapter:', error)

    res.status(500).json({
      error: error instanceof Error ? error.stack : 'Failed to create chapter',
    })
  }
})

export default router
