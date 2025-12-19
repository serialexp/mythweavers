import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function deleteFleet(req: Request, res: Response): Promise<void> {
  try {
    const { mapId, fleetId } = req.params

    await prisma.fleet.delete({
      where: {
        mapId_id: {
          mapId,
          id: fleetId,
        },
      },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting fleet:', error)
    res.status(500).json({ error: 'Failed to delete fleet' })
  }
}
