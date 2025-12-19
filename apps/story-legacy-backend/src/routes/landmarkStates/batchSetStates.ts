import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

interface StateUpdate {
  mapId: string
  landmarkId: string
  messageId: string
  field: string
  value: string | null
}

export async function batchSetStates(req: Request, res: Response): Promise<void> {
  try {
    const { storyId } = req.params
    const { states } = req.body as { states: StateUpdate[] }

    if (!states || !Array.isArray(states)) {
      res.status(400).json({ error: 'States array is required' })
    }

    const results = []

    // Process each state update
    for (const state of states) {
      const { mapId, landmarkId, messageId, field, value } = state

      if (!mapId || !landmarkId || !messageId || !field) {
        continue // Skip invalid entries
      }

      try {
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

        if (!message || !message.node?.storyTime) {
          console.error(`Message ${messageId} not found or has no storyTime`)
          results.push({ ...state, error: 'Message not found or has no storyTime' })
          continue
        }

        const storyTime = message.node.storyTime

        if (!value) {
          // Delete the state if value is null/empty
          await prisma.landmarkState.deleteMany({
            where: {
              mapId,
              landmarkId,
              storyTime,
              field,
            },
          })
          results.push({ ...state, deleted: true })
        } else {
          // Upsert the state using storyTime
          const updatedState = await prisma.landmarkState.upsert({
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
          results.push(updatedState)
        }
      } catch (error) {
        console.error(`Error processing state for ${landmarkId}:`, error)
        results.push({ ...state, error: 'Failed to process' })
      }
    }

    res.json(results)
  } catch (error) {
    console.error('Error batch setting landmark states:', error)
    res.status(500).json({ error: 'Failed to batch set landmark states' })
  }
}
