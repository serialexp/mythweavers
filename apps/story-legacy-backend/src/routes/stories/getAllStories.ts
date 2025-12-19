import { Router } from 'express'
import { createLogger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'
import { AuthRequest } from '../../middleware/auth'
import { generateStoryFingerprint } from '../../utils/storyFingerprint'

const router = Router()
const log = createLogger('stories')

// GET all stories (metadata only)
router.get('/stories', async (req, res) => {
  try {
    const authReq = req as any as AuthRequest
    const stories = await prisma.story.findMany({
      where: {
        deleted: false,
        userId: authReq.userId,
      },
      select: {
        id: true,
        name: true,
        savedAt: true,
        updatedAt: true,
        storySetting: true,
        messages: {
          where: { deleted: false },
          select: {
            id: true,
            content: true,
            instruction: true,
            timestamp: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        _count: {
          select: {
            messages: {
              where: { deleted: false },
            },
            characters: true,
            chapters: true,
          },
        },
      },
      orderBy: {
        savedAt: 'desc',
      },
    })

    // Transform the data to match the expected format
    const storiesWithCounts = stories.map((story) => {
      const fingerprint = generateStoryFingerprint(story.messages)
      log.debug(
        {
          storyId: story.id,
          fingerprint,
          messageCount: story.messages.length,
        },
        'Generated story fingerprint',
      )
      return {
        id: story.id,
        name: story.name,
        savedAt: story.savedAt,
        updatedAt: story.updatedAt,
        storySetting: story.storySetting,
        messageCount: story._count.messages,
        characterCount: story._count.characters,
        chapterCount: story._count.chapters,
        fingerprint,
      }
    })

    res.json(storiesWithCounts)
  } catch (error) {
    console.error('Error fetching stories:', error)
    res.status(500).json({ error: 'Failed to fetch stories' })
  }
})

export default router
