import { randomBytes } from 'node:crypto'
import { Request, Response } from 'express'
import { logger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'
import { sendPasswordResetEmail } from '../../services/emailService'

const log = logger.child({ module: 'auth-password-reset-request' })

export async function requestPasswordReset(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body

    // Validate input
    if (!email) {
      res.status(400).json({ error: 'Email is required' })
      return
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      log.info({ email }, 'Password reset requested for non-existent email')
      res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      })
      return
    }

    // Invalidate any existing password reset tokens
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        used: false,
        expiresAt: { gt: new Date() },
      },
      data: {
        used: true,
      },
    })

    // Create new password reset token
    const resetToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt,
      },
    })

    // Send password reset email
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`
    log.info({ userId: user.id, email: user.email, resetLink }, 'Password reset token created')

    await sendPasswordResetEmail(user.email, resetLink)

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
      // For development only - remove in production
      ...(process.env.NODE_ENV !== 'production' && { resetLink }),
    })
  } catch (error) {
    log.error({ error }, 'Password reset request failed')
    res.status(500).json({ error: 'Failed to process password reset request' })
  }
}
