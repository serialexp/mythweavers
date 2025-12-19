import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function createFleetMovement(req: Request, res: Response): Promise<void> {
  try {
    const { storyId, mapId, fleetId } = req.params
    const { id, startStoryTime, endStoryTime, startX, startY, endX, endY } = req.body

    // Validate required fields
    if (
      !id ||
      startStoryTime === undefined ||
      endStoryTime === undefined ||
      startX === undefined ||
      startY === undefined ||
      endX === undefined ||
      endY === undefined
    ) {
      res.status(400).json({ error: 'Missing required fields' })
    }

    const movement = await prisma.fleetMovement.create({
      data: {
        id,
        storyId,
        mapId,
        fleetId,
        startStoryTime,
        endStoryTime,
        startX,
        startY,
        endX,
        endY,
      },
    })

    // Update the story's updatedAt timestamp
    const updatedStory = await prisma.story.update({
      where: { id: storyId },
      data: { updatedAt: new Date() },
      select: { updatedAt: true },
    })

    res.json({
      ...movement,
      updatedAt: updatedStory.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error creating fleet movement:', error)
    res.status(500).json({ error: 'Failed to create fleet movement' })
  }
}
