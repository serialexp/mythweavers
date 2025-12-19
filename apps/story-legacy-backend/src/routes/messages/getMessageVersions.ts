import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { AuthRequest } from '../../middleware/auth'

const router = Router()

// Get all versions for a message
router.get('/messages/:storyId/:messageId/versions', async (req, res) => {
  try {
    const userId = (req as any as AuthRequest).userId
    const { storyId, messageId } = req.params

    // Verify the user owns the story
    const story = await prisma.story.findFirst({
      where: {
        id: storyId,
        userId,
        deleted: false,
      },
    })

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
    }

    // Get all versions for this message
    const versions = await prisma.messageVersion.findMany({
      where: {
        storyId,
        messageId,
      },
      orderBy: {
        version: 'desc',
      },
    })

    // Get the current message content for comparison
    const currentMessage = await prisma.message.findUnique({
      where: {
        storyId_id: {
          storyId,
          id: messageId,
        },
      },
      select: {
        content: true,
        instruction: true,
        model: true,
      },
    })

    res.json({
      current: currentMessage,
      versions,
    })
  } catch (error) {
    console.error('Error getting message versions:', error)
    res.status(500).json({ error: 'Failed to get message versions' })
  }
})

export default router
