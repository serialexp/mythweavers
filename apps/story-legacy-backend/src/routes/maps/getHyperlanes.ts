import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function getHyperlanes(req: Request, res: Response): Promise<void> {
  try {
    const { mapId } = req.params

    // Set cache control headers to prevent stale data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    const hyperlanes = await prisma.hyperlane.findMany({
      where: { mapId },
      include: {
        segments: true,
      },
    })

    res.json(hyperlanes)
  } catch (error) {
    console.error('Error fetching hyperlanes:', error)
    res.status(500).json({ error: 'Failed to fetch hyperlanes' })
  }
}
