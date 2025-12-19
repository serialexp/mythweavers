import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function getMapImage(req: Request, res: Response): Promise<void> {
  try {
    const { mapId } = req.params

    const map = await prisma.map.findUnique({
      where: { id: mapId },
      select: { fileId: true },
    })

    if (!map) {
      res.status(404).json({ error: 'Map not found' })
    }

    if (!map.fileId) {
      res.json({ imageData: null })
    }

    const file = await prisma.file.findUnique({
      where: { id: map.fileId },
    })

    if (!file) {
      res.json({ imageData: null })
    }

    // Convert binary data to base64 data URL
    const base64 = Buffer.from(file.data).toString('base64')
    const imageData = `data:${file.mimeType};base64,${base64}`

    // Set cache headers - images don't change often
    res.setHeader('Cache-Control', 'public, max-age=3600')

    res.json({ imageData })
  } catch (error) {
    console.error('Error fetching map image:', error)
    res.status(500).json({ error: 'Failed to fetch map image' })
  }
}
