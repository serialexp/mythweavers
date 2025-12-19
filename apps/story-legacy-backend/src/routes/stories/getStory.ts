import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { AuthRequest } from '../../middleware/auth'
import { migrateStoryToNodes } from '../nodes/migrateStory'

const router = Router()

// GET single story with all data
router.get('/stories/:id', async (req, res) => {
  try {
    const authReq = req as any as AuthRequest
    const storyId = authReq.params.id

    // First check if story needs migration
    const needsMigration =
      (await prisma.node.findFirst({
        where: { storyId },
      })) === null

    if (needsMigration) {
      await migrateStoryToNodes(storyId)
    }

    const story = await prisma.story.findFirst({
      where: {
        id: storyId,
        userId: authReq.userId,
        deleted: false,
      },
      include: {
        messages: {
          where: { deleted: false },
          // No need to sort here - frontend handles proper ordering
          // based on node hierarchy and message.order field
        },
        characters: true,
        contextItems: true,
        chapters: true,
        calendars: true,
        nodes: {
          orderBy: [{ parentId: 'asc' }, { order: 'asc' }],
        },
      },
    })

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
    }

    let charactersWithImages = story.characters
    const characterImageIds = story.characters
      .map((character) => character.profileImageId)
      .filter((id): id is string => Boolean(id))

    if (characterImageIds.length > 0) {
      const files = await prisma.file.findMany({
        where: { id: { in: characterImageIds } },
        select: { id: true, mimeType: true, data: true },
      })
      const fileMap = new Map(files.map((file) => [file.id, file]))

      charactersWithImages = story.characters.map((character) => {
        const file = character.profileImageId ? fileMap.get(character.profileImageId) : undefined

        return {
          ...character,
          profileImageData: file ? `data:${file.mimeType};base64,${Buffer.from(file.data).toString('base64')}` : null,
        }
      })
    } else {
      charactersWithImages = story.characters.map((character) => ({
        ...character,
        profileImageData: null,
      }))
    }

    // Log message stats for debugging
    console.log(`[getStory] Story ${authReq.params.id} has ${story.messages.length} messages`)
    const compactedCount = story.messages.filter((m) => m.isCompacted).length
    const deletedInMemory = story.messages.filter((m) => m.deleted).length
    if (compactedCount > 0) {
      console.log(`[getStory] ${compactedCount} messages are marked as compacted`)
    }
    if (deletedInMemory > 0) {
      console.log(`[getStory] WARNING: ${deletedInMemory} messages have deleted=true but were still returned`)
    }

    // Debug: Log structure of response
    console.log('[getStory] Response structure:', {
      hasMessages: !!story.messages,
      messageCount: story.messages?.length,
      isArray: Array.isArray(story.messages),
      hasNodes: !!story.nodes,
      nodeCount: story.nodes?.length,
      hasCharacters: !!story.characters,
      characterCount: story.characters?.length,
      firstMessageId: story.messages?.[0]?.id?.substring(0, 8),
      firstNodeId: story.nodes?.[0]?.id?.substring(0, 8),
    })

    res.json({
      ...story,
      characters: charactersWithImages,
    })
  } catch (error) {
    console.error('Error fetching story:', error)
    res.status(500).json({ error: 'Failed to fetch story' })
  }
})

export default router
