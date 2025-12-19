import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function getMaps(req: Request, res: Response): Promise<void> {
  try {
    const { storyId } = req.params

    // Set cache control headers to prevent browser caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    // Only return metadata - no image data, landmarks, fleets, or hyperlanes
    // Those are fetched separately via dedicated endpoints
    const maps = await prisma.map.findMany({
      where: { storyId },
      select: {
        id: true,
        name: true,
        borderColor: true,
        fileId: true,
        storyId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    res.json(maps)
  } catch (error) {
    console.error('Error fetching maps:', error)
    res.status(500).json({ error: 'Failed to fetch maps' })
  }
}
