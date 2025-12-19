import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { AuthRequest } from '../../middleware/auth'

const router = Router()

// DELETE story (soft delete - marks as deleted)
router.delete('/stories/:id', async (req, res) => {
  try {
    const result = await prisma.story.updateMany({
      where: {
        id: req.params.id,
        userId: (req as any as AuthRequest).userId,
        deleted: false,
      },
      data: { deleted: true },
    })

    if (result.count === 0) {
      res.status(404).json({ error: 'Story not found or access denied' })
      return
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting story:', error)
    res.status(500).json({ error: 'Failed to delete story' })
  }
})

export default router
