import { Request, Response } from 'express'
import { createLogger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'

const log = createLogger('characters')

export async function deleteCharacter(req: Request, res: Response): Promise<void> {
  try {
    const { storyId, characterId } = req.params

    const character = await prisma.character.findUnique({
      where: {
        storyId_id: {
          storyId,
          id: characterId,
        },
      },
    })

    if (!character) {
      res.status(404).json({ error: 'Character not found' })
      return
    }

    if (character.profileImageId) {
      await prisma.file.deleteMany({
        where: { id: character.profileImageId },
      })
    }

    await prisma.character.delete({
      where: {
        storyId_id: {
          storyId,
          id: characterId,
        },
      },
    })

    const story = await prisma.story.update({
      where: { id: storyId },
      data: { updatedAt: new Date() },
      select: { updatedAt: true },
    })

    res.json({ success: true, updatedAt: story.updatedAt })
  } catch (error: any) {
    const { storyId, characterId } = req.params
    log.error({ error, storyId, characterId }, 'Error deleting character')

    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Character not found' })
    } else {
      res.status(500).json({ error: 'Failed to delete character' })
    }
  }
}
