import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { AuthRequest } from '../../middleware/auth'
import { saveMessageVersion } from './saveMessageVersion'

const router = Router()

// POST create a message version explicitly
router.post('/messages/:storyId/:messageId/save-version', async (req, res) => {
  try {
    const { storyId, messageId } = req.params
    const { versionType, content, instruction, model } = req.body
    const userId = (req as any as AuthRequest).userId

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

    // Save the version
    const versionNumber = await saveMessageVersion(
      storyId,
      messageId,
      versionType || 'regeneration',
      content,
      instruction,
      model,
    )

    res.json({ success: true, version: versionNumber })
  } catch (error) {
    console.error('Error saving message version:', error)
    res.status(500).json({ error: 'Failed to save message version' })
  }
})

export default router
