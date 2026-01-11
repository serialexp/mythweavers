import { randomBytes } from 'node:crypto'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { getUserFromSession } from '../../lib/auth.js'

// Constants
const DEVICE_CODE_EXPIRY_MINUTES = 15
const ACCESS_TOKEN_EXPIRY_DAYS = 60

// Generate a human-friendly user code (e.g., "ABCD-1234")
function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // No I, O to avoid confusion
  const nums = '23456789' // No 0, 1 to avoid confusion
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  code += '-'
  for (let i = 0; i < 4; i++) {
    code += nums.charAt(Math.floor(Math.random() * nums.length))
  }
  return code
}

// Generate access token with mw_ prefix
function generateAccessToken(): string {
  return `mw_${randomBytes(32).toString('hex')}`
}

// Schemas
const deviceCodeRequestSchema = z.strictObject({
  client_id: z.string().optional().meta({
    description: 'Optional client identifier',
    example: 'claude-artifact',
  }),
})

const deviceCodeResponseSchema = z.strictObject({
  device_code: z.string().meta({
    description: 'Device code for polling',
    example: 'abc123...',
  }),
  user_code: z.string().meta({
    description: 'Human-readable code for user to enter',
    example: 'ABCD-1234',
  }),
  verification_uri: z.string().meta({
    description: 'URL where user should go to enter the code',
    example: 'https://api.mythweavers.io/device',
  }),
  expires_in: z.number().meta({
    description: 'Seconds until device code expires',
    example: 900,
  }),
  interval: z.number().meta({
    description: 'Minimum seconds between polling requests',
    example: 5,
  }),
})

const tokenRequestSchema = z.strictObject({
  grant_type: z.literal('urn:ietf:params:oauth:grant-type:device_code').meta({
    description: 'OAuth grant type for device flow',
  }),
  device_code: z.string().meta({
    description: 'Device code from initial request',
    example: 'abc123...',
  }),
  client_id: z.string().optional().meta({
    description: 'Optional client identifier',
    example: 'claude-artifact',
  }),
})

const tokenResponseSchema = z.strictObject({
  access_token: z.string().meta({
    description: 'Access token for API calls',
    example: 'mw_abc123...',
  }),
  token_type: z.literal('Bearer').meta({
    description: 'Token type',
    example: 'Bearer',
  }),
  expires_in: z.number().meta({
    description: 'Seconds until token expires',
    example: 5184000,
  }),
})

const tokenErrorSchema = z.strictObject({
  error: z.enum([
    'authorization_pending',
    'slow_down',
    'expired_token',
    'access_denied',
    'invalid_request',
  ]).meta({
    description: 'OAuth error code',
    example: 'authorization_pending',
  }),
  error_description: z.string().optional().meta({
    description: 'Human-readable error description',
  }),
})

const errorSchema = z.strictObject({
  error: z.string().meta({ example: 'Invalid request' }),
})

const approveRequestSchema = z.strictObject({
  user_code: z.string().meta({
    description: 'User code to approve',
    example: 'ABCD-1234',
  }),
})

const approveResponseSchema = z.strictObject({
  success: z.literal(true),
  message: z.string().meta({
    example: 'Device authorized successfully',
  }),
})

const oauthRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // POST /oauth/device - Start device authorization flow
  fastify.post(
    '/device',
    {
      schema: {
        description: 'Request a device code for OAuth device flow authentication',
        tags: ['oauth'],
        body: deviceCodeRequestSchema,
        response: {
          200: deviceCodeResponseSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        // Generate codes
        const deviceCode = randomBytes(32).toString('hex')
        let userCode = generateUserCode()

        // Ensure user code is unique (retry if collision)
        let attempts = 0
        while (attempts < 10) {
          const existing = await prisma.deviceCode.findUnique({
            where: { userCode },
          })
          if (!existing) break
          userCode = generateUserCode()
          attempts++
        }

        const expiresAt = new Date(Date.now() + DEVICE_CODE_EXPIRY_MINUTES * 60 * 1000)

        // Store device code
        await prisma.deviceCode.create({
          data: {
            deviceCode,
            userCode,
            expiresAt,
          },
        })

        // Build verification URI
        const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3201}`
        const verificationUri = `${baseUrl}/device`

        return {
          device_code: deviceCode,
          user_code: userCode,
          verification_uri: verificationUri,
          expires_in: DEVICE_CODE_EXPIRY_MINUTES * 60,
          interval: 5,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to create device code')
        return reply.status(500).send({ error: 'Failed to create device code' })
      }
    },
  )

  // POST /oauth/token - Exchange device code for access token
  fastify.post(
    '/token',
    {
      schema: {
        description: 'Exchange device code for access token (poll until authorized)',
        tags: ['oauth'],
        body: tokenRequestSchema,
        response: {
          200: tokenResponseSchema,
          400: tokenErrorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { device_code } = request.body

        // Find device code
        const deviceCodeRecord = await prisma.deviceCode.findUnique({
          where: { deviceCode: device_code },
        })

        if (!deviceCodeRecord) {
          return reply.status(400).send({
            error: 'invalid_request',
            error_description: 'Invalid device code',
          })
        }

        // Check if expired
        if (deviceCodeRecord.expiresAt < new Date()) {
          // Clean up expired code
          await prisma.deviceCode.delete({
            where: { id: deviceCodeRecord.id },
          })
          return reply.status(400).send({
            error: 'expired_token',
            error_description: 'Device code has expired',
          })
        }

        // Check if approved
        if (!deviceCodeRecord.approved || !deviceCodeRecord.userId) {
          return reply.status(400).send({
            error: 'authorization_pending',
            error_description: 'User has not yet authorized this device',
          })
        }

        // Generate access token
        const accessToken = generateAccessToken()
        const expiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

        // Create access token
        await prisma.accessToken.create({
          data: {
            userId: deviceCodeRecord.userId,
            token: accessToken,
            name: 'Claude Artifact',
            expiresAt,
          },
        })

        // Clean up device code
        await prisma.deviceCode.delete({
          where: { id: deviceCodeRecord.id },
        })

        return {
          access_token: accessToken,
          token_type: 'Bearer' as const,
          expires_in: ACCESS_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to exchange device code')
        return reply.status(500).send({ error: 'Failed to exchange device code' })
      }
    },
  )

  // POST /oauth/approve - Approve a device code (requires auth)
  fastify.post(
    '/approve',
    {
      schema: {
        description: 'Approve a device code (requires authentication)',
        tags: ['oauth'],
        body: approveRequestSchema,
        response: {
          200: approveResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        // Require authentication
        const user = await getUserFromSession(request)
        if (!user) {
          return reply.status(401).send({ error: 'Authentication required' })
        }

        const { user_code } = request.body

        // Normalize user code (uppercase, ensure hyphen)
        const normalizedCode = user_code.toUpperCase().replace(/\s+/g, '')
        const formattedCode = normalizedCode.includes('-')
          ? normalizedCode
          : `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4)}`

        // Find device code
        const deviceCodeRecord = await prisma.deviceCode.findUnique({
          where: { userCode: formattedCode },
        })

        if (!deviceCodeRecord) {
          return reply.status(404).send({ error: 'Invalid or expired code' })
        }

        // Check if expired
        if (deviceCodeRecord.expiresAt < new Date()) {
          await prisma.deviceCode.delete({
            where: { id: deviceCodeRecord.id },
          })
          return reply.status(400).send({ error: 'Code has expired' })
        }

        // Check if already approved
        if (deviceCodeRecord.approved) {
          return reply.status(400).send({ error: 'Code already used' })
        }

        // Approve the device code
        await prisma.deviceCode.update({
          where: { id: deviceCodeRecord.id },
          data: {
            approved: true,
            userId: user.id,
          },
        })

        return {
          success: true as const,
          message: 'Device authorized successfully',
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to approve device code')
        return reply.status(500).send({ error: 'Failed to approve device code' })
      }
    },
  )
}

export default oauthRoutes
