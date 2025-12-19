import { Router } from 'express'
import { prisma } from '../../lib/prisma'

const router = Router()

// PUT set default calendar for a story
router.put('/stories/:storyId/default-calendar', async (req, res) => {
  try {
    const { storyId } = req.params
    const { calendarId } = req.body

    // Validate that story exists
    const story = await prisma.story.findUnique({
      where: { id: storyId },
    })

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
    }

    // Validate that calendar exists and belongs to this story
    const calendar = await prisma.calendar.findUnique({
      where: { id: calendarId },
    })

    if (!calendar) {
      res.status(404).json({ error: 'Calendar not found' })
    }

    if (calendar.storyId !== storyId) {
      res.status(400).json({ error: 'Calendar does not belong to this story' })
    }

    // Update the story's default calendar
    const updatedStory = await prisma.story.update({
      where: { id: storyId },
      data: { defaultCalendarId: calendarId },
    })

    res.json(updatedStory)
  } catch (error: any) {
    console.error('Error setting default calendar:', error)
    res.status(500).json({ error: 'Failed to set default calendar' })
  }
})

export default router
