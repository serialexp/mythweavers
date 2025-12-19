import { Router } from 'express'
import { prisma } from '../../lib/prisma'

const router = Router()

// PUT update chapter
router.put('/chapters/:id', async (req, res) => {
  try {
    const { title, summary, expanded, status, includeInFull } = req.body

    const chapter = await prisma.chapter.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(summary !== undefined && { summary }),
        ...(expanded !== undefined && { expanded }),
        ...(status !== undefined && { status }),
        ...(includeInFull !== undefined && { includeInFull }),
      },
    })

    // If title changed, update the marker message
    if (title !== undefined) {
      await prisma.message.updateMany({
        where: {
          chapterId: req.params.id,
          type: 'chapter',
        },
        data: {
          content: `[Chapter: ${title}]`,
        },
      })
    }

    res.json(chapter)
  } catch (error) {
    console.error('Error updating chapter:', error)
    res.status(500).json({ error: 'Failed to update chapter' })
  }
})

export default router
