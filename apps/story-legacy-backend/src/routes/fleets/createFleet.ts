import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function createFleet(req: Request, res: Response): Promise<void> {
  try {
    const { mapId } = req.params
    const { id, name, description, designation, hyperdriveRating, defaultX, defaultY, color, size } = req.body

    // Validate required fields
    if (!id || !name || hyperdriveRating === undefined || defaultX === undefined || defaultY === undefined) {
      res.status(400).json({ error: 'Missing required fields' })
    }

    const fleet = await prisma.fleet.create({
      data: {
        id,
        mapId,
        name,
        description,
        designation,
        hyperdriveRating,
        defaultX,
        defaultY,
        color,
        size,
      },
      include: {
        movements: true,
      },
    })

    res.json(fleet)
  } catch (error) {
    console.error('Error creating fleet:', error)
    res.status(500).json({ error: 'Failed to create fleet' })
  }
}
