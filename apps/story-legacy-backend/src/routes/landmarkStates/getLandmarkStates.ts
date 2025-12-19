import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function getLandmarkStates(req: Request, res: Response): Promise<void> {
  try {
    const { storyId } = req.params
    const { messageId, mapId } = req.query

    // Build where clause
    const where: any = { storyId }
    if (messageId) where.messageId = messageId
    if (mapId) where.mapId = mapId

    const states = await prisma.landmarkState.findMany({
      where,
      orderBy: [{ mapId: 'asc' }, { landmarkId: 'asc' }, { field: 'asc' }],
    })

    res.json(states)
  } catch (error) {
    console.error('Error fetching landmark states:', error)
    res.status(500).json({ error: 'Failed to fetch landmark states' })
  }
}
