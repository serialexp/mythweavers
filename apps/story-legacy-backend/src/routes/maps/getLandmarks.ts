import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function getLandmarks(req: Request, res: Response): Promise<void> {
  try {
    const { mapId } = req.params

    // Set cache control headers to prevent stale data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    const landmarks = await prisma.landmark.findMany({
      where: { mapId },
    })

    res.json(landmarks)
  } catch (error) {
    console.error('Error fetching landmarks:', error)
    res.status(500).json({ error: 'Failed to fetch landmarks' })
  }
}
