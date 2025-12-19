import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function updateLandmark(req: Request, res: Response): Promise<void> {
  try {
    const { storyId, mapId, landmarkId } = req.params
    const { x, y, name, description, type, population, industry, color, size } = req.body

    const landmark = await prisma.landmark.update({
      where: {
        mapId_id: {
          mapId,
          id: landmarkId,
        },
      },
      data: {
        x: x !== undefined ? x : undefined,
        y: y !== undefined ? y : undefined,
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
        type: type !== undefined ? type : undefined,
        population: population !== undefined ? population : undefined,
        industry: industry !== undefined ? industry : undefined,
        color: color !== undefined ? color : undefined,
        size: size !== undefined ? size : undefined,
      },
    })

    // Update the story's updatedAt timestamp
    const updatedStory = await prisma.story.update({
      where: { id: storyId },
      data: { updatedAt: new Date() },
      select: { updatedAt: true },
    })

    res.json({
      ...landmark,
      updatedAt: updatedStory.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error updating landmark:', error)
    res.status(500).json({ error: 'Failed to update landmark' })
  }
}
