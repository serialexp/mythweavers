import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function createLandmark(req: Request, res: Response): Promise<void> {
  try {
    const { storyId, mapId } = req.params
    const { id, x, y, name, description, type, population, industry, color, size } = req.body

    // Validate required fields (name can be empty for junctions)
    if (!id || x === undefined || y === undefined || name === undefined) {
      res.status(400).json({ error: 'Missing required fields' })
    }

    const landmark = await prisma.landmark.create({
      data: {
        id,
        mapId,
        x,
        y,
        name,
        description,
        type: type || 'system',
        population,
        industry,
        color,
        size,
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
    console.error('Error creating landmark:', error)
    res.status(500).json({ error: 'Failed to create landmark' })
  }
}
