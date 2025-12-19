import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const router = Router()

// Validation schema for chapter updates
const ChapterUpdateSchema = z
  .object({
    title: z.string().optional(),
    summary: z.string().nullable().optional(),
    expanded: z.boolean().optional(),
    includeInFull: z.boolean().optional(),
    status: z.string().nullable().optional(),
    createdAt: z.union([z.string(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.date()]).optional(),
  })
  .strict() // strict mode will reject any extra fields

// PUT update single chapter
router.put('/stories/:storyId/chapters/:chapterId', async (req, res) => {
  try {
    const { storyId, chapterId } = req.params

    // Validate the request body
    const validationResult = ChapterUpdateSchema.safeParse(req.body)
    if (!validationResult.success) {
      console.error('Chapter update validation failed:', validationResult.error)
      res.status(400).json({
        error: 'Invalid chapter data',
        details: validationResult.error.issues,
      })
    }

    const chapterData = validationResult.data
    console.log('Updating single chapter:', { storyId, chapterId, data: chapterData })

    // Verify the story exists
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true },
    })

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
    }

    // Check if chapter exists
    const existingChapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
    })

    let result
    if (existingChapter) {
      // Update existing chapter - use all fields from validated data
      const updateData: any = {
        ...chapterData,
        // Convert date strings to Date objects if present
        ...(chapterData.createdAt && { createdAt: new Date(chapterData.createdAt) }),
        ...(chapterData.updatedAt && { updatedAt: new Date(chapterData.updatedAt) }),
        // Always update the updatedAt timestamp
        updatedAt: new Date(),
      }

      result = await prisma.chapter.update({
        where: { id: chapterId },
        data: updateData,
      })
    } else {
      // Create new chapter
      const createData: any = {
        ...chapterData,
        id: chapterId,
        storyId,
        title: chapterData.title || 'Untitled Chapter',
        createdAt: chapterData.createdAt ? new Date(chapterData.createdAt) : new Date(),
        updatedAt: new Date(),
      }

      result = await prisma.chapter.create({
        data: createData,
      })
    }

    // Update the story's updatedAt timestamp
    await prisma.story.update({
      where: { id: storyId },
      data: { updatedAt: new Date() },
    })

    res.json(result)
  } catch (error: any) {
    console.error('Error updating chapter:', error)
    res.status(500).json({
      error: error.message || 'Failed to update chapter',
    })
  }
})

// DELETE single chapter
router.delete('/stories/:storyId/chapters/:chapterId', async (req, res) => {
  try {
    const { storyId, chapterId } = req.params

    console.log('Deleting single chapter:', { storyId, chapterId })

    // Delete the chapter
    const result = await prisma.chapter.delete({
      where: { id: chapterId },
    })

    // Update messages that belonged to this chapter to have no chapter
    await prisma.message.updateMany({
      where: {
        storyId,
        chapterId,
      },
      data: {
        chapterId: null,
      },
    })

    // Update the story's updatedAt timestamp
    await prisma.story.update({
      where: { id: storyId },
      data: { updatedAt: new Date() },
    })

    res.json(result)
  } catch (error: any) {
    console.error('Error deleting chapter:', error)
    res.status(500).json({
      error: error.message || 'Failed to delete chapter',
    })
  }
})

export default router
