import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function createNode(req: Request, res: Response): Promise<void> {
  try {
    const { storyId } = req.params
    const { id, parentId, type, title, order } = req.body

    // Validate node type
    if (!['book', 'arc', 'chapter'].includes(type)) {
      res.status(400).json({ error: 'Invalid node type' })
    }

    // Validate parent-child relationship
    if (parentId) {
      const parent = await prisma.node.findFirst({
        where: { id: parentId, storyId },
      })

      if (!parent) {
        res.status(404).json({ error: 'Parent node not found' })
      }

      // Validate hierarchy
      if (parent.type === 'book' && type !== 'arc') {
        res.status(400).json({ error: 'Books can only contain arcs' })
      }
      if (parent.type === 'arc' && type !== 'chapter') {
        res.status(400).json({ error: 'Arcs can only contain chapters' })
      }
      if (parent.type === 'chapter') {
        res.status(400).json({ error: 'Chapters cannot have children' })
      }
    } else if (type !== 'book') {
      res.status(400).json({ error: 'Only books can be root nodes' })
    }

    // Get the order if not provided
    let nodeOrder = order
    if (nodeOrder === undefined) {
      const siblings = await prisma.node.count({
        where: {
          storyId,
          parentId: parentId || null,
        },
      })
      nodeOrder = siblings
    }

    // Create the node (use provided ID if given)
    const node = await prisma.node.create({
      data: {
        ...(id ? { id } : {}), // Use provided ID if given
        storyId,
        parentId,
        type,
        title: title || `New ${type}`,
        order: nodeOrder,
        expanded: true,
      },
    })

    res.json({ node })
  } catch (error) {
    console.error('Error creating node:', error)
    res.status(500).json({ error: 'Failed to create node' })
  }
}
