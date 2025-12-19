import { Router } from 'express'
import getEpisodeRouter from './getEpisode'
import getFrameRouter from './getFrame'
import getSegmentVideoRouter from './getSegmentVideo'
import listEpisodesRouter from './listEpisodes'

const router = Router()

router.use(listEpisodesRouter)
router.use(getEpisodeRouter)
router.use(getFrameRouter)
router.use(getSegmentVideoRouter)

export default router
