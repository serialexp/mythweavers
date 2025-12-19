import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function setLandmarkState(req: Request, res: Response): Promise<void> {
  try {
    const { storyId } = req.params
    const { mapId, landmarkId, messageId, field, value } = req.body

    if (!mapId || !landmarkId || !messageId || !field) {
      res.status(400).json({
        error: 'Missing required fields: mapId, landmarkId, messageId, field',
      })
    }

    // Check if landmark exists
    const landmark = await prisma.landmark.findUnique({
      where: {
        mapId_id: {
          mapId,
          id: landmarkId,
        },
      },
    })

    if (!landmark) {
      res.status(404).json({ error: 'Landmark not found' })
    }

    // Get the message to find its storyTime (via its node/chapter)
    const message = await prisma.message.findUnique({
      where: {
        storyId_id: {
          storyId,
          id: messageId,
        },
      },
      include: {
        node: true,
      },
    })

    if (!message) {
      res.status(404).json({ error: 'Message not found' })
    }

    const storyTime = message.node?.storyTime
    if (storyTime === null || storyTime === undefined) {
      res.status(400).json({
        error: 'Message chapter does not have a storyTime set. Please set a storyTime for the chapter first.',
      })
    }

    // If value is null/empty, delete the state
    if (!value) {
      await prisma.landmarkState.deleteMany({
        where: {
          mapId,
          landmarkId,
          storyTime,
          field,
        },
      })
      res.json({ deleted: true })
    }

    // Upsert the state using storyTime
    const state = await prisma.landmarkState.upsert({
      where: {
        mapId_landmarkId_storyTime_field: {
          mapId,
          landmarkId,
          storyTime,
          field,
        },
      },
      update: {
        value,
        messageId, // Keep messageId for backwards compatibility
        updatedAt: new Date(),
      },
      create: {
        storyId,
        mapId,
        landmarkId,
        messageId,
        storyTime,
        field,
        value,
      },
    })

    res.json(state)
  } catch (error) {
    console.error('Error setting landmark state:', error)
    res.status(500).json({ error: 'Failed to set landmark state' })
  }
}
