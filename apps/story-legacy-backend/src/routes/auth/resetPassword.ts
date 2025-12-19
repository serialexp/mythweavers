import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'
import { Request, Response } from 'express'
import { logger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'
import { sendPasswordChangedEmail } from '../../services/emailService'

const log = logger.child({ module: 'auth-password-reset' })
const scryptAsync = promisify(scrypt)

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, newPassword } = req.body

    // Validate input
    if (!token || !newPassword) {
      res.status(400).json({ error: 'Token and new password are required' })
      return
    }

    // Validate password strength
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long' })
      return
    }

    // Find valid token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!resetToken) {
      res.status(400).json({ error: 'Invalid or expired reset token' })
      return
    }

    // Check if token is expired
    if (resetToken.expiresAt < new Date()) {
      res.status(400).json({ error: 'Reset token has expired' })
      return
    }

    // Check if token has already been used
    if (resetToken.used) {
      res.status(400).json({ error: 'Reset token has already been used' })
      return
    }

    // Hash the new password
    const salt = randomBytes(16).toString('hex')
    const derivedKey = (await scryptAsync(newPassword, salt, 64)) as Buffer
    const hash = derivedKey.toString('hex')
    const passwordHash = `${salt}:${hash}`

    // Update user password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
      // Invalidate all existing sessions for this user (force re-login)
      prisma.session.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ])

    // Send confirmation email
    await sendPasswordChangedEmail(resetToken.user.email)

    log.info({ userId: resetToken.userId }, 'Password reset successfully')

    res.json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    })
  } catch (error) {
    log.error({ error }, 'Password reset failed')
    res.status(500).json({ error: 'Failed to reset password' })
  }
}

export async function validateResetToken(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.params

    if (!token) {
      res.status(400).json({ error: 'Token is required' })
      return
    }

    // Find token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            email: true,
            username: true,
          },
        },
      },
    })

    if (!resetToken) {
      res.status(400).json({ error: 'Invalid reset token', valid: false })
      return
    }

    // Check if token is expired
    if (resetToken.expiresAt < new Date()) {
      res.status(400).json({ error: 'Reset token has expired', valid: false })
      return
    }

    // Check if token has already been used
    if (resetToken.used) {
      res.status(400).json({ error: 'Reset token has already been used', valid: false })
      return
    }

    res.json({
      valid: true,
      email: resetToken.user.email,
      username: resetToken.user.username,
    })
  } catch (error) {
    log.error({ error }, 'Failed to validate reset token')
    res.status(500).json({ error: 'Failed to validate token' })
  }
}
