import { Router } from 'express'
import createChapter from './createChapter'
import deleteChapter from './deleteChapter'
import generateSummary from './generateSummary'
import getChapters from './getChapters'
import updateChapter from './updateChapter'

const router = Router()

// Mount all chapter routes
router.use(getChapters)
router.use(createChapter)
router.use(updateChapter)
router.use(deleteChapter)
router.use(generateSummary)

export default router
