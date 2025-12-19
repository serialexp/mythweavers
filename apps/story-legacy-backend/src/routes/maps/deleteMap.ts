import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function deleteMap(req: Request, res: Response): Promise<void> {
  try {
    const { storyId, mapId } = req.params

    // Check if map exists
    const map = await prisma.map.findFirst({
      where: { id: mapId, storyId },
    })

    if (!map) {
      res.status(404).json({ error: 'Map not found' })
    }

    // Delete associated file if exists
    if (map.fileId) {
      await prisma.file
        .delete({
          where: { id: map.fileId },
        })
        .catch(() => {
          // File might not exist, that's okay
        })
    }

    // Delete map (landmarks will cascade delete)
    await prisma.map.delete({
      where: { id: mapId },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting map:', error)
    res.status(500).json({ error: 'Failed to delete map' })
  }
}
