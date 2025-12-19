import { NextFunction, Response } from 'express'
import { logger } from '../lib/logger'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth'

const log = logger.child({ module: 'story-auth-middleware' })

export async function verifyStoryOwnership(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const storyId = req.params.storyId || req.params.id

    if (!storyId) {
      res.status(400).json({ error: 'Story ID is required' })
      return
    }

    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    // Check if the story exists and belongs to the authenticated user
    const story = await prisma.story.findFirst({
      where: {
        id: storyId,
        userId: req.userId,
        deleted: false,
      },
    })

    if (!story) {
      res.status(404).json({ error: 'Story not found or access denied' })
      return
    }
    // Attach story to request for use in route handlers
    ;(req as any).story = story

    next()
  } catch (error) {
    log.error({ error }, 'Story ownership verification failed')
    res.status(500).json({ error: 'Failed to verify story ownership' })
  }
}
