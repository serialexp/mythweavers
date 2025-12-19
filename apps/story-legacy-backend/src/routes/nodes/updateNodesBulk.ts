import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function updateNodesBulk(req: Request, res: Response): Promise<void> {
  try {
    const { storyId } = req.params
    const { nodes } = req.body

    if (!nodes || !Array.isArray(nodes)) {
      res.status(400).json({ error: 'Invalid nodes array' })
    }

    // Validate all nodes exist first and collect detailed errors
    const notFoundNodes: string[] = []
    for (const node of nodes) {
      const existingNode = await prisma.node.findFirst({
        where: { id: node.id, storyId },
      })
      if (!existingNode) {
        notFoundNodes.push(`${node.id} (${node.title || 'no title'})`)
      }
    }

    if (notFoundNodes.length > 0) {
      res.status(404).json({
        error: `Nodes not found: ${notFoundNodes.join(', ')}`,
        missingNodes: notFoundNodes,
      })
    }

    // Update all nodes in a transaction
    const updatedNodes = await prisma.$transaction(
      nodes.map((node) => {
        const {
          id,
          storyId: _storyId,
          type: _type,
          createdAt: _createdAt,
          updatedAt: _updatedAt,
          isOpen: _isOpen,
          messageWordCounts: _messageWordCounts, // Computed field, not in DB
          wordCount: _wordCount, // Computed field, not in DB
          isSummarizing: _isSummarizing, // UI state, not in DB
          ...updates
        } = node

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

        return prisma.node.update({
          where: { id },
          data: updates,
        })
      }),
    )

    res.json({ nodes: updatedNodes })
  } catch (error) {
    console.error('Error bulk updating nodes:', error)
    res.status(500).json({ error: 'Failed to bulk update nodes' })
  }
}
