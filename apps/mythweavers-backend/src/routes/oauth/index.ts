import { randomBytes } from 'node:crypto'
import type { FastifyReply } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { SCOPE_DESCRIPTIONS, editorBase } from '../../lib/oauth-urls.js'
import { prisma } from '../../lib/prisma.js'
import {
  RedirectableAuthorizeError,
  createAuthorizationRequest,
  decideConsent,
  exchangeAuthorizationCode,
  getPendingConsent,
} from '../../services/oauth/authorize.js'
import { clientRegistrationResponse, registerClient } from '../../services/oauth/clients.js'
import { OAuthError } from '../../services/oauth/errors.js'
import { revokeToken, rotateRefreshToken } from '../../services/oauth/tokens.js'

// Constants
const DEVICE_CODE_EXPIRY_MINUTES = 15
const ACCESS_TOKEN_EXPIRY_DAYS = 60
const DEVICE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code'

/**
 * Serialize a thrown error as an OAuth error body.
 *
 * `OAuthError` carries a machine code from the RFC vocabulary; anything else is
 * an unexpected failure and becomes `server_error`, which is still a code the
 * client understands rather than a Fastify stack trace.
 */
function sendOAuthError(
  fastify: { log: { error: (obj: unknown, msg: string) => void } },
  reply: FastifyReply,
  error: unknown,
  logMessage: string,
) {
  if (error instanceof OAuthError) {
    return reply.status(error.status).send(error.toBody())
  }
  fastify.log.error({ err: error }, logMessage)
  return reply.status(500).send({ error: 'server_error', error_description: 'Unexpected server error' })
}

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

/**
 * The token endpoint speaks three grants, and OAuth clients expect machine-readable
 * error codes from a fixed vocabulary. A Zod discriminated union would turn an
 * unrecognised `grant_type` into a Fastify validation error shaped
 * `{ error: "<prose>", zodIssues: [...] }`, which the MCP SDK's `parseErrorResponse`
 * cannot read — it reports "invalid OAuth error response" and gives up instead of
 * retrying. So the body is accepted loosely here and dispatched by hand below.
 */
const tokenRequestSchema = z.looseObject({
  grant_type: z.string().meta({
    description: 'OAuth grant type',
    example: 'authorization_code',
  }),
  device_code: z.string().optional().meta({ description: 'Device flow: code from POST /oauth/device' }),
  code: z.string().optional().meta({ description: 'Authorization code flow: the one-time code' }),
  code_verifier: z.string().optional().meta({ description: 'Authorization code flow: PKCE verifier' }),
  redirect_uri: z
    .string()
    .optional()
    .meta({ description: 'Authorization code flow: must match the authorize request' }),
  refresh_token: z.string().optional().meta({ description: 'Refresh flow: the current refresh token' }),
  scope: z.string().optional().meta({ description: 'Optional space-delimited scope, never wider than the grant' }),
  resource: z.string().optional().meta({ description: 'RFC 8707 resource indicator' }),
  client_id: z.string().optional().meta({
    description: 'Client identifier',
    example: 'mwc_abc123...',
  }),
})

/**
 * Every key is declared, because the serializer drops what the schema does not
 * describe. A `z.strictObject` of three keys — which this used to be — would
 * silently swallow `refresh_token` behind a 200, and the symptom is a client
 * that works for exactly one hour and then re-prompts forever.
 */
const tokenResponseSchema = z.looseObject({
  access_token: z.string().meta({
    description: 'Access token for API calls',
    example: 'mw_abc123...',
  }),
  token_type: z.literal('Bearer').meta({
    description: 'Token type',
    example: 'Bearer',
  }),
  expires_in: z.number().meta({
    description: 'Seconds until the access token expires',
    example: 3600,
  }),
  refresh_token: z.string().optional().meta({
    description: 'Rotating refresh token (authorization code and refresh grants only)',
    example: 'mwr_abc123...',
  }),
  scope: z.string().optional().meta({
    description: 'Space-delimited granted scopes',
    example: 'stories:read stories:write',
  }),
})

