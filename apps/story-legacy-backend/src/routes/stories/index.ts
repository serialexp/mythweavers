import { Router } from 'express'
import createCalendar from './createCalendar'
import createStory from './createStory'
import deleteCalendar from './deleteCalendar'
import deleteStory from './deleteStory'
import exportPdf from './exportPdf'
import getAllStories from './getAllStories'
import getCalendar from './getCalendar'
import getCalendarPresets from './getCalendarPresets'
import getDeletedMessages from './getDeletedMessages'
import getStory from './getStory'
import restoreMessage from './restoreMessage'
import setDefaultCalendar from './setDefaultCalendar'
import updateCalendar from './updateCalendar'
import updateSettings from './updateSettings'
import updateStory from './updateStory'

const router = Router()

// Mount all story routes
router.use(getAllStories)
router.use(getStory)
router.use(getCalendar)
router.use(getCalendarPresets)
router.use(createCalendar)
router.use(updateCalendar)
router.use(deleteCalendar)
router.use(setDefaultCalendar)
router.use(createStory)
router.use(updateStory)
router.use(updateSettings)
router.use(deleteStory)
router.use(exportPdf)
router.use(getDeletedMessages)
router.use(restoreMessage)

export default router
