import { Router } from 'express'
import { prisma } from '../../lib/prisma'

const router = Router()

// DELETE calendar
router.delete('/calendars/:calendarId', async (req, res) => {
  try {
    const { calendarId } = req.params

    // Validate that calendar exists
    const calendar = await prisma.calendar.findUnique({
      where: { id: calendarId },
      include: { story: true },
    })

    if (!calendar) {
      res.status(404).json({ error: 'Calendar not found' })
    }

    // Check if this is the default calendar
    if (calendar.story.defaultCalendarId === calendarId) {
      // Find another calendar to set as default
      const otherCalendar = await prisma.calendar.findFirst({
        where: {
          storyId: calendar.storyId,
          id: { not: calendarId },
        },
      })

      if (otherCalendar) {
        // Set another calendar as default before deleting
        await prisma.story.update({
          where: { id: calendar.storyId },
          data: { defaultCalendarId: otherCalendar.id },
        })
      } else {
        // This is the last calendar - can't delete it
        res.status(400).json({
          error: 'Cannot delete the only calendar for a story. Create another calendar first.',
        })
      }
    }

    // Delete the calendar
    await prisma.calendar.delete({
      where: { id: calendarId },
    })

    res.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting calendar:', error)
    res.status(500).json({ error: 'Failed to delete calendar' })
  }
})

export default router
