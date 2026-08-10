/**
 * Connected apps.
 *
 * Lists one row per *connection*, not per access token. Access tokens now live
 * an hour and rotate, so a raw token list would fill with noise and a live
 * connection would appear to vanish between refreshes. The durable identity of
 * an OAuth connection is its refresh-token family, so that is what is listed —
 * alongside the older, family-less tokens the device flow mints.
 */

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'
import { revokeFamily } from '../../services/oauth/tokens.js'

const connectionSchema = z.strictObject({
  id: z.string().meta({
    description: 'Opaque connection id. Pass to DELETE to revoke.',
    example: 'clx1234567890',
  }),
  kind: z.enum(['oauth', 'token']).meta({
    description: '"oauth" for a browser-authorized client, "token" for a device-flow or manual token',
    example: 'oauth',
  }),
  name: z.string().meta({
    description: 'Client name, as the client registered itself',
    example: 'Claude Code',
  }),
  clientId: z.string().nullable().meta({ description: 'OAuth client_id, when there is one' }),
  scope: z.string().nullable().meta({ description: 'Space-delimited granted scopes' }),
  resource: z.string().nullable().meta({ description: 'RFC 8707 audience this connection is bound to' }),
  createdAt: z.string().meta({ example: '2026-08-10T12:00:00.000Z' }),
  lastUsed: z.string().nullable().meta({ description: 'When an access token from this connection was last used' }),
  expiresAt: z.string().nullable().meta({ description: 'When the connection lapses if unused' }),
})

const listConnectionsResponseSchema = z.strictObject({
  connections: z.array(connectionSchema),
})

const connectionIdParamSchema = z.strictObject({
  id: z.string().meta({ description: 'Connection id from GET /my/access-tokens' }),
})

const revokeResponseSchema = z.strictObject({
  success: z.literal(true),
})

const myAccessTokensRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', requireAuth)

  // GET /my/access-tokens - List connected apps and standalone tokens
  fastify.get(
    '/access-tokens',
    {
      schema: {
        description: 'List apps connected to your account, and any standalone access tokens',
        tags: ['my-access-tokens'],
        security: [{ sessionAuth: [] }],
        response: {
          200: listConnectionsResponseSchema,
          401: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request) => {
      const userId = request.user!.id
      const now = new Date()

      // The head of each family: not revoked, not yet rotated away, not expired.
      const families = await prisma.oAuthRefreshToken.findMany({
        where: { userId, revokedAt: null, replacedById: null, expiresAt: { gt: now } },
        include: { client: true },
        orderBy: { createdAt: 'desc' },
      })

      // Last use is recorded on access tokens, so read it from the family's most
      // recently used one rather than from the refresh token.
      const familyIds = families.map((family) => family.familyId)
      const lastUsedByFamily = new Map<string, Date>()
      if (familyIds.length > 0) {
        const grouped = await prisma.accessToken.groupBy({
          by: ['familyId'],
          where: { familyId: { in: familyIds } },
          _max: { lastUsed: true },
        })
        for (const row of grouped) {
          if (row.familyId && row._max.lastUsed) lastUsedByFamily.set(row.familyId, row._max.lastUsed)
        }
      }

      const standalone = await prisma.accessToken.findMany({
        where: { userId, familyId: null },
        orderBy: { createdAt: 'desc' },
      })

      return {
        connections: [
          ...families.map((family) => ({
            id: family.familyId,
            kind: 'oauth' as const,
            name: family.client.clientName,
            clientId: family.clientId,
            scope: family.scope,
            resource: family.resource,
            createdAt: family.createdAt.toISOString(),
            lastUsed: lastUsedByFamily.get(family.familyId)?.toISOString() ?? null,
            expiresAt: family.expiresAt.toISOString(),
          })),
          ...standalone.map((token) => ({
            id: token.id,
            kind: 'token' as const,
            name: token.name,
            clientId: token.clientId,
            scope: token.scope,
            resource: token.resource,
            createdAt: token.createdAt.toISOString(),
            lastUsed: token.lastUsed?.toISOString() ?? null,
            expiresAt: token.expiresAt?.toISOString() ?? null,
          })),
        ],
      }
    },
  )

  // DELETE /my/access-tokens/:id - Revoke a connection
  fastify.delete(
    '/access-tokens/:id',
    {
      schema: {
        description: 'Revoke a connected app or a standalone access token',
        tags: ['my-access-tokens'],
        security: [{ sessionAuth: [] }],
        params: connectionIdParamSchema,
        response: {
          200: revokeResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const { id } = request.params

      // Ownership is checked by scoping the lookup to userId, so one user can
      // never revoke another's connection by guessing an id.
      const family = await prisma.oAuthRefreshToken.findFirst({ where: { familyId: id, userId } })
      if (family) {
        await revokeFamily(id)
        fastify.log.info({ familyId: id, userId }, 'OAuth connection revoked')
        return { success: true as const }
      }

      const token = await prisma.accessToken.findFirst({ where: { id, userId } })
      if (!token) {
        return reply.status(404).send({ error: 'Connection not found' })
      }

      await prisma.accessToken.delete({ where: { id: token.id } })
      fastify.log.info({ tokenId: id, userId }, 'Access token revoked')
      return { success: true as const }
    },
  )
}

export default myAccessTokensRoutes
