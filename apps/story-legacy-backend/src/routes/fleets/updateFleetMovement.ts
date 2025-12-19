import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function updateFleetMovement(req: Request, res: Response): Promise<void> {
  try {
    const { storyId, movementId } = req.params
    const { startStoryTime, endStoryTime, startX, startY, endX, endY } = req.body

    const movement = await prisma.fleetMovement.update({
      where: {
        id: movementId,
      },
      data: {
        startStoryTime: startStoryTime !== undefined ? startStoryTime : undefined,
        endStoryTime: endStoryTime !== undefined ? endStoryTime : undefined,
        startX: startX !== undefined ? startX : undefined,
        startY: startY !== undefined ? startY : undefined,
        endX: endX !== undefined ? endX : undefined,
        endY: endY !== undefined ? endY : undefined,
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
    console.error('Error updating fleet movement:', error)
    res.status(500).json({ error: 'Failed to update fleet movement' })
  }
}
