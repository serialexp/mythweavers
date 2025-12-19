import { Router } from 'express'
import { prisma } from '../../lib/prisma'

const router = Router()

// POST create calendar for a story
router.post('/stories/:storyId/calendars', async (req, res) => {
  try {
    const { storyId } = req.params
    const { config, setAsDefault } = req.body

    // Validate that story exists
    const story = await prisma.story.findUnique({
      where: { id: storyId },
    })

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
    }

    // Create the calendar
    const calendar = await prisma.calendar.create({
      data: {
        storyId,
        config: JSON.stringify(config),
      },
    })

    // If this should be the default calendar, update the story
    if (setAsDefault) {
      await prisma.story.update({
        where: { id: storyId },
        data: { defaultCalendarId: calendar.id },
      })
    }

    res.json(calendar)
  } catch (error: any) {
    console.error('Error creating calendar:', error)
    res.status(500).json({ error: 'Failed to create calendar' })
  }
})

export default router
