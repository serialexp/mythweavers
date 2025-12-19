import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'
import { Request, Response } from 'express'
import { authConfig } from '../../lib/config'
import { logger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'

const log = logger.child({ module: 'auth-register' })
const scryptAsync = promisify(scrypt)

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, username, password } = req.body

    // Validate input
    if (!email || !username || !password) {
      res.status(400).json({ error: 'Email, username, and password are required' })
      return
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long' })
      return
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
      },
    })

    if (existingUser) {
      res.status(409).json({
        error: existingUser.email === email.toLowerCase() ? 'Email already registered' : 'Username already taken',
      })
      return
    }

    // Hash password with scrypt
    const salt = randomBytes(16).toString('hex')
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
    const passwordHash = `${salt}:${derivedKey.toString('hex')}`

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        passwordHash,
      },
    })

    // Check if this is the first user - if so, assign all unassigned stories
    const userCount = await prisma.user.count()
    if (userCount === 1) {
      log.info('First user registered, assigning all unassigned stories')
      await prisma.story.updateMany({
        where: { userId: null },
        data: { userId: user.id },
      })
    }

    // Create session
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

    log.info({ userId: user.id, username: user.username }, 'User registered successfully')

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    })
  } catch (error) {
    log.error({ error }, 'Registration failed')
    res.status(500).json({ error: 'Registration failed' })
  }
}
