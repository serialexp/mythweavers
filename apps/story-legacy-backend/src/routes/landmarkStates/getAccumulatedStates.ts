import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function getAccumulatedStates(req: Request, res: Response): Promise<void> {
  try {
    const { storyId, messageId } = req.params
    const { mapId } = req.query

    // Get all messages up to and including the target message
    const messages = await prisma.message.findMany({
      where: {
        storyId,
        deleted: false,
      },
      orderBy: { order: 'asc' },
    })

    // Find the target message index
    const targetIndex = messages.findIndex((m) => m.id === messageId)
    if (targetIndex === -1) {
      res.status(404).json({ error: 'Message not found' })
    }

    // Get message IDs up to target
    const messageIds = messages.slice(0, targetIndex + 1).map((m) => m.id)

    // Build where clause
    const where: any = {
      storyId,
      messageId: { in: messageIds },
    }
    if (mapId) where.mapId = mapId

    // Get all states up to this message
    const states = await prisma.landmarkState.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })

    // Accumulate states (last value for each landmark/field wins)
    const accumulated: Record<string, any> = {}

    for (const state of states) {
      const key = `${state.mapId}:${state.landmarkId}:${state.field}`
      accumulated[key] = {
        mapId: state.mapId,
        landmarkId: state.landmarkId,
        field: state.field,
        value: state.value,
        messageId: state.messageId,
      }
    }

    // Convert to array
    const result = Object.values(accumulated)

    res.json(result)
  } catch (error) {
    console.error('Error fetching accumulated landmark states:', error)
    res.status(500).json({ error: 'Failed to fetch accumulated landmark states' })
  }
}
