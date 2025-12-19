import { Request, Response } from 'express'
import { authConfig } from '../../lib/config'
import { logger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'

const log = logger.child({ module: 'auth-session' })

export async function checkSession(req: Request, res: Response): Promise<void> {
  try {
    const token = req.cookies?.sessionToken

    if (!token) {
      res.json({ authenticated: false })
      return
    }

    // Find session and check if it's valid
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      // Clean up expired session if found
      if (session) {
        await prisma.session.delete({
          where: { id: session.id },
        })
      }
      res.json({ authenticated: false })
      return
    }

    // Refresh session expiry
    const newExpiresAt = new Date(Date.now() + authConfig.sessionDuration)
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: newExpiresAt },
    })

    // Only refresh cookie if close to expiry
    // We don't have the original cookie creation time, but we can estimate based on session creation
    // Assuming the cookie and session were created together
    const sessionAge = Date.now() - session.createdAt.getTime()
    const timeRemaining = authConfig.sessionDuration - sessionAge

    // If less than threshold remaining, refresh the cookie
    if (timeRemaining < authConfig.cookieRefreshThreshold) {
      res.cookie('sessionToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: authConfig.sessionDuration,
        path: '/',
      })
    }

    res.json({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        username: session.user.username,
      },
    })
  } catch (error) {
    log.error({ error }, 'Session check failed')
    res.status(500).json({ error: 'Session check failed' })
  }
}