const tokenErrorSchema = z.looseObject({
  error: z.string().meta({
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

// Registration request/response are intentionally open-ended: RFC 7591 lets a
// client send arbitrary metadata, and a strict schema would reject clients we
// have never heard of for fields we do not even read.
const registerRequestSchema = z.looseObject({
  redirect_uris: z.array(z.string()).meta({
    description: 'Callback URLs. https, or http with a loopback host for native apps.',
    example: ['http://localhost:51763/callback'],
  }),
  client_name: z.string().optional().meta({ description: 'Human-readable name shown on the consent screen' }),
  client_uri: z.string().optional(),
  logo_uri: z.string().optional(),
  scope: z.string().optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  token_endpoint_auth_method: z.string().optional(),
  software_id: z.string().optional(),
  software_version: z.string().optional(),
})

const registerResponseSchema = z.looseObject({
  client_id: z.string().meta({ example: 'mwc_abc123...' }),
  client_id_issued_at: z.number(),
  client_name: z.string(),
  redirect_uris: z.array(z.string()),
  grant_types: z.array(z.string()),
  response_types: z.array(z.string()),
  token_endpoint_auth_method: z.string(),
})

const consentScopeSchema = z.strictObject({
  scope: z.string().meta({ example: 'stories:write' }),
  description: z.string().meta({ example: 'Create and edit your stories, chapters and prose' }),
})

const consentResponseSchema = z.strictObject({
  client_name: z.string().meta({ description: 'Name the client registered itself under' }),
  client_uri: z.string().nullable(),
  logo_uri: z.string().nullable(),
  redirect_uri: z.string().meta({
    description: 'Where the user will be sent back to. A loopback URL means a CLI on this machine.',
    example: 'http://localhost:51763/callback',
  }),
  scopes: z.array(consentScopeSchema),
  expires_at: z.string().meta({ example: '2026-08-10T12:10:00.000Z' }),
})

const consentDecisionBodySchema = z.strictObject({
  decision: z.enum(['approve', 'deny']).meta({ description: 'Whether the user granted access' }),
})

const consentDecisionResponseSchema = z.strictObject({
  redirect_to: z.string().meta({
    description: 'URL the consent page must navigate to. Do not fetch it — it belongs to the client.',
  }),
})

const requestIdParamSchema = z.strictObject({
  requestId: z.string().meta({ description: 'Opaque authorization request handle from the consent URL' }),
})

const revokeRequestSchema = z.looseObject({
  token: z.string().meta({ description: 'Access token or refresh token to revoke' }),
  token_type_hint: z.string().optional(),
  client_id: z.string().optional(),
})

/**
 * @param opts.rootAlias when true, register only the four endpoints an MCP client
 * may guess at the origin root if authorization-server metadata discovery fails.
 * The device and consent routes have no such fallback and are not duplicated.
 */
const oauthRoutes: FastifyPluginAsyncZod<{ rootAlias?: boolean }> = async (fastify, opts) => {
  const rootAlias = opts.rootAlias === true

  // POST /oauth/register - RFC 7591 dynamic client registration
  fastify.post(
    '/register',
    {
      schema: {
        description: 'Dynamically register an OAuth client (RFC 7591)',
        tags: ['oauth'],
        body: registerRequestSchema,
        response: {
          201: registerResponseSchema,
          400: tokenErrorSchema,
          500: tokenErrorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const client = await registerClient(request.body)
        fastify.log.info({ clientId: client.clientId, clientName: client.clientName }, 'OAuth client registered')
        return reply.status(201).send(clientRegistrationResponse(client))
      } catch (error) {
        return sendOAuthError(fastify, reply, error, 'Failed to register OAuth client')
      }
    },
  )

  // GET /oauth/authorize - start the authorization code flow
  fastify.get(
    '/authorize',
    {
      schema: {
        description: 'Authorization endpoint. Redirects the browser to the consent screen.',
        tags: ['oauth'],
        // Accepted loosely so malformed input produces an OAuth error rather
        // than a Fastify validation body the client cannot parse.
        querystring: z.looseObject({
          client_id: z.string().optional(),
          redirect_uri: z.string().optional(),
          response_type: z.string().optional(),
          scope: z.string().optional(),
          state: z.string().optional(),
          code_challenge: z.string().optional(),
          code_challenge_method: z.string().optional(),
          resource: z.string().optional(),
        }),
        response: {
          302: z.null(),
          400: tokenErrorSchema,
          401: tokenErrorSchema,
          500: tokenErrorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { requestId } = await createAuthorizationRequest(request.query)
        // Fastify 5's signature is redirect(url, statusCode) — the v4 argument
        // order silently produces a 200 with a numeric body, so set the header
        // explicitly rather than depending on remembering which version this is.
        return reply.status(302).header('location', `${editorBase()}/oauth/consent?request_id=${requestId}`).send()
      } catch (error) {
        // Only errors raised after the redirect URI was validated may be sent
        // back by redirect. Anything earlier would make this an open redirector.
        if (error instanceof RedirectableAuthorizeError) {
          return reply.status(302).header('location', error.toLocation()).send()
        }
        return sendOAuthError(fastify, reply, error, 'Failed to start authorization')
      }
    },
  )

  // POST /oauth/revoke - RFC 7009
  fastify.post(
    '/revoke',
    {
      schema: {
        description: 'Revoke an access or refresh token (RFC 7009)',
        tags: ['oauth'],
        body: revokeRequestSchema,
        response: {
          200: z.null(),
          500: tokenErrorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        await revokeToken(request.body.token)
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to revoke token')
      }
      // RFC 7009 §2.2: always 200, even for an unknown token. Distinguishing
      // them would turn this endpoint into a token oracle.
      return reply.status(200).send()
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
      // Token responses must never be cached: they carry bearer credentials.
      reply.header('cache-control', 'no-store').header('pragma', 'no-cache')

      const body = request.body

      if (body.grant_type === 'authorization_code') {
        try {
          const issued = await exchangeAuthorizationCode(body)
          return {
            access_token: issued.accessToken,
            token_type: 'Bearer' as const,
            expires_in: issued.expiresIn,
            refresh_token: issued.refreshToken,
            scope: issued.scope,
          }
        } catch (error) {
          return sendOAuthError(fastify, reply, error, 'Failed to exchange authorization code')
        }
      }

      if (body.grant_type === 'refresh_token') {
        try {
          if (!body.refresh_token) {
            return reply.status(400).send({ error: 'invalid_request', error_description: 'refresh_token is required' })
          }
          const issued = await rotateRefreshToken({
            presented: body.refresh_token,
            clientId: body.client_id,
            resource: body.resource,
            scope: body.scope,
          })
          return {
            access_token: issued.accessToken,
            token_type: 'Bearer' as const,
            expires_in: issued.expiresIn,
            refresh_token: issued.refreshToken,
            scope: issued.scope,
          }
        } catch (error) {
          return sendOAuthError(fastify, reply, error, 'Failed to refresh token')
        }
      }

      if (body.grant_type !== DEVICE_GRANT_TYPE) {
        return reply.status(400).send({
          error: 'unsupported_grant_type',
          error_description: `Unsupported grant_type: ${body.grant_type}`,
        })
      }

      try {
        const device_code = body.device_code
        if (!device_code) {
          return reply.status(400).send({
            error: 'invalid_request',
            error_description: 'device_code is required',
          })
        }

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

  // The remaining routes are the interactive and device surfaces. Nothing ever
  // guesses their paths, so they exist only under /oauth.
  if (rootAlias) return

  // GET /oauth/consent/:requestId - details for the consent screen
  fastify.get(
    '/consent/:requestId',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Details of a pending authorization request, for the consent screen',
        tags: ['oauth'],
        security: [{ sessionAuth: [] }],
        params: requestIdParamSchema,
        response: {
          200: consentResponseSchema,
          401: errorSchema,
          404: tokenErrorSchema,
          500: tokenErrorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { request: authRequest, client } = await getPendingConsent(request.params.requestId)
        return {
          client_name: client.clientName,
          client_uri: client.clientUri,
          logo_uri: client.logoUri,
          redirect_uri: authRequest.redirectUri,
          scopes: authRequest.scope
            .split(' ')
            .filter(Boolean)
            .map((scope) => ({
              scope,
              description: SCOPE_DESCRIPTIONS[scope] ?? scope,
            })),
          expires_at: authRequest.expiresAt.toISOString(),
        }
      } catch (error) {
        return sendOAuthError(fastify, reply, error, 'Failed to load authorization request')
      }
    },
  )

  // POST /oauth/consent/:requestId - record the user's decision
  fastify.post(
    '/consent/:requestId',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Approve or deny a pending authorization request',
        tags: ['oauth'],
        security: [{ sessionAuth: [] }],
        params: requestIdParamSchema,
        body: consentDecisionBodySchema,
        response: {
          200: consentDecisionResponseSchema,
          401: errorSchema,
          404: tokenErrorSchema,
          500: tokenErrorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { redirectTo } = await decideConsent(request.params.requestId, request.user!.id, request.body.decision)
        fastify.log.info(
          { requestId: request.params.requestId, userId: request.user!.id, decision: request.body.decision },
          'OAuth consent decided',
        )
        // Returned rather than performed: this is a cross-origin fetch from the
        // editor, and fetch follows redirects transparently — a 302 here would
        // become a CORS request against the client's loopback callback server,
        // which fails after the code has already been issued.
        return { redirect_to: redirectTo }
      } catch (error) {
        return sendOAuthError(fastify, reply, error, 'Failed to record consent decision')
      }
    },
  )

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
    async (_request, reply) => {
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

        // Build verification URI from the public editor origin. This must
        // never fall back to localhost when API_URL identifies a deployed API.
        const verificationUri = `${editorBase()}/device`

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

  // POST /oauth/approve - Approve a device code (requires auth)
  fastify.post(
    '/approve',
    {
      preHandler: requireAuth,
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
        const user = request.user!

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
