import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function deleteHyperlane(req: Request, res: Response): Promise<void> {
  try {
    const { hyperlaneId } = req.params

    await prisma.hyperlane.delete({
      where: { id: hyperlaneId },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting hyperlane:', error)
    res.status(500).json({ error: 'Failed to delete hyperlane' })
  }
}
