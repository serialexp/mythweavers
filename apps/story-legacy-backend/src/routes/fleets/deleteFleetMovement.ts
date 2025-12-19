import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function deleteFleetMovement(req: Request, res: Response): Promise<void> {
  try {
    const { storyId, movementId } = req.params

    await prisma.fleetMovement.delete({
      where: {
        id: movementId,
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
    console.error('Error deleting fleet movement:', error)
    res.status(500).json({ error: 'Failed to delete fleet movement' })
  }
}
