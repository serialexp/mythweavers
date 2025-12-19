import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function updateHyperlane(req: Request, res: Response): Promise<void> {
  try {
    const { hyperlaneId } = req.params
    const { speedMultiplier, segments } = req.body

    // Build update data
    const updateData: any = {}
    if (speedMultiplier !== undefined) {
      updateData.speedMultiplier = speedMultiplier
    }

    // If segments are provided, delete old ones and create new ones
    if (segments && Array.isArray(segments)) {
      // Delete old segments first
      await prisma.hyperlaneSegment.deleteMany({
        where: { hyperlaneId },
      })

      // Create new segments
      updateData.segments = {
        create: segments.map((segment: any) => ({
          id: segment.id,
          mapId: segment.mapId,
          order: segment.order,
          startX: segment.startX,
          startY: segment.startY,
          endX: segment.endX,
          endY: segment.endY,
          startLandmarkId: segment.startLandmarkId || null,
          endLandmarkId: segment.endLandmarkId || null,
        })),
      }
    }

    const hyperlane = await prisma.hyperlane.update({
      where: { id: hyperlaneId },
      data: updateData,
      include: {
        segments: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    res.json(hyperlane)
  } catch (error) {
    console.error('Error updating hyperlane:', error)
    res.status(500).json({ error: 'Failed to update hyperlane' })
  }
}
