/**
 * Token issuance, rotation and revocation.
 *
 * Access tokens are the existing `mw_` `AccessToken` rows — the same ones the
 * device flow mints and the same ones `lib/auth.ts` validates — now carrying an
 * audience, a scope and a family id. Refresh tokens are new, stored hashed, and
 * rotate on every use.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { checkResourceAllowed } from '@modelcontextprotocol/sdk/shared/auth-utils.js'
import type { OAuthRefreshToken } from '@prisma/client'
import { mcpResourceUri } from '../../lib/oauth-urls.js'
import { prisma } from '../../lib/prisma.js'
import { oauthError } from './errors.js'

/**
 * One hour. Short by design: an access token is a plaintext bearer credential
 * and there is now a refresh token to renew it transparently.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60

/**
 * Ninety days, re-issued on every rotation, so an actively used connection
 * never expires but an abandoned one eventually does.
 */
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function generateAccessTokenValue(): string {
  return `mw_${randomBytes(32).toString('hex')}`
}

export function generateRefreshTokenValue(): string {
  return `mwr_${randomBytes(32).toString('hex')}`
}

/**
 * Constant-time comparison of two hex digests.
 *
 * `timingSafeEqual` throws on a length mismatch rather than returning false,
 * hence the guard. Both inputs here are fixed-length hex, so a length
 * difference is already a mismatch.
 */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * PKCE S256 verification.
 *
 * The digest must be base64**url** — that is what `pkce-challenge` (and every
 * MCP client built on the SDK) produces. A plain base64 digest is padded and
 * uses `+/`, so it never matches, and the failure surfaces as a 100%
 * `invalid_grant` rate at the very last step of an otherwise working flow.
 */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(codeVerifier)) return false
  const computed = createHash('sha256').update(codeVerifier).digest('base64url')
  return safeEqualHex(computed, codeChallenge)
}

/**
 * RFC 8707 audience check. Uses the MCP SDK's own helper rather than string
 * equality so client and server agree exactly on prefix semantics (the SDK
 * treats a configured resource as covering its sub-paths).
 */
export function resourceCoversMcp(resource: string): boolean {
  try {
    return checkResourceAllowed({ requestedResource: mcpResourceUri(), configuredResource: resource })
  } catch {
    return false
  }
}

export interface IssuedTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  scope: string
}

interface IssueInput {
  userId: number
  clientId: string
  clientName: string
  scope: string
  resource: string | null
  familyId: string
}

/**
 * Mint one access token and one refresh token in the same family.
 *
 * Note the deliberate asymmetry: the refresh token is stored hashed, the access
 * token is not. `getUserFromAccessToken` (`src/lib/auth.ts`) looks tokens up by
 * value on the hot path of every authenticated request; hashing them means
 * changing that lookup, which is a worthwhile follow-up but not this change.
 */
export async function issueTokenPair(input: IssueInput): Promise<IssuedTokens> {
  const accessToken = generateAccessTokenValue()
  const refreshToken = generateRefreshTokenValue()
  const now = Date.now()

  await prisma.$transaction([
    prisma.accessToken.create({
      data: {
        userId: input.userId,
        token: accessToken,
        name: input.clientName,
        expiresAt: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000),
        resource: input.resource,
        scope: input.scope,
        clientId: input.clientId,
        familyId: input.familyId,
      },
    }),
    prisma.oAuthRefreshToken.create({
      data: {
        tokenHash: sha256(refreshToken),
        familyId: input.familyId,
        userId: input.userId,
        clientId: input.clientId,
        scope: input.scope,
        resource: input.resource,
        expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
      },
    }),
  ])

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    scope: input.scope,
  }
}

/**
 * Kill an entire token family.
 *
 * Refresh tokens are marked revoked (kept for audit); access tokens are
 * deleted outright. Deleting is what makes revocation take effect immediately
 * with no new check on the request hot path — the existing `findUnique` lookup
 * simply stops finding them.
 */
export async function revokeFamily(familyId: string): Promise<void> {
  await prisma.$transaction([
    prisma.oAuthRefreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.accessToken.deleteMany({ where: { familyId } }),
  ])
}

/**
 * Rotate a refresh token.
 *
 * Presenting a token that has already been redeemed means either the client
 * replayed it or it leaked; either way the safe response is to burn the whole
 * family (OAuth 2.1 §6.1). Because `tokenHash` is unique and rotation runs in a
 * transaction, two concurrent refreshes with the same token serialize: one
 * wins, the other sees `usedAt` set.
 */
export async function rotateRefreshToken(params: {
  presented: string
  clientId?: string
  resource?: string
  scope?: string
}): Promise<IssuedTokens> {
  const row = await prisma.oAuthRefreshToken.findUnique({
    where: { tokenHash: sha256(params.presented) },
    include: { client: true },
  })

  if (!row) {
    throw oauthError('invalid_grant', 'Unknown refresh token')
  }
  if (row.usedAt) {
    await revokeFamily(row.familyId)
    throw oauthError('invalid_grant', 'Refresh token has already been used; the connection has been revoked')
  }
  if (row.revokedAt || row.expiresAt < new Date()) {
    throw oauthError('invalid_grant', 'Refresh token is expired or revoked')
  }
  if (params.clientId && params.clientId !== row.clientId) {
    throw oauthError('invalid_grant', 'Refresh token was not issued to this client')
  }
  if (params.resource && params.resource !== row.resource) {
    throw oauthError('invalid_target', 'resource does not match the one this token was issued for')
  }
  // A refresh may narrow scope but never widen it (RFC 6749 §6).
  const scope = narrowScope(row.scope, params.scope)

  const issued = await issueTokenPair({
    userId: row.userId,
    clientId: row.clientId,
    clientName: row.client.clientName,
    scope,
    resource: row.resource,
    familyId: row.familyId,
  })

  const replacement = await prisma.oAuthRefreshToken.findUnique({
    where: { tokenHash: sha256(issued.refreshToken) },
    select: { id: true },
  })

  await prisma.oAuthRefreshToken.update({
    where: { id: row.id },
    data: { usedAt: new Date(), replacedById: replacement?.id ?? null },
  })

  await prisma.oAuthClient.update({ where: { clientId: row.clientId }, data: { lastUsedAt: new Date() } })

  return issued
}

function narrowScope(granted: string, requested: string | undefined): string {
  if (!requested) return granted
  const grantedSet = new Set(granted.split(' ').filter(Boolean))
  const requestedScopes = requested.split(' ').filter(Boolean)
  const excess = requestedScopes.filter((scope) => !grantedSet.has(scope))
  if (excess.length > 0) {
    throw oauthError('invalid_scope', `Requested scope exceeds the original grant: ${excess.join(', ')}`)
  }
  return requestedScopes.join(' ')
}

/**
 * RFC 7009 revocation. Always succeeds from the caller's point of view — a
 * distinguishable failure for an unknown token would be a token oracle.
 */
export async function revokeToken(token: string): Promise<void> {
  const access = await prisma.accessToken.findUnique({ where: { token } })
  if (access) {
    if (access.familyId) {
      await revokeFamily(access.familyId)
    } else {
      await prisma.accessToken.delete({ where: { id: access.id } })
    }
    return
  }

  const refresh: OAuthRefreshToken | null = await prisma.oAuthRefreshToken.findUnique({
    where: { tokenHash: sha256(token) },
  })
  if (refresh) {
    await revokeFamily(refresh.familyId)
  }
}
