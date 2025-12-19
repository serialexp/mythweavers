import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function updateNode(req: Request, res: Response): Promise<void> {
  try {
    const { storyId, nodeId } = req.params
    const updates = req.body

    // Check if node exists
    const existingNode = await prisma.node.findFirst({
      where: { id: nodeId, storyId },
    })

    if (!existingNode) {
      res.status(404).json({ error: 'Node not found' })
    }

    // Don't allow changing type
    updates.type = undefined
    updates.messageWordCounts = undefined
    updates.storyId = undefined
    updates.id = undefined
    updates.createdAt = undefined
    updates.updatedAt = undefined
    updates.isOpen = undefined

    // Convert array fields to JSON strings for SQLite
    if (updates.activeCharacterIds !== undefined) {
      updates.activeCharacterIds = Array.isArray(updates.activeCharacterIds)
        ? JSON.stringify(updates.activeCharacterIds)
        : updates.activeCharacterIds
    }
    if (updates.activeContextItemIds !== undefined) {
      updates.activeContextItemIds = Array.isArray(updates.activeContextItemIds)
        ? JSON.stringify(updates.activeContextItemIds)
        : updates.activeContextItemIds
    }

    // Update the node
    const node = await prisma.node.update({
      where: { id: nodeId },
      data: updates,
    })

    res.json({ node })
  } catch (error) {
    console.error('Error updating node:', error)
    res.status(500).json({ error: 'Failed to update node' })
  }
}
