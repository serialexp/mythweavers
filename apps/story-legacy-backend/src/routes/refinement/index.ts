import { Router } from 'express'
import getRefinementStatus from './getRefinementStatus'
import startRefinement from './startRefinement'
import stopRefinement from './stopRefinement'

const router = Router()

// Mount all refinement routes
router.use(startRefinement)
router.use(getRefinementStatus)
router.use(stopRefinement)

export default router
