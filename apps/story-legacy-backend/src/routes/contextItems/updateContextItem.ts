import { Request, Response } from 'express'
import { createLogger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'

const log = createLogger('contextItems')

export async function updateContextItem(req: Request, res: Response) {
  try {
    const { storyId, itemId } = req.params
    const itemData = req.body

    log.info(
      {
        storyId,
        itemId,
        params: req.params,
        url: req.url,
        originalUrl: req.originalUrl,
        path: req.path,
      },
      'Updating/creating context item',
    )

    if (!storyId || !itemId) {
      res.status(400).json({ error: 'Missing storyId or itemId in request parameters' })
      return
    }

    // First verify the story exists
    const storyExists = await prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true },
    })

    if (!storyExists) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    // Upsert the context item in the database (create if doesn't exist, update if exists)
    const updatedItem = await prisma.contextItem.upsert({
      where: {
        storyId_id: {
          storyId: storyId,
          id: itemId,
        },
      },
      update: {
        name: itemData.name,
        description: itemData.description,
        type: itemData.type,
        isGlobal: itemData.isGlobal !== undefined ? itemData.isGlobal : false,
      },
      create: {
        id: itemId,
        storyId: storyId,
        name: itemData.name,
        description: itemData.description,
        type: itemData.type,
        isGlobal: itemData.isGlobal !== undefined ? itemData.isGlobal : false,
      },
    })

    // Log the operation (we can't easily determine if it was created or updated without an extra query)
    log.info({ storyId, itemId }, 'Successfully upserted context item')

    res.json(updatedItem)
  } catch (error: any) {
    const { storyId, itemId } = req.params
    log.error({ error, storyId, itemId }, 'Error updating context item')

    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Context item not found' })
    } else {
      res.status(500).json({ error: 'Failed to update context item' })
    }
  }
}
