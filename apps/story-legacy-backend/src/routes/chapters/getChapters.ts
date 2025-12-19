import { Router } from 'express'
import { prisma } from '../../lib/prisma'

const router = Router()

// GET all chapters for a story
router.get('/stories/:storyId/chapters', async (req, res) => {
  try {
    // Get chapters without ordering (order will be determined by chapter marker positions)
    const chapters = await prisma.chapter.findMany({
      where: { storyId: req.params.storyId },
    })
    res.json(chapters)
  } catch (error) {
    console.error('Error fetching chapters:', error)
    res.status(500).json({ error: 'Failed to fetch chapters' })
  }
})

export default router
