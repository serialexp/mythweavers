import { Request, Response } from 'express'
import { createLogger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'

const log = createLogger('characters')

export async function updateCharacter(req: Request, res: Response): Promise<void> {
  try {
    const { storyId, characterId } = req.params
    const characterData = req.body
    const { profileImageData } = characterData

    const existingCharacter = await prisma.character.findUnique({
      where: {
        storyId_id: {
          storyId,
          id: characterId,
        },
      },
    })

    if (!existingCharacter) {
      res.status(404).json({ error: 'Character not found' })
      return
    }

    let profileImageId = existingCharacter.profileImageId

    if (profileImageData === null) {
      if (profileImageId) {
        await prisma.file.delete({
          where: { id: profileImageId },
        })
      }
      profileImageId = null
    } else if (typeof profileImageData === 'string' && profileImageData.startsWith('data:')) {
      const matches = profileImageData.match(/^data:([^;]+);base64,(.+)$/)
      if (matches) {
        const mimeType = matches[1]
        const base64Data = matches[2]
        const buffer = Buffer.from(base64Data, 'base64')

        if (profileImageId) {
          await prisma.file.update({
            where: { id: profileImageId },
            data: {
              mimeType,
              data: buffer,
            },
          })
        } else {
          const file = await prisma.file.create({
            data: {
              storyId,
              filename: `character_${characterId}.${mimeType.split('/')[1] || 'png'}`,
              mimeType,
              data: buffer,
            },
          })
          profileImageId = file.id
        }
      }
    }

    // Update the character in the database
    const updatedCharacter = await prisma.character.update({
      where: {
        storyId_id: {
          storyId: storyId,
          id: characterId,
        },
      },
      data: {
        name: characterData.name,
        description: characterData.description,
        birthdate: characterData.birthdate !== undefined ? characterData.birthdate : undefined,
        isProtagonist: characterData.isProtagonist,
        profileImageId: profileImageId ?? undefined,
      },
    })

    const story = await prisma.story.update({
      where: { id: storyId },
      data: { updatedAt: new Date() },
      select: { updatedAt: true },
    })

    res.json({
      ...updatedCharacter,
      profileImageId,
      profileImageData: profileImageData === undefined ? undefined : profileImageData,
      updatedAt: story.updatedAt,
    })
  } catch (error: any) {
    const { storyId, characterId } = req.params
    log.error({ error, storyId, characterId }, 'Error updating character')

    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Character not found' })
    } else {
      res.status(500).json({ error: 'Failed to update character' })
    }
  }
}
