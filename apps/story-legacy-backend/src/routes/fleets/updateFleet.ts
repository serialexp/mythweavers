import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function updateFleet(req: Request, res: Response): Promise<void> {
  try {
    const { mapId, fleetId } = req.params
    const { name, description, designation, hyperdriveRating, defaultX, defaultY, color, size } = req.body

    const fleet = await prisma.fleet.update({
      where: {
        mapId_id: {
          mapId,
          id: fleetId,
        },
      },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(designation !== undefined && { designation }),
        ...(hyperdriveRating !== undefined && { hyperdriveRating }),
        ...(defaultX !== undefined && { defaultX }),
        ...(defaultY !== undefined && { defaultY }),
        ...(color !== undefined && { color }),
        ...(size !== undefined && { size }),
      },
      include: {
        movements: true,
      },
    })

    res.json(fleet)
  } catch (error) {
    console.error('Error updating fleet:', error)
    res.status(500).json({ error: 'Failed to update fleet' })
  }
}
