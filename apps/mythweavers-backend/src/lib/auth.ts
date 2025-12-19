import type { FastifyReply, FastifyRequest } from 'fastify'
import { authConfig } from './config.js'
import { prisma } from './prisma.js'

/**
 * Authentication helper that extracts user from session cookie
 * Returns user object if authenticated, null otherwise
 */
export async function getUserFromSession(request: FastifyRequest) {
  const token = request.cookies.sessionToken

  if (!token) {
    return null
  }

  // Find session and check if it's valid
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({
        where: { id: session.id },
      })
    }
    return null
  }

  // Refresh session expiry
  const newExpiresAt = new Date(Date.now() + authConfig.sessionDuration)
  await prisma.session.update({
    where: { id: session.id },
    data: { expiresAt: newExpiresAt },
  })

  return session.user
}

/**
 * Authentication middleware that requires a valid session
 * Throws 401 error if not authenticated
 */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  const user = await getUserFromSession(request)

  if (!user) {
    // Create and throw a proper error with status code
    const error = new Error('Authentication required') as Error & { statusCode?: number }
    error.statusCode = 401
    throw error
  }

  // Attach user to request for use in route handlers
  request.user = user
}

// Type augmentation for custom request properties
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: number
      email: string
      username: string
      passwordHash: string
      role: string
      avatarUrl: string | null
      createdAt: Date
      updatedAt: Date
    }
  }
}
