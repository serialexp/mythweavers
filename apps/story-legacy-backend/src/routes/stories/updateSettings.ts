import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { AuthRequest } from '../../middleware/auth'

const router = Router()

// Update story settings (partial update)
router.patch('/stories/:storyId/settings', async (req, res) => {
  try {
    const { storyId } = req.params
    const updates = req.body

    // Only allow updating specific settings fields
    const allowedFields = [
      'name',
      'person',
      'tense',
      'storySetting',
      'globalScript',
      'selectedChapterId',
      'selectedNodeId',
      'branchChoices',
      'timelineStartTime',
      'timelineEndTime',
      'timelineGranularity',
      'provider',
      'model',
    ]
    const filteredUpdates: any = {}

    for (const field of allowedFields) {
      if (field in updates) {
        filteredUpdates[field] = updates[field]
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' })
    }

    // Check ownership first
    const story = await prisma.story.findFirst({
      where: {
        id: storyId,
        userId: (req as any as AuthRequest).userId,
        deleted: false,
      },
    })

    if (!story) {
      res.status(404).json({ error: 'Story not found or access denied' })
    }

    // Update the story
    const updatedStory = await prisma.story.update({
      where: { id: storyId },
      data: {
        ...filteredUpdates,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        person: true,
        tense: true,
        storySetting: true,
        globalScript: true,
        timelineStartTime: true,
        timelineEndTime: true,
        timelineGranularity: true,
        provider: true,
        model: true,
        updatedAt: true,
      },
    })

    res.json(updatedStory)
  } catch (error) {
    console.error('Error updating story settings:', error)
    if ((error as any).code === 'P2025') {
      res.status(404).json({ error: 'Story not found' })
    }
    res.status(500).json({ error: 'Failed to update story settings' })
  }
})

export default router
