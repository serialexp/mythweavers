import type { FastifyReply, FastifyRequest } from 'fastify'
import { authConfig } from './config.js'
import { prisma } from './prisma.js'

/**
 * Check for Bearer token (AccessToken) authentication
 * Returns user object if valid token found, null otherwise
 */
async function getUserFromAccessToken(request: FastifyRequest) {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7) // Remove 'Bearer ' prefix
  if (!token) {
    return null
  }

  const accessToken = await prisma.accessToken.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!accessToken) {
    return null
  }

  // Check if token has expired (null expiresAt = never expires)
  if (accessToken.expiresAt && accessToken.expiresAt < new Date()) {
    // Delete expired token
    await prisma.accessToken.delete({
      where: { id: accessToken.id },
    })
    return null
  }

  // Update lastUsed timestamp (fire and forget, don't block request)
  prisma.accessToken.update({
    where: { id: accessToken.id },
    data: { lastUsed: new Date() },
  }).catch(() => {
    // Ignore errors updating lastUsed
  })

  return accessToken.user
}

/**
 * Authentication helper that checks Bearer token first, then session cookie
 * Returns user object if authenticated, null otherwise
 */
export async function getUserFromSession(request: FastifyRequest) {
  // Check Bearer token first (for API/artifact access)
  const tokenUser = await getUserFromAccessToken(request)
  if (tokenUser) {
    return tokenUser
  }

  // Fall back to session cookie
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

/**
 * Optional-auth middleware. Attaches `request.user` if a valid session
 * cookie is present, but does NOT reject the request when no user is
 * found. Use on endpoints that serve both anonymous and authenticated
 * traffic (e.g. public file reads where the handler itself decides
 * whether to allow access based on the resource's visibility flag).
 */
export async function attachUser(request: FastifyRequest, _reply: FastifyReply) {
  const user = await getUserFromSession(request)
  if (user) {
    request.user = user
  }
}

/**
 * Admin middleware that requires an authenticated admin user.
 * Throws 401 if not authenticated, 403 if not admin.
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply)
  if (request.user?.role !== 'admin') {
    const error = new Error('Admin access required') as Error & { statusCode?: number }
    error.statusCode = 403
    throw error
  }
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
      balance: import('@prisma/client').Prisma.Decimal
      createdAt: Date
      updatedAt: Date
    }
  }
}
