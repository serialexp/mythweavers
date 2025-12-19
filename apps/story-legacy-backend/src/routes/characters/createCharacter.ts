import { Request, Response } from 'express'
import { createLogger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'

const log = createLogger('characters')

export async function createCharacter(req: Request, res: Response): Promise<void> {
  try {
    const { storyId } = req.params
    const characterData = req.body
    const { profileImageData } = characterData

    // Validate required fields
    if (!characterData.id || !characterData.name) {
      res.status(400).json({ error: 'Character ID and name are required' })
      return
    }

    let profileImageId: string | null = null

    if (typeof profileImageData === 'string' && profileImageData.startsWith('data:')) {
      const matches = profileImageData.match(/^data:([^;]+);base64,(.+)$/)
      if (matches) {
        const mimeType = matches[1]
        const base64Data = matches[2]
        const buffer = Buffer.from(base64Data, 'base64')

        const file = await prisma.file.create({
          data: {
            storyId,
            filename: `character_${characterData.id}.${mimeType.split('/')[1] || 'png'}`,
            mimeType,
            data: buffer,
          },
        })

        profileImageId = file.id
      }
    }

    // Create the character in the database
    const newCharacter = await prisma.character.create({
      data: {
        id: characterData.id,
        storyId: storyId,
        name: characterData.name,
        description: characterData.description || '',
        birthdate: characterData.birthdate ?? undefined,
        isProtagonist: characterData.isProtagonist ?? false,
        profileImageId: profileImageId || undefined,
      },
    })

    const story = await prisma.story.update({
      where: { id: storyId },
      data: { updatedAt: new Date() },
      select: { updatedAt: true },
    })

    res.json({
      ...newCharacter,
      profileImageId,
      profileImageData: typeof profileImageData === 'string' ? profileImageData : null,
      updatedAt: story.updatedAt,
    })
  } catch (error: any) {
    const { storyId } = req.params
    log.error({ error, storyId, characterData: req.body }, 'Error creating character')

    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Character with this ID already exists' })
    } else {
      res.status(500).json({ error: 'Failed to create character' })
    }
  }
}
