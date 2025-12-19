import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function getFleets(req: Request, res: Response): Promise<void> {
  try {
    const { mapId } = req.params

    // Set cache control headers to prevent stale data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    const fleets = await prisma.fleet.findMany({
      where: { mapId },
      include: {
        movements: true,
      },
    })

    res.json(fleets)
  } catch (error) {
    console.error('Error fetching fleets:', error)
    res.status(500).json({ error: 'Failed to fetch fleets' })
  }
}
