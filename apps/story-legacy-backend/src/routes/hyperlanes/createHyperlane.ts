import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function createHyperlane(req: Request, res: Response): Promise<void> {
  try {
    const { mapId } = req.params
    const { id, speedMultiplier, segments } = req.body

    // Validate required fields
    if (!id || speedMultiplier === undefined || !segments || !Array.isArray(segments)) {
      res.status(400).json({ error: 'Missing required fields' })
    }

    const hyperlane = await prisma.hyperlane.create({
      data: {
        id,
        mapId,
        speedMultiplier,
        segments: {
          create: segments.map((segment: any) => ({
            id: segment.id,
            mapId,
            order: segment.order,
            startX: segment.startX,
            startY: segment.startY,
            endX: segment.endX,
            endY: segment.endY,
            startLandmarkId: segment.startLandmarkId || null,
            endLandmarkId: segment.endLandmarkId || null,
          })),
        },
      },
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
    console.error('Error creating hyperlane:', error)
    res.status(500).json({ error: 'Failed to create hyperlane' })
  }
}
