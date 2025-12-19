import { Router } from 'express'
import { createHyperlane } from './createHyperlane'
import { deleteHyperlane } from './deleteHyperlane'
import { updateHyperlane } from './updateHyperlane'

const router = Router({ mergeParams: true })

// Hyperlane routes
router.post('/stories/:storyId/maps/:mapId/hyperlanes', createHyperlane)
router.put('/stories/:storyId/maps/:mapId/hyperlanes/:hyperlaneId', updateHyperlane)
router.delete('/stories/:storyId/maps/:mapId/hyperlanes/:hyperlaneId', deleteHyperlane)

export default router
