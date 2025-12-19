import { Request, Response, Router } from 'express'
import { prisma } from '../../lib/prisma'

const router = Router()

// Restore a deleted message
router.post('/stories/:storyId/messages/:messageId/restore', async (req: Request, res: Response) => {
  try {
    const { storyId, messageId } = req.params

    // Use a transaction to ensure consistency
    const restoredMessage = await prisma.$transaction(async (tx) => {
      // First, get the message to restore and its order
      const messageToRestore = await tx.message.findUnique({
        where: {
          storyId_id: {
            storyId,
            id: messageId,
          },
        },
      })

      if (!messageToRestore) {
        throw new Error('Message not found')
      }

      if (!messageToRestore.deleted) {
        throw new Error('Message is not deleted')
      }

      const originalOrder = messageToRestore.order

      // Shift all messages with order >= originalOrder up by 1
      await tx.message.updateMany({
        where: {
          storyId,
          order: {
            gte: originalOrder,
          },
          deleted: false,
        },
        data: {
          order: {
            increment: 1,
          },
        },
      })

      // Restore the message with its original order
      const restored = await tx.message.update({
        where: {
          storyId_id: {
            storyId,
            id: messageId,
          },
        },
        data: {
          deleted: false,
        },
      })

      return restored
    })

    res.json(restoredMessage)
  } catch (error) {
    console.error('Error restoring message:', error)
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to restore message' })
    }
  }
})

export default router
