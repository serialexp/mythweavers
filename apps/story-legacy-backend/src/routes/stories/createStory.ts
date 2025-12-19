import { CALENDAR_PRESETS } from '@mythweavers/shared'
import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { AuthRequest } from '../../middleware/auth'
import { rebuildParagraphEmbeddings } from '../../services/paragraphEmbeddingService'
import { generateMessageId } from '../../utils/id'

const router = Router()

// POST new story
router.post('/stories', async (req, res) => {
  try {
    const {
      name,
      messages,
      characters,
      contextItems,
      chapters,
      input,
      storySetting,
      person,
      tense,
      globalScript,
      provider,
      model,
      calendarPresetId,
    } = req.body

    console.log('Creating story with:', {
      name,
      messageCount: messages?.length || 0,
      characterCount: characters?.length || 0,
      contextItemCount: contextItems?.length || 0,
      chapterCount: chapters?.length || 0,
    })

    // Create story first without nested data
    const story = await prisma.story.create({
      data: {
        name,
        input: input || '',
        storySetting: storySetting || '',
        person: person || 'third',
        tense: tense || 'past',
        globalScript: globalScript || null,
        provider: provider || 'ollama',
        model: model || null,
        userId: (req as any as AuthRequest).userId,
      },
    })

    console.log('Story created with ID:', story.id)

    // Create default calendar for the story
    const calendarPreset =
      calendarPresetId && CALENDAR_PRESETS[calendarPresetId as keyof typeof CALENDAR_PRESETS]
        ? CALENDAR_PRESETS[calendarPresetId as keyof typeof CALENDAR_PRESETS]
        : CALENDAR_PRESETS.simple365

    const calendar = await prisma.calendar.create({
      data: {
        storyId: story.id,
        config: JSON.stringify(calendarPreset),
      },
    })

    // Set as default calendar
    await prisma.story.update({
      where: { id: story.id },
      data: { defaultCalendarId: calendar.id },
    })

    console.log(`Created calendar '${calendarPreset.name}' for story`)

    // Create chapters first (before messages, since messages reference chapters)
    // Generate new chapter IDs to avoid conflicts and create mapping
    const chapterIdMapping = new Map<string, string>()
    if (chapters && chapters.length > 0) {
      try {
        const chapterData = chapters.map((chapter: any, index: number) => {
          const newChapterId = generateMessageId()
          chapterIdMapping.set(chapter.id, newChapterId)

          return {
            id: newChapterId,
            storyId: story.id,
            title: chapter.title || 'Untitled Chapter',
            summary: chapter.summary || null,
            order: chapter.order !== undefined ? chapter.order : index,
            createdAt: chapter.createdAt ? new Date(chapter.createdAt) : new Date(),
            updatedAt: chapter.updatedAt ? new Date(chapter.updatedAt) : new Date(),
          }
        })
        await prisma.chapter.createMany({
          data: chapterData,
        })
        console.log(`Created ${chapters.length} chapters with new IDs`)
      } catch (chapterError) {
        console.error('Error creating chapters:', chapterError)
        // Clean up the story if chapter creation fails
        await prisma.story.delete({ where: { id: story.id } })
        throw chapterError
      }
    }

    // Create messages separately with better error handling
    if (messages && messages.length > 0) {
      try {
        const messageData = messages.map((msg: any, index: number) => {
          // Map old chapter ID to new chapter ID if it exists
          let mappedChapterId: string | null = null
          if (msg.chapterId) {
            if (chapterIdMapping.has(msg.chapterId)) {
              mappedChapterId = chapterIdMapping.get(msg.chapterId) ?? null
            } else if (chapters && chapters.length > 0) {
              // Chapters were provided but this message referenced an unknown chapter ID.
              // Fall back to null to avoid foreign key violations while persisting.
              console.warn(
                `Message ${msg.id} referenced chapter ${msg.chapterId} that was not created. Clearing chapterId.`,
              )
              mappedChapterId = null
            } else {
              // No chapters provided (stories now use nodes). Clear legacy chapterId values.
              mappedChapterId = null
            }
          }

          // Log the message being processed for debugging
          console.log(`Processing message ${index}:`, {
            id: msg.id,
            role: msg.role,
            contentLength: msg.content?.length,
            hasInstruction: !!msg.instruction,
            timestamp: msg.timestamp,
            model: msg.model,
            isCompacted: msg.isCompacted,
            compactedMessageIds: msg.compactedMessageIds,
            type: msg.type,
            originalChapterId: msg.chapterId,
            mappedChapterId: mappedChapterId,
          })

          return {
            ...(msg.id ? { id: msg.id } : {}), // Include ID if provided
            storyId: story.id,
            role: msg.role,
            content: msg.content,
            instruction: msg.instruction || null,
            timestamp: new Date(msg.timestamp),
            tokensPerSecond: msg.tokensPerSecond || null,
            totalTokens: msg.totalTokens || null,
            promptTokens: msg.promptTokens || null,
            cacheCreationTokens: msg.cacheCreationTokens || null,
            cacheReadTokens: msg.cacheReadTokens || null,
            isQuery: msg.isQuery || false,
            sentenceSummary: msg.sentenceSummary || null,
            summary: msg.summary || null,
            paragraphSummary: msg.paragraphSummary || null,
            isExpanded: msg.isExpanded || false,
            isSummarizing: msg.isSummarizing || false,
            think: msg.think || null,
            showThink: msg.showThink || false,
            sceneAnalysis: msg.sceneAnalysis ? msg.sceneAnalysis : null,
            isAnalyzing: msg.isAnalyzing || false,
            model: msg.model || null,
            isCompacted: msg.isCompacted || false,
            compactedMessageIds: msg.compactedMessageIds ? msg.compactedMessageIds : null,
            script: msg.script || null,
            order: index,
            type: msg.type || null,
            chapterId: mappedChapterId,
          }
        })

        await prisma.message.createMany({
          data: messageData,
        })
        console.log(`Created ${messages.length} messages`)

        await rebuildParagraphEmbeddings({ storyId: story.id })
      } catch (msgError) {
        console.error('Error creating messages:', msgError)
        // Clean up the story if message creation fails
        await prisma.story.delete({ where: { id: story.id } })
        throw msgError
      }
    }

    // Create characters separately
    if (characters && characters.length > 0) {
      try {
        for (const char of characters) {
          let profileImageId: string | undefined

          if (typeof char.profileImageData === 'string' && char.profileImageData.startsWith('data:')) {
            const matches = char.profileImageData.match(/^data:([^;]+);base64,(.+)$/)
            if (matches) {
              const mimeType = matches[1]
              const base64Data = matches[2]
              const buffer = Buffer.from(base64Data, 'base64')

              const file = await prisma.file.create({
                data: {
                  storyId: story.id,
                  filename: `character_${char.id}.${mimeType.split('/')[1] || 'png'}`,
                  mimeType,
                  data: buffer,
                },
              })

              profileImageId = file.id
            }
          }

          await prisma.character.create({
            data: {
              id: char.id,
              storyId: story.id,
              name: char.name,
              description: char.description,
              birthdate: char.birthdate ?? null,
              isProtagonist: char.isProtagonist || false,
              profileImageId,
            },
          })
        }
        console.log(`Created ${characters.length} characters`)
      } catch (charError) {
        console.error('Error creating characters:', charError)
        // Clean up
        await prisma.story.delete({ where: { id: story.id } })
        throw charError
      }
    }

    // Create context items separately
    if (contextItems && contextItems.length > 0) {
      try {
        const contextData = contextItems.map((item: any) => ({
          id: item.id,
          storyId: story.id,
          type: item.type,
          name: item.name,
          description: item.description,
          isActive: item.isActive !== undefined ? item.isActive : true,
        }))
        await prisma.contextItem.createMany({
          data: contextData,
        })
        console.log(`Created ${contextItems.length} context items`)
      } catch (ctxError) {
        console.error('Error creating context items:', ctxError)
        // Clean up
        await prisma.story.delete({ where: { id: story.id } })
        throw ctxError
      }
    }

    // Fetch the complete story with all related data
    const completeStory = await prisma.story.findUnique({
      where: { id: story.id },
      include: {
        messages: {
          where: { deleted: false },
          orderBy: { order: 'asc' },
        },
        characters: true,
        contextItems: true,
        chapters: true,
        calendars: true,
      },
    })

    if (completeStory) {
      const characterImageIds = completeStory.characters
        .map((character) => character.profileImageId)
        .filter((id): id is string => Boolean(id))

      let charactersWithImages = completeStory.characters

      if (characterImageIds.length > 0) {
        const files = await prisma.file.findMany({
          where: { id: { in: characterImageIds } },
          select: { id: true, mimeType: true, data: true },
        })
        const fileMap = new Map(files.map((file) => [file.id, file]))

        charactersWithImages = completeStory.characters.map((character) => {
          const file = character.profileImageId ? fileMap.get(character.profileImageId) : undefined

          return {
            ...character,
            profileImageData: file ? `data:${file.mimeType};base64,${Buffer.from(file.data).toString('base64')}` : null,
          }
        })
      } else {
        charactersWithImages = completeStory.characters.map((character) => ({
          ...character,
          profileImageData: null,
        }))
      }

      res.json({
        ...completeStory,
        characters: charactersWithImages,
      })
    } else {
      res.json(completeStory)
    }
  } catch (error: any) {
    console.error('Error creating story - Full error:', error)
    console.error('Error stack:', error.stack)

    // Send more detailed error information
    const errorMessage = error.message || 'Failed to create story'
    const errorDetails = {
      error: errorMessage,
      type: error.constructor.name,
      code: error.code,
    }

    res.status(500).json(errorDetails)
  }
})

export default router
