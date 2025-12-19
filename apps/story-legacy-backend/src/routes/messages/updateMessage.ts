import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import {
  deleteParagraphEmbeddings,
  refreshParagraphEmbeddingsForMessage,
  splitIntoParagraphs,
} from '../../services/paragraphEmbeddingService'
import { saveMessageVersion } from './saveMessageVersion'

const router = Router()

// PUT update single message
router.put('/stories/:storyId/messages/:messageId', async (req, res) => {
  try {
    const { storyId, messageId } = req.params
    const messageData = req.body
    const authReq = req as any
    const userId = authReq.userId

    console.log('Updating single message:', { storyId, messageId, userId })

    // Verify the story exists and belongs to the user
    const story = await prisma.story.findFirst({
      where: {
        id: storyId,
        userId: userId,
        deleted: false,
      },
    })

    if (!story) {
      console.error(`[update] Story not found or unauthorized: storyId=${storyId}, userId=${userId}`)
      res.status(404).json({ error: 'Story not found or unauthorized' })
    }

    // Check if message exists
    const existingMessage = await prisma.message.findUnique({
      where: {
        storyId_id: {
          storyId,
          id: messageId,
        },
      },
    })

    let result
    if (existingMessage) {
      // Save current version before updating (only if content is changing)
      if (existingMessage.content !== messageData.content) {
        // Determine version type - use 'rewrite' if specified, otherwise 'edit'
        const versionType = messageData.versionType === 'rewrite' ? 'rewrite' : 'edit'
        await saveMessageVersion(
          storyId,
          messageId,
          versionType,
          existingMessage.content,
          existingMessage.instruction,
          existingMessage.model,
        )
      }

      // Update existing message
      result = await prisma.message.update({
        where: {
          storyId_id: {
            storyId,
            id: messageId,
          },
        },
        data: {
          role: messageData.role,
          content: messageData.content,
          instruction: messageData.instruction || null,
          timestamp: messageData.timestamp ? new Date(messageData.timestamp) : undefined,
          tokensPerSecond: messageData.tokensPerSecond || null,
          totalTokens: messageData.totalTokens || null,
          promptTokens: messageData.promptTokens || null,
          cacheCreationTokens: messageData.cacheCreationTokens || null,
          cacheReadTokens: messageData.cacheReadTokens || null,
          isQuery: messageData.isQuery || false,
          sentenceSummary: messageData.sentenceSummary || null,
          summary: messageData.summary || null,
          paragraphSummary: messageData.paragraphSummary || null,
          isExpanded: messageData.isExpanded || false,
          isInstructionExpanded: messageData.isInstructionExpanded || false,
          isSummarizing: messageData.isSummarizing || false,
          think: messageData.think || null,
          showThink: messageData.showThink || false,
          sceneAnalysis: messageData.sceneAnalysis || null,
          isAnalyzing: messageData.isAnalyzing || false,
          model: messageData.model || null,
          isCompacted: messageData.isCompacted || false,
          compactedMessageIds: messageData.compactedMessageIds || null,
          script: messageData.script || null,
          type: messageData.type || null,
          options: messageData.options || null,
          chapterId: messageData.chapterId || null,
          nodeId: messageData.nodeId || null,
          order: messageData.order !== undefined ? messageData.order : undefined,
          // Only update deleted if explicitly provided
          ...(messageData.deleted !== undefined ? { deleted: messageData.deleted } : {}),
        },
      })

      if (messageData.content !== undefined) {
        await refreshParagraphEmbeddingsForMessage({
          storyId,
          messageId,
          content: result.content,
          isQuery: result.isQuery,
        })
      }
    } else {
      // Create new message
      // Get the highest order value for this story (excluding deleted messages)
      const maxOrder = await prisma.message.aggregate({
        where: {
          storyId,
          deleted: false,
        },
        _max: { order: true },
      })

      result = await prisma.message.create({
        data: {
          id: messageId,
          storyId,
          role: messageData.role,
          content: messageData.content,
          instruction: messageData.instruction || null,
          timestamp: messageData.timestamp ? new Date(messageData.timestamp) : new Date(),
          tokensPerSecond: messageData.tokensPerSecond || null,
          totalTokens: messageData.totalTokens || null,
          promptTokens: messageData.promptTokens || null,
          cacheCreationTokens: messageData.cacheCreationTokens || null,
          cacheReadTokens: messageData.cacheReadTokens || null,
          isQuery: messageData.isQuery || false,
          sentenceSummary: messageData.sentenceSummary || null,
          summary: messageData.summary || null,
          paragraphSummary: messageData.paragraphSummary || null,
          isExpanded: messageData.isExpanded || false,
          isInstructionExpanded: messageData.isInstructionExpanded || false,
          isSummarizing: messageData.isSummarizing || false,
          think: messageData.think || null,
          showThink: messageData.showThink || false,
          sceneAnalysis: messageData.sceneAnalysis || null,
          isAnalyzing: messageData.isAnalyzing || false,
          model: messageData.model || null,
          isCompacted: messageData.isCompacted || false,
          compactedMessageIds: messageData.compactedMessageIds || null,
          script: messageData.script || null,
          type: messageData.type || null,
          options: messageData.options || null,
          chapterId: messageData.chapterId || null,
          nodeId: messageData.nodeId || null,
          order: messageData.order ?? (maxOrder._max.order || 0) + 1,
          deleted: false,
        },
      })

      if (messageData.content) {
        await refreshParagraphEmbeddingsForMessage({
          storyId,
          messageId,
          content: result.content,
          isQuery: result.isQuery,
        })
      }
    }

    // Update the story's updatedAt timestamp
    await prisma.story.update({
      where: { id: storyId },
      data: { updatedAt: new Date() },
    })

    res.json(result)
  } catch (error: any) {
    console.error('Error updating message:', error)
    res.status(500).json({
      error: error.message || 'Failed to update message',
    })
  }
})

