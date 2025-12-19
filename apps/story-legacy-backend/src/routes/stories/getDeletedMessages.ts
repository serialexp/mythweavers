import { Request, Response, Router } from 'express'
import { prisma } from '../../lib/prisma'

const router = Router()

// Get deleted messages for a story
router.get('/stories/:id/deleted-messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const limit = Number.parseInt(req.query.limit as string) || 20

    const deletedMessages = await prisma.message.findMany({
      where: {
        storyId: id,
        deleted: true,
        role: 'assistant',
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        id: true,
        content: true,
        instruction: true,
        timestamp: true,
        model: true,
        totalTokens: true,
        order: true,
      },
    })

    res.json(deletedMessages)
  } catch (error) {
    console.error('Error fetching deleted messages:', error)
    res.status(500).json({ error: 'Failed to fetch deleted messages' })
  }
})

export default router
