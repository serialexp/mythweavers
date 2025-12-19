import { Router } from 'express'
import { prisma } from '../../lib/prisma'

const router = Router()

// DELETE chapter
router.delete('/chapters/:id', async (req, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      // Get the chapter to find its marker
      const chapter = await tx.chapter.findUnique({
        where: { id: req.params.id },
      })

      if (!chapter) {
        throw new Error('Chapter not found')
      }

      // Delete the chapter marker message
      await tx.message.deleteMany({
        where: {
          chapterId: req.params.id,
          type: 'chapter',
        },
      })

      // Remove chapter association from messages
      await tx.message.updateMany({
        where: { chapterId: req.params.id },
        data: { chapterId: null },
      })

      // Delete the chapter (no need to reorder anymore)
      await tx.chapter.delete({
        where: { id: req.params.id },
      })
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting chapter:', error)
    res.status(500).json({ error: 'Failed to delete chapter' })
  }
})

export default router
