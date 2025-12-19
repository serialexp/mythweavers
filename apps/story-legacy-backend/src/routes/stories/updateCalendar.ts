import { Router } from 'express'
import { prisma } from '../../lib/prisma'

const router = Router()

// PUT update calendar
router.put('/calendars/:calendarId', async (req, res) => {
  try {
    const { calendarId } = req.params
    const { config } = req.body

    // Validate that calendar exists
    const existingCalendar = await prisma.calendar.findUnique({
      where: { id: calendarId },
    })

    if (!existingCalendar) {
      res.status(404).json({ error: 'Calendar not found' })
    }

    // Update the calendar
    const calendar = await prisma.calendar.update({
      where: { id: calendarId },
      data: {
        config: JSON.stringify(config),
      },
    })

    res.json(calendar)
  } catch (error: any) {
    console.error('Error updating calendar:', error)
    res.status(500).json({ error: 'Failed to update calendar' })
  }
})

export default router