// DELETE single message (soft delete)
router.delete('/stories/:storyId/messages/:messageId', async (req, res) => {
  try {
    const { storyId, messageId } = req.params

    console.log('Deleting single message:', { storyId, messageId })

    // Soft delete the message
    const result = await prisma.message.update({
      where: {
        storyId_id: {
          storyId,
          id: messageId,
        },
      },
      data: {
        deleted: true,
      },
    })

    await deleteParagraphEmbeddings({ storyId, messageId })

    // Update the story's updatedAt timestamp
    await prisma.story.update({
      where: { id: storyId },
      data: { updatedAt: new Date() },
    })

    res.json(result)
  } catch (error: any) {
    console.error('Error deleting message:', error)
    res.status(500).json({
      error: error.message || 'Failed to delete message',
    })
  }
})

// POST insert message at specific position
router.post('/stories/:storyId/messages/:afterMessageId/insert', async (req, res) => {
  try {
    const { storyId, afterMessageId } = req.params
    const messageData = req.body
    const authReq = req as any
    const userId = authReq.userId

    console.log('Inserting message:', {
      storyId,
      afterMessageId,
      messageId: messageData.id,
      userId,
      authenticated: !!userId,
    })

    // Verify the story exists and belongs to the user
    const story = await prisma.story.findFirst({
      where: {
        id: storyId,
        userId: userId,
        deleted: false,
      },
    })

    if (!story) {
      console.error(`[insert] Story not found or unauthorized: storyId=${storyId}, userId=${userId}`)
      res.status(404).json({ error: 'Story not found or unauthorized' })
    }

    // Find the insertion point
    let insertOrder = 0
    const targetNodeId = messageData.nodeId || messageData.chapterId

    if (afterMessageId !== 'null' && afterMessageId !== 'undefined') {
      const afterMessage = await prisma.message.findUnique({
        where: {
          storyId_id: {
            storyId,
            id: afterMessageId,
          },
        },
        select: { order: true, nodeId: true, chapterId: true },
      })

      if (afterMessage) {
        insertOrder = afterMessage.order + 1

        // Shift only non-deleted messages in the same node that come after this position
        // Order is per-node, not global
        const afterNodeId = afterMessage.nodeId || afterMessage.chapterId
        await prisma.message.updateMany({
          where: {
            storyId,
            OR: [{ nodeId: afterNodeId }, { chapterId: afterNodeId }],
            order: { gte: insertOrder },
            deleted: false,
          },
          data: {
            order: { increment: 1 },
          },
        })
      }
    } else {
      // Insert at beginning of the target node, shift only non-deleted messages in that node
      if (targetNodeId) {
        await prisma.message.updateMany({
          where: {
            storyId,
            OR: [{ nodeId: targetNodeId }, { chapterId: targetNodeId }],
            deleted: false,
          },
          data: {
            order: { increment: 1 },
          },
        })
      } else {
        // Fallback: no target node specified, shift all non-deleted messages (legacy behavior)
        await prisma.message.updateMany({
          where: {
            storyId,
            deleted: false,
          },
          data: {
            order: { increment: 1 },
          },
        })
      }
    }

    // Validate chapterId if provided
    if (messageData.chapterId) {
      const chapter = await prisma.chapter.findFirst({
        where: {
          id: messageData.chapterId,
          storyId,
        },
      })
      if (!chapter) {
        console.error(`[insert] Chapter ${messageData.chapterId} not found for story ${storyId}`)
        res.status(400).json({
          error: 'Invalid chapter ID',
          details: `Chapter ${messageData.chapterId} does not exist in story ${storyId}`,
        })
      }
    }

    // Validate nodeId if provided
    if (messageData.nodeId) {
      const node = await prisma.node.findFirst({
        where: {
          id: messageData.nodeId,
          storyId,
        },
      })
      if (!node) {
        console.error(`[insert] Node ${messageData.nodeId} not found for story ${storyId}`)
        res.status(400).json({
          error: 'Invalid node ID',
          details: `Node ${messageData.nodeId} does not exist in story ${storyId}`,
        })
      }
    }

    const paragraphs = splitIntoParagraphs(messageData.content || '')

    // Create the new message
    const result = await prisma.message.create({
      data: {
        id: messageData.id,
        storyId,
        role: messageData.role,
        content: messageData.content,
        instruction: messageData.instruction || null,
        timestamp: messageData.timestamp ? new Date(messageData.timestamp) : new Date(),
        tokensPerSecond: messageData.tokensPerSecond || null,
        totalTokens: messageData.totalTokens || null,
        promptTokens: messageData.promptTokens || null,
        cacheCreationTokens: messageData.cacheCreationTokens || null,
        cacheReadTokens: messageData.cacheReadTokens || null,
        isQuery: messageData.isQuery || false,
        sentenceSummary: messageData.sentenceSummary || null,
        summary: messageData.summary || null,
        paragraphSummary: messageData.paragraphSummary || null,
        isExpanded: messageData.isExpanded || false,
        isInstructionExpanded: messageData.isInstructionExpanded || false,
        isSummarizing: messageData.isSummarizing || false,
        think: messageData.think || null,
        showThink: messageData.showThink || false,
        sceneAnalysis: messageData.sceneAnalysis || null,
        isAnalyzing: messageData.isAnalyzing || false,
        model: messageData.model || null,
        isCompacted: messageData.isCompacted || false,
        compactedMessageIds: messageData.compactedMessageIds || null,
        script: messageData.script || null,
        type: messageData.type || null,
        options: messageData.options || null,
        chapterId: messageData.chapterId || null,
        nodeId: messageData.nodeId || null,
        order: insertOrder,
        deleted: false,
        paragraphs,
      },
    })

    if (messageData.content) {
      await refreshParagraphEmbeddingsForMessage({
        storyId,
        messageId: result.id,
        content: result.content,
        isQuery: result.isQuery,
      })
    }

    // Update the story's updatedAt timestamp
    const updatedStory = await prisma.story.update({
      where: { id: storyId },
      data: { updatedAt: new Date() },
      select: { updatedAt: true },
    })

    console.log(`[insert] Message ${result.id} inserted successfully:`, {
      order: result.order,
      deleted: result.deleted,
      isCompacted: result.isCompacted,
      chapterId: result.chapterId,
      contentLength: result.content?.length,
    })

    res.json({
      ...result,
      updatedAt: updatedStory.updatedAt.toISOString(),
    })
  } catch (error: any) {
    console.error('Error inserting message:', error)
    res.status(500).json({
      error: error.message || 'Failed to insert message',
    })
  }
})

export default router
