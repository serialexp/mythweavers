import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import authRoutes from './auth'
import chapterRoutes from './chapters'
import chapterSingleRoutes from './chapters/updateChapterSingle'
import { createCharacter } from './characters/createCharacter'
import { deleteCharacter } from './characters/deleteCharacter'
import { updateCharacter } from './characters/updateCharacter'
import { deleteContextItem } from './contextItems/deleteContextItem'
import { updateContextItem } from './contextItems/updateContextItem'
import episodeRoutes from './episodes'
import fleetRoutes from './fleets'
import healthRoutes from './health'
import logRoutes from './health/log'
import hyperlaneRoutes from './hyperlanes'
import landmarkStateRoutes from './landmarkStates'
import landmarkRoutes from './landmarks'
import mapRoutes from './maps'
import createMessageVersionRoutes from './messages/createMessageVersion'
import messageVersionRoutes from './messages/getMessageVersions'
import { reorderMessages } from './messages/reorderMessages'
import semanticMessageSearchRoutes from './messages/semanticSearch'
import messageRoutes from './messages/updateMessage'
import nodeRoutes from './nodes'
import refinementRoutes from './refinement'
import storyRoutes from './stories'
import storySettingsRoutes from './stories/updateSettings'

const router = Router()

// Public routes (no auth required)
router.use('/api', healthRoutes)
router.use('/api', logRoutes)
router.use('/api', authRoutes)
router.use('/api', episodeRoutes) // Episodes are public for now

// Protected routes (auth required)
router.use('/api', authenticateToken, storyRoutes)
router.use('/api/stories', authenticateToken, storySettingsRoutes)
router.use('/api', authenticateToken, chapterRoutes)
router.use('/api', authenticateToken, chapterSingleRoutes)
router.use('/api', authenticateToken, messageRoutes)
router.use('/api', authenticateToken, semanticMessageSearchRoutes)
router.use('/api', authenticateToken, refinementRoutes)
router.use('/api', authenticateToken, mapRoutes)
router.use('/api', authenticateToken, landmarkRoutes)
router.use('/api', authenticateToken, landmarkStateRoutes)
router.use('/api', authenticateToken, nodeRoutes)
router.use('/api', authenticateToken, fleetRoutes)
router.use('/api', authenticateToken, hyperlaneRoutes)

// Character routes
router.post('/api/stories/:storyId/characters', authenticateToken, createCharacter)
router.put('/api/stories/:storyId/characters/:characterId', authenticateToken, updateCharacter)
router.delete('/api/stories/:storyId/characters/:characterId', authenticateToken, deleteCharacter)

// Context item routes
router.put('/api/stories/:storyId/context-items/:itemId', authenticateToken, updateContextItem)
router.delete('/api/stories/:storyId/context-items/:itemId', authenticateToken, deleteContextItem)

// Message reordering route
router.post('/api/stories/:storyId/messages/reorder', authenticateToken, reorderMessages)

// Message versions routes
router.use('/api', authenticateToken, messageVersionRoutes)
router.use('/api', authenticateToken, createMessageVersionRoutes)

export default router
