import { NextFunction, Request, Response } from 'express'
import { authConfig } from '../lib/config'
import { logger } from '../lib/logger'
import { prisma } from '../lib/prisma'

const log = logger.child({ module: 'auth-middleware' })

export interface AuthRequest extends Request {
  userId: string
  sessionId: string
}

export interface OptionalAuthRequest extends Request {
  userId?: string
  sessionId?: string
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.sessionToken

    if (!token) {
      res.status(401).json({ error: 'No authentication token provided' })
      return
    }

    // Find session and check if it's valid
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!session) {
      res.status(401).json({ error: 'Invalid session token' })
      return
    }

    // Check if session has expired
    if (session.expiresAt < new Date()) {
      // Delete expired session
      await prisma.session.delete({
        where: { id: session.id },
      })
      res.status(401).json({ error: 'Session expired' })
      return
    }

    // Refresh session expiry (rolling session)
    const newExpiresAt = new Date(Date.now() + authConfig.sessionDuration)
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: newExpiresAt },
    })

    // Add user info to request
    ;(req as AuthRequest).userId = session.userId
    ;(req as AuthRequest).sessionId = session.id

    next()
  } catch (error) {
    log.error({ error }, 'Authentication error')
    res.status(500).json({ error: 'Authentication failed' })
  }
}

// Optional middleware for routes that can work with or without auth
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.sessionToken

    if (!token) {
      next()
      return
    }

    // Find session and check if it's valid
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    })

    if (session && session.expiresAt > new Date()) {
      // Refresh session expiry
      const newExpiresAt = new Date(Date.now() + authConfig.sessionDuration)
      await prisma.session.update({
        where: { id: session.id },
        data: { expiresAt: newExpiresAt },
      })
      ;(req as OptionalAuthRequest).userId = session.userId
      ;(req as OptionalAuthRequest).sessionId = session.id
    }

    next()
  } catch (error) {
    log.error({ error }, 'Optional auth error')
    next()
  }
}
