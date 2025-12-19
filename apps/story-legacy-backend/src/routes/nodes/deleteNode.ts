import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function deleteNode(req: Request, res: Response): Promise<void> {
  try {
    const { storyId, nodeId } = req.params

    // Check if node exists
    const node = await prisma.node.findFirst({
      where: { id: nodeId, storyId },
    })

    if (!node) {
      res.status(404).json({ error: 'Node not found' })
    }

    // Delete node and all its descendants (cascade delete handles this)
    await prisma.node.delete({
      where: { id: nodeId },
    })

    // If it was a chapter, also clean up any orphaned messages
    if (node.type === 'chapter') {
      await prisma.message.updateMany({
        where: {
          storyId,
          nodeId: nodeId,
        },
        data: {
          nodeId: null,
        },
      })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting node:', error)
    res.status(500).json({ error: 'Failed to delete node' })
  }
}
