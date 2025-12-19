import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function deleteLandmark(req: Request, res: Response): Promise<void> {
  try {
    const { storyId, mapId, landmarkId } = req.params

    await prisma.landmark.delete({
      where: {
        mapId_id: {
          mapId,
          id: landmarkId,
        },
      },
    })

    // Update the story's updatedAt timestamp
    const updatedStory = await prisma.story.update({
      where: { id: storyId },
      data: { updatedAt: new Date() },
      select: { updatedAt: true },
    })

    res.json({
      success: true,
      updatedAt: updatedStory.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error deleting landmark:', error)
    res.status(500).json({ error: 'Failed to delete landmark' })
  }
}
