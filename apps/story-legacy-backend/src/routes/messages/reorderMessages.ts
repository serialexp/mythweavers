import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

interface ReorderItem {
  messageId: string
  nodeId?: string // The node (chapter) this message belongs to
  order: number
}

export const reorderMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storyId, items } = req.body as {
      storyId: string
      items: ReorderItem[]
    }

    if (!storyId || !items || !Array.isArray(items)) {
      res.status(400).json({ error: 'Invalid request body' })
      return
    }

    // First, validate that all referenced nodes exist and belong to the correct story
    const nodeIds = items.map((item) => item.nodeId).filter((id) => id != null) as string[]

    if (nodeIds.length > 0) {
      // Check nodes
      const nodes = await prisma.node.findMany({
        where: {
          id: { in: nodeIds },
          storyId: storyId,
          type: 'chapter', // Only chapter nodes can have messages
        },
        select: { id: true },
      })

      const validNodeIds = new Set(nodes.map((n) => n.id))

      // Verify all referenced node IDs are valid
      for (const item of items) {
        const nodeId = item.nodeId
        if (nodeId && !validNodeIds.has(nodeId)) {
          console.error(`Invalid node ID: ${nodeId} for story ${storyId}`)
          res.status(400).json({
            error: `Invalid node ID: ${nodeId}. Node does not exist, is not a chapter, or belongs to a different story.`,
          })
          return
        }
      }
    }

    // Update all messages in a transaction
    // Only update the nodeId and order fields
    await prisma.$transaction(
      items.map((item) => {
        const updateData: any = {
          order: item.order,
        }

        // Only update nodeId if it's provided
        if (item.nodeId !== undefined) {
          updateData.nodeId = item.nodeId
        }

        return prisma.message.update({
          where: {
            storyId_id: {
              storyId: storyId,
              id: item.messageId,
            },
          },
          data: updateData,
        })
      }),
    )

    // Update the story's updatedAt timestamp
    const story = await prisma.story.update({
      where: { id: storyId },
      data: { updatedAt: new Date() },
      select: { updatedAt: true },
    })

    res.json({
      success: true,
      updatedAt: story.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error reordering messages:', error)
    res.status(500).json({ error: 'Failed to reorder messages' })
  }
}
