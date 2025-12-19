import { Router } from 'express'
import { createFleet } from './createFleet'
import { createFleetMovement } from './createFleetMovement'
import { deleteFleet } from './deleteFleet'
import { deleteFleetMovement } from './deleteFleetMovement'
import { updateFleet } from './updateFleet'
import { updateFleetMovement } from './updateFleetMovement'

const router = Router({ mergeParams: true })

// Fleet routes
router.post('/stories/:storyId/maps/:mapId/fleets', createFleet)
router.put('/stories/:storyId/maps/:mapId/fleets/:fleetId', updateFleet)
router.delete('/stories/:storyId/maps/:mapId/fleets/:fleetId', deleteFleet)

// Fleet movement routes
router.post('/stories/:storyId/maps/:mapId/fleets/:fleetId/movements', createFleetMovement)
router.put('/stories/:storyId/maps/:mapId/fleets/:fleetId/movements/:movementId', updateFleetMovement)
router.delete('/stories/:storyId/maps/:mapId/fleets/:fleetId/movements/:movementId', deleteFleetMovement)

export default router
