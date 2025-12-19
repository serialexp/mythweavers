import type { CalendarConfig } from '@mythweavers/shared'
import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { AuthRequest } from '../../middleware/auth'

const router = Router()

/**
 * Get the default calendar for a story
 * GET /stories/:id/calendar
 */
router.get('/stories/:id/calendar', async (req, res) => {
  try {
    const authReq = req as any as AuthRequest
    const storyId = authReq.params.id

    // Get story with default calendar
    const story = await prisma.story.findFirst({
      where: {
        id: storyId,
        userId: authReq.userId,
        deleted: false,
      },
      include: {
        defaultCalendar: true,
      },
    })

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
    }

    if (!story.defaultCalendar) {
      res.status(404).json({ error: 'Story has no default calendar' })
    }

    // Parse the calendar config
    const config = JSON.parse(story.defaultCalendar.config) as CalendarConfig

    res.json({
      id: story.defaultCalendar.id,
      config,
    })
  } catch (error) {
    console.error('Error fetching calendar:', error)
    res.status(500).json({ error: 'Failed to fetch calendar' })
  }
})

export default router
