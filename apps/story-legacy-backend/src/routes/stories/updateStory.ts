import { Router } from 'express'
import { createLogger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'
import { AuthRequest } from '../../middleware/auth'
import { migrateStoryToNodes } from '../nodes/migrateStory'

const router = Router()
const log = createLogger('stories')

// PUT update story
router.put('/stories/:id', async (req, res) => {
  try {
    const {
      name,
      messages,
      characters,
      contextItems,
      chapters,
      nodes,
      maps,
      input,
      storySetting,
      person,
      tense,
      globalScript,
      selectedChapterId,
      selectedNodeId,
      provider,
      model,
      lastKnownUpdatedAt,
      force,
    } = req.body

    // Calculate total landmark count from map metadata
    const totalLandmarks = maps?.reduce((total: number, map: any) => total + (map.landmarkCount || 0), 0) || 0

    log.info(
      {
        storyId: req.params.id,
        messageCount: messages?.length || 0,
        characterCount: characters?.length || 0,
        contextItemCount: contextItems?.length || 0,
        chapterCount: chapters?.length || 0,
        mapCount: maps?.length || 0,
        landmarkCount: totalLandmarks,
        lastKnownUpdatedAt,
        force,
      },
      'Updating story',
    )

    // Check for version conflict if lastKnownUpdatedAt is provided
    if (lastKnownUpdatedAt && !force) {
      const currentStory = await prisma.story.findFirst({
        where: {
          id: req.params.id,
          userId: (req as any as AuthRequest).userId,
          deleted: false,
        },
        select: { updatedAt: true },
      })

      if (!currentStory) {
        return res.status(404).json({ error: 'Story not found or access denied' })
      }

      const serverUpdatedAt = currentStory.updatedAt
      const clientUpdatedAt = new Date(lastKnownUpdatedAt)

      // If server version is newer than client's last known version, reject the update
      if (serverUpdatedAt > clientUpdatedAt) {
        console.log('Version conflict detected:', {
          serverUpdatedAt: serverUpdatedAt.toISOString(),
          clientUpdatedAt: clientUpdatedAt.toISOString(),
        })

        res.status(409).json({
          error: 'The server version is newer than your local version. Do you want to overwrite it?',
          serverUpdatedAt: serverUpdatedAt.toISOString(),
          clientUpdatedAt: clientUpdatedAt.toISOString(),
        })
      }
    }

    // Use a transaction to ensure atomicity
    // Increase timeout to 30 seconds for large stories
    const transactionStart = Date.now()
    const completeStory = await prisma.$transaction(
      async (prisma) => {
        // Update story basic info (with ownership check)
        const storyUpdateStart = Date.now()
        await prisma.story.updateMany({
          where: {
            id: req.params.id,
            userId: (req as any as AuthRequest).userId,
            deleted: false,
          },
          data: {
            name,
            input: input || '',
            storySetting: storySetting || '',
            person: person || 'third',
            tense: tense || 'past',
            globalScript: globalScript || null,
            selectedChapterId: selectedChapterId || null,
            selectedNodeId: selectedNodeId || null,
            provider: provider || 'ollama',
            model: model || null,
          },
        })
        log.info({ duration: Date.now() - storyUpdateStart }, 'Story update completed')

        // Get existing messages, characters, context items, and chapters
        const fetchStart = Date.now()
        const existingMessages = await prisma.message.findMany({
          where: { storyId: req.params.id, deleted: false },
        })
        const existingCharacters = await prisma.character.findMany({
          where: { storyId: req.params.id },
        })
        const existingContextItems = await prisma.contextItem.findMany({
          where: { storyId: req.params.id },
        })
        const existingChapters = await prisma.chapter.findMany({
          where: { storyId: req.params.id },
        })
        let existingNodes = await prisma.node.findMany({
          where: { storyId: req.params.id },
        })
        log.info(
          {
            duration: Date.now() - fetchStart,
            counts: {
              messages: existingMessages.length,
              characters: existingCharacters.length,
              contextItems: existingContextItems.length,
              chapters: existingChapters.length,
              nodes: existingNodes.length,
            },
          },
          'Fetched existing data',
        )

        // Create maps for quick lookup
        const existingMessageMap = new Map(existingMessages.map((m) => [m.id, m]))
        const existingCharacterMap = new Map(existingCharacters.map((c) => [c.id, c]))
        const existingContextMap = new Map(existingContextItems.map((i) => [i.id, i]))
        const existingChapterMap = new Map(existingChapters.map((ch) => [ch.id, ch]))
        // const existingNodeMap = new Map(existingNodes.map((n) => [n.id, n]));

        // Ensure story is migrated to nodes if needed
        // This handles cases where chapters exist but nodes don't
        if (!nodes || nodes.length === 0) {
          if (existingChapters.length > 0) {
            log.info('No nodes provided but chapters exist, running migration')
            await migrateStoryToNodes(req.params.id)
            // Refresh existingNodes after migration
            existingNodes = await prisma.node.findMany({
              where: { storyId: req.params.id },
            })
          }
        }

        // Process nodes (before messages, since messages reference nodes)
        if (nodes && nodes.length > 0) {
          const nodeIds = new Set(nodes.map((n: any) => n.id).filter(Boolean))

          // Delete nodes that are no longer in the update
          const nodesToDelete = existingNodes.filter((n) => !nodeIds.has(n.id)).map((n) => n.id)

          if (nodesToDelete.length > 0) {
            await prisma.node.deleteMany({
              where: {
                storyId: req.params.id,
                id: { in: nodesToDelete },
              },
            })
          }

          // Upsert all nodes
          for (const node of nodes) {
            // Convert array fields to JSON strings for SQLite (same logic as updateNode.ts)
            const activeCharacterIds =
              node.activeCharacterIds !== undefined
                ? Array.isArray(node.activeCharacterIds)
                  ? JSON.stringify(node.activeCharacterIds)
                  : node.activeCharacterIds
                : null

            const activeContextItemIds =
              node.activeContextItemIds !== undefined
                ? Array.isArray(node.activeContextItemIds)
                  ? JSON.stringify(node.activeContextItemIds)
                  : node.activeContextItemIds
                : null

            await prisma.node.upsert({
              where: {
                id: node.id,
              },
              update: {
                parentId: node.parentId || null,
                type: node.type,
                title: node.title,
                summary: node.summary || null,
                order: node.order,
                expanded: node.expanded !== undefined ? node.expanded : true,
                includeInFull: node.includeInFull || false,
                status: node.status || null,
                goal: node.goal || null,
                activeCharacterIds,
                activeContextItemIds,
                viewpointCharacterId: node.viewpointCharacterId || null,
                storyTime: node.storyTime ?? null,
              },
              create: {
                id: node.id,
                storyId: req.params.id,
                parentId: node.parentId || null,
                type: node.type,
                title: node.title,
                summary: node.summary || null,
                order: node.order,
                expanded: node.expanded !== undefined ? node.expanded : true,
                includeInFull: node.includeInFull || false,
                status: node.status || null,
                goal: node.goal || null,
                activeCharacterIds,
                activeContextItemIds,
                viewpointCharacterId: node.viewpointCharacterId || null,
                storyTime: node.storyTime ?? null,
              },
            })
          }
          log.info({ nodeCount: nodes.length }, 'Nodes processed')
        }

        // Process chapters next (before messages, since messages reference chapters)
        const finalChapterIds = new Set<string>() // Track which chapters will exist after updates
        if (chapters && chapters.length > 0) {
          const chapterIds = new Set(chapters.map((ch: any) => ch.id).filter(Boolean))

          // Delete chapters that are no longer in the update
          const chaptersToDelete = existingChapters.filter((ch) => !chapterIds.has(ch.id)).map((ch) => ch.id)
          if (chaptersToDelete.length > 0) {
            await prisma.chapter.deleteMany({
              where: { id: { in: chaptersToDelete } },
            })
          }

          // Track which chapters will remain
          chapters.forEach((ch: any) => {
            if (ch.id) finalChapterIds.add(ch.id)
          })

          // Update or create chapters
          for (let index = 0; index < chapters.length; index++) {
            const chapter = chapters[index]
            const chapterData = {
              storyId: req.params.id,
              title: chapter.title || 'Untitled Chapter',
              summary: chapter.summary || null,
              expanded: chapter.expanded !== undefined ? chapter.expanded : true,
              createdAt: chapter.createdAt ? new Date(chapter.createdAt) : new Date(),
              updatedAt: chapter.updatedAt ? new Date(chapter.updatedAt) : new Date(),
            }

            if (chapter.id && existingChapterMap.has(chapter.id)) {
              // Update existing chapter
              await prisma.chapter.update({
                where: { id: chapter.id },
                data: chapterData,
              })
            } else {
              // Create new chapter
              await prisma.chapter.create({
                data: {
                  id: chapter.id,
                  ...chapterData,
                },
              })
            }
          }
        } else {
          // If no chapters provided, delete all
          await prisma.chapter.deleteMany({
            where: { storyId: req.params.id },
          })
        }

        // Process messages
        if (messages && messages.length > 0) {
          const messagesStart = Date.now()
          log.info({ count: messages.length }, 'Processing messages')

          // Validate that all messages have an order field
          for (let index = 0; index < messages.length; index++) {
            const msg = messages[index]
            if (msg.order === undefined || msg.order === null) {
              throw new Error(`Message ${msg.id || `at index ${index}`} is missing required 'order' field`)
            }
          }

          const messageIds = new Set(messages.map((m: any) => m.id).filter(Boolean))

          // Soft delete messages that are no longer in the update
          const messagesToDelete = existingMessages.filter((m) => !messageIds.has(m.id) && !m.deleted).map((m) => m.id)
          if (messagesToDelete.length > 0) {
            await prisma.message.updateMany({
              where: { id: { in: messagesToDelete } },
              data: { deleted: true },
            })
          }

          // Get all valid node IDs after processing nodes
          const validNodeIds = new Set<string>()
          if (nodes && nodes.length > 0) {
            nodes.forEach((node: any) => {
              if (node.id) validNodeIds.add(node.id)
            })
          }
          // Also include existing nodes that weren't deleted
          const currentNodes = await prisma.node.findMany({
            where: { storyId: req.params.id },
            select: { id: true },
          })
          currentNodes.forEach((node) => validNodeIds.add(node.id))

          // Separate messages into updates and creates
          const separateStart = Date.now()
          const messagesToUpdate = []
          const messagesToCreate = []

          for (let index = 0; index < messages.length; index++) {
            const msg = messages[index]
            const messageData = {
              storyId: req.params.id,
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
              summary: msg.summary || null,
              sentenceSummary: msg.sentenceSummary || null,
              paragraphSummary: msg.paragraphSummary || null,
              isExpanded: msg.isExpanded || false,
              isInstructionExpanded: msg.isInstructionExpanded || false,
              isSummarizing: msg.isSummarizing || false,
              think: msg.think || null,
              showThink: msg.showThink || false,
              sceneAnalysis: msg.sceneAnalysis ? msg.sceneAnalysis : null,
              isAnalyzing: msg.isAnalyzing || false,
              model: msg.model || null,
              isCompacted: msg.isCompacted || false,
              compactedMessageIds: msg.compactedMessageIds ? msg.compactedMessageIds : null,
              script: msg.script || null,
              order: msg.order, // Always use the provided order field (validated above)
              type: msg.type || null,
              // Only set chapterId if it will exist in the Chapter table after updates
              chapterId: msg.chapterId && finalChapterIds.has(msg.chapterId) ? msg.chapterId : null,
              // Only set nodeId if it exists in the Node table
              nodeId:
                msg.nodeId && validNodeIds.has(msg.nodeId)
                  ? msg.nodeId
                  : msg.chapterId && validNodeIds.has(msg.chapterId)
                    ? msg.chapterId
                    : null,
            }

            if (msg.id && existingMessageMap.has(msg.id)) {
              // Add to update batch
              messagesToUpdate.push({
                where: {
                  storyId_id: {
                    storyId: req.params.id,
                    id: msg.id,
                  },
                },
                data: messageData,
              })
            } else {
              // Add to create batch
              messagesToCreate.push({
                ...(msg.id ? { id: msg.id } : {}),
                ...messageData,
              })
            }
          }
          log.info(
            {
              duration: Date.now() - separateStart,
              toUpdate: messagesToUpdate.length,
              toCreate: messagesToCreate.length,
            },
            'Separated messages',
          )

          // Execute batch updates
          // SQLite only allows one writer at a time, so we can't actually parallelize
          // Instead, we should use updateMany where possible or sequential updates
          const updateStart = Date.now()
          for (const update of messagesToUpdate) {
            try {
              // Before updating, verify ALL foreign keys exist
              const verifications: any = {
                messageId: update.where.storyId_id.id,
                storyId: update.data.storyId,
                nodeId: update.data.nodeId,
                chapterId: update.data.chapterId,
              }

              // Verify story exists
              if (update.data.storyId) {
                const storyExists = await prisma.story.findUnique({
                  where: { id: update.data.storyId },
                })
                verifications.storyExists = !!storyExists
              }

              // Verify node exists if nodeId is set
              if (update.data.nodeId) {
                const nodeExists = await prisma.node.findUnique({
                  where: { id: update.data.nodeId },
                })
                verifications.nodeExists = !!nodeExists
                verifications.nodeId_verified = update.data.nodeId
              }

              // Verify chapter exists if chapterId is set
              if (update.data.chapterId) {
                const chapterExists = await prisma.chapter.findUnique({
                  where: { id: update.data.chapterId },
                })
                verifications.chapterExists = !!chapterExists
                verifications.chapterId_verified = update.data.chapterId
              }

              // Log the complete update data if any verification fails
              if (
                (update.data.nodeId && !verifications.nodeExists) ||
                (update.data.chapterId && !verifications.chapterExists) ||
                (update.data.storyId && !verifications.storyExists)
              ) {
                console.error('Foreign key verification failed:', {
                  verifications,
                  fullUpdateData: JSON.stringify(update.data, null, 2),
                  validNodeIds: Array.from(validNodeIds),
                  existingChapterIds: Array.from(existingChapterMap.keys()),
                })
              }

              await prisma.message.update(update)
            } catch (error: any) {
              // Log the complete failing message data
              console.error('Failed to update message - COMPLETE DATA:', {
                messageId: update.where.storyId_id.id,
                whereClause: update.where,
                fullUpdateData: update.data,
                validNodeIds: Array.from(validNodeIds),
                existingChapterIds: Array.from(existingChapterMap.keys()),
                error: error.message,
              })

              // Also try to fetch the current message to see its state
              try {
                const currentMessage = await prisma.message.findUnique({
                  where: {
                    storyId_id: update.where.storyId_id,
                  },
                })
                console.error('Current message state in DB:', currentMessage)
              } catch (_e) {
                console.error('Could not fetch current message state')
              }

              throw error
            }
          }
          if (messagesToUpdate.length > 0) {
            log.info(
              {
                duration: Date.now() - updateStart,
                count: messagesToUpdate.length,
                avgPerMessage: (Date.now() - updateStart) / messagesToUpdate.length,
              },
              'Completed message updates',
            )
          }

          // Execute batch creates
          if (messagesToCreate.length > 0) {
            const createStart = Date.now()
            await prisma.message.createMany({
              data: messagesToCreate,
            })
            log.info(
              {
                duration: Date.now() - createStart,
                count: messagesToCreate.length,
              },
              'Completed message creates',
            )
          }

          log.info(
            {
              totalDuration: Date.now() - messagesStart,
              totalMessages: messages.length,
            },
            'Finished processing all messages',
          )
        } else {
          // If no messages provided, soft delete all
          await prisma.message.updateMany({
            where: { storyId: req.params.id, deleted: false },
            data: { deleted: true },
          })
        }

        // Process characters
        if (characters && characters.length > 0) {
          const characterIds = new Set(characters.map((c: any) => c.id).filter(Boolean))

          // Delete characters that are no longer in the update
          const charactersToDelete = existingCharacters.filter((c) => !characterIds.has(c.id)).map((c) => c.id)
          if (charactersToDelete.length > 0) {
            const fileIdsToDelete = existingCharacters
              .filter((c) => charactersToDelete.includes(c.id))
              .map((c) => c.profileImageId)
              .filter((id): id is string => Boolean(id))

            if (fileIdsToDelete.length > 0) {
              await prisma.file.deleteMany({
                where: { id: { in: fileIdsToDelete } },
              })
            }

            await prisma.character.deleteMany({
              where: { id: { in: charactersToDelete } },
            })
          }

          // Update or create characters
          for (const char of characters) {
            const existingCharacter = char.id ? existingCharacterMap.get(char.id) : undefined
            let profileImageId = existingCharacter?.profileImageId ?? null

            if (char.profileImageData === null) {
              if (profileImageId) {
                await prisma.file.deleteMany({
                  where: { id: profileImageId },
                })
              }
              profileImageId = null
            } else if (typeof char.profileImageData === 'string' && char.profileImageData.startsWith('data:')) {
              const matches = char.profileImageData.match(/^data:([^;]+);base64,(.+)$/)
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
                      storyId: req.params.id,
                      filename: `character_${char.id}.${mimeType.split('/')[1] || 'png'}`,
                      mimeType,
                      data: buffer,
                    },
                  })
                  profileImageId = file.id
                }
              }
            }

            const characterData: any = {
              storyId: req.params.id,
              name: char.name,
              description: char.description,
              birthdate: char.birthdate ?? null,
              isProtagonist: char.isProtagonist || false,
            }

            if (char.profileImageData !== undefined) {
              characterData.profileImageId = profileImageId
            }

            if (char.id && existingCharacterMap.has(char.id)) {
              // Update existing character
              await prisma.character.update({
                where: {
                  storyId_id: {
                    storyId: req.params.id,
                    id: char.id,
                  },
                },
                data: characterData,
              })
              if (char.id && existingCharacter && characterData.profileImageId !== undefined) {
                existingCharacterMap.set(char.id, {
                  ...existingCharacter,
                  profileImageId: characterData.profileImageId ?? null,
                })
              }
            } else {
              // Create new character
              await prisma.character.create({
                data: {
                  id: char.id,
                  ...characterData,
                  profileImageId: characterData.profileImageId ?? undefined,
                },
              })
            }
          }
        } else {
          // If no characters provided, delete all
          const allFileIds = existingCharacters.map((c) => c.profileImageId).filter((id): id is string => Boolean(id))

          if (allFileIds.length > 0) {
            await prisma.file.deleteMany({
              where: { id: { in: allFileIds } },
            })
          }

          await prisma.character.deleteMany({
            where: { storyId: req.params.id },
          })
        }

        // Note: Maps are managed through separate /api/stories/:storyId/maps endpoints
        // The 'maps' parameter here is only metadata for validation/counting

        // Process context items
        if (contextItems && contextItems.length > 0) {
          const contextIds = new Set(contextItems.map((i: any) => i.id).filter(Boolean))

          // Delete context items that are no longer in the update
          const contextToDelete = existingContextItems.filter((i) => !contextIds.has(i.id)).map((i) => i.id)
          if (contextToDelete.length > 0) {
            await prisma.contextItem.deleteMany({
              where: { id: { in: contextToDelete } },
            })
          }

          // Update or create context items
          for (const item of contextItems) {
            const contextData = {
              storyId: req.params.id,
              type: item.type,
              name: item.name,
              description: item.description,
              isActive: item.isActive !== undefined ? item.isActive : true,
            }

            if (item.id && existingContextMap.has(item.id)) {
              // Update existing context item
              await prisma.contextItem.update({
                where: {
                  storyId_id: {
                    storyId: req.params.id,
                    id: item.id,
                  },
                },
                data: contextData,
              })
            } else {
              // Create new context item
              await prisma.contextItem.create({
                data: {
                  id: item.id,
                  ...contextData,
                },
              })
            }
          }
        } else {
          // If no context items provided, delete all
          await prisma.contextItem.deleteMany({
            where: { storyId: req.params.id },
          })
        }

        // Return minimal response - client already has the data
        // Only return the updated timestamp for version tracking
        const finalFetchStart = Date.now()
        const result = await prisma.story.findUnique({
          where: { id: req.params.id },
          select: {
            id: true,
            name: true,
            updatedAt: true,
            savedAt: true,
          },
        })
        log.info({ duration: Date.now() - finalFetchStart }, 'Final fetch completed')
        log.info({ totalTransactionTime: Date.now() - transactionStart }, 'Transaction completed')
        return result
      },
      {
        maxWait: 30000, // Maximum time to wait for a transaction slot (30 seconds)
        timeout: 30000, // Maximum time the transaction can run (30 seconds)
      },
    )

    res.json(completeStory)
  } catch (error: any) {
    console.error('Error updating story - Full error:', error)
    console.error('Error stack:', error.stack)

    // Send more detailed error information
    const errorMessage = error.message || 'Failed to update story'
    const errorDetails = {
      error: errorMessage,
      type: error.constructor.name,
      code: error.code,
    }

    res.status(500).json(errorDetails)
  }
})

export default router
