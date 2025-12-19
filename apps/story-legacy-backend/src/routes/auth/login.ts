import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'
import { Request, Response } from 'express'
import { authConfig } from '../../lib/config'
import { logger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'

const log = logger.child({ module: 'auth-login' })
const scryptAsync = promisify(scrypt)

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { username, password } = req.body

    // Validate input
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' })
      return
    }

    // Find user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: username.toLowerCase() }, { username: username.toLowerCase() }],
      },
    })

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    // Verify password
    const [salt, storedHash] = user.passwordHash.split(':')
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
    const derivedHash = derivedKey.toString('hex')

    if (storedHash !== derivedHash) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    // Clean up old sessions for this user
    await prisma.session.deleteMany({
      where: {
        userId: user.id,
        expiresAt: { lt: new Date() },
      },
    })

    // Create new session
    const sessionToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + authConfig.sessionDuration)

    await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt,
      },
    })

    // Set cookie
    res.cookie('sessionToken', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: authConfig.sessionDuration,
      path: '/',
    })

    log.info({ userId: user.id, username: user.username }, 'User logged in successfully')

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    })
  } catch (error) {
    log.error({ error }, 'Login failed')
    res.status(500).json({ error: 'Login failed' })
  }
}
