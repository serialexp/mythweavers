import { Request, Response } from 'express'
import { logger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'

const log = logger.child({ module: 'auth-logout' })

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const token = req.cookies?.sessionToken

    if (token) {
      // Delete session from database
      await prisma.session.deleteMany({
        where: { token },
      })
    }

    // Clear cookie
    res.clearCookie('sessionToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    })

    log.info('User logged out successfully')

    res.json({ success: true, message: 'Logged out successfully' })
  } catch (error) {
    log.error({ error }, 'Logout failed')
    res.status(500).json({ error: 'Logout failed' })
  }
}
