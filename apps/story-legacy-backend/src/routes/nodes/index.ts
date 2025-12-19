import { Router } from 'express'
import { createNode } from './createNode'
import { deleteNode } from './deleteNode'
import { getNodes } from './getNodes'
import { updateNode } from './updateNode'
import { updateNodesBulk } from './updateNodesBulk'

const router = Router()

// Node routes
router.get('/stories/:storyId/nodes', getNodes)
router.post('/stories/:storyId/nodes', createNode)
router.put('/stories/:storyId/nodes/bulk', updateNodesBulk)
router.put('/stories/:storyId/nodes/:nodeId', updateNode)
router.delete('/stories/:storyId/nodes/:nodeId', deleteNode)

export default router
