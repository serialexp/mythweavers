/**
 * The authorization-code half of the flow: validating an `/oauth/authorize`
 * request, parking it for the consent screen, and turning a user's approval
 * into a one-time code.
 */

import { randomBytes } from 'node:crypto'
import type { OAuthAuthorizationRequest, OAuthClient } from '@prisma/client'
import { DEFAULT_SCOPE, SCOPES, mcpResourceUri } from '../../lib/oauth-urls.js'
import { prisma } from '../../lib/prisma.js'
import { requireClient, resolveRedirectUri } from './clients.js'
import { oauthError } from './errors.js'
import { type IssuedTokens, issueTokenPair, resourceCoversMcp, revokeFamily, sha256, verifyPkce } from './tokens.js'

/** How long the user has to complete the consent screen. */
const CONSENT_WINDOW_MS = 10 * 60 * 1000

/** How long an issued code stays redeemable. Short: the client redeems immediately. */
const CODE_TTL_MS = 60 * 1000

export interface AuthorizeParams {
  client_id?: string
  redirect_uri?: string
  response_type?: string
  scope?: string
  state?: string
  code_challenge?: string
  code_challenge_method?: string
  resource?: string
}

export interface AuthorizeResult {
  requestId: string
  client: OAuthClient
}

/**
 * Errors raised *after* the client and redirect URI are known can be delivered
 * back to the client by redirect. Errors raised before that must not be — a
 * redirect to an unvalidated URI is an open redirector.
 */
export class RedirectableAuthorizeError extends Error {
  constructor(
    readonly redirectUri: string,
    readonly code: string,
    readonly description: string,
    readonly state: string | undefined,
  ) {
    super(description)
    this.name = 'RedirectableAuthorizeError'
  }

  toLocation(): string {
    const url = new URL(this.redirectUri)
    url.searchParams.set('error', this.code)
    url.searchParams.set('error_description', this.description)
    if (this.state !== undefined) url.searchParams.set('state', this.state)
    return url.toString()
  }
}

function validateScope(requested: string | undefined): string {
  if (!requested) return DEFAULT_SCOPE
  const scopes = requested.split(' ').filter(Boolean)
  const unknown = scopes.filter((scope) => !(SCOPES as readonly string[]).includes(scope))
  if (unknown.length > 0) {
    throw new Error(`unknown scope: ${unknown.join(', ')}`)
  }
  return scopes.length > 0 ? scopes.join(' ') : DEFAULT_SCOPE
}

/**
 * Validate an authorize request and park it for the consent screen.
 *
 * Throws `OAuthError` for failures that must be rendered (bad client, bad
 * redirect URI) and `RedirectableAuthorizeError` for everything after, which
 * the route sends back to the client as a redirect.
 */
export async function createAuthorizationRequest(params: AuthorizeParams): Promise<AuthorizeResult> {
  // Order matters: identify the client, then pin the redirect URI, and only
  // then start reporting errors by redirect.
  const client = await requireClient(params.client_id)
  const redirectUri = resolveRedirectUri(client, params.redirect_uri)

  const fail = (code: string, description: string) =>
    new RedirectableAuthorizeError(redirectUri, code, description, params.state)

  if (params.response_type !== 'code') {
    throw fail('unsupported_response_type', 'Only response_type=code is supported')
  }
  if (!params.code_challenge) {
    throw fail('invalid_request', 'code_challenge is required (PKCE is mandatory)')
  }
  if ((params.code_challenge_method ?? 'plain') !== 'S256') {
    throw fail('invalid_request', 'code_challenge_method must be S256')
  }
  if (params.resource && !resourceCoversMcp(params.resource)) {
    throw fail('invalid_target', 'resource does not identify a resource on this server')
  }

  let scope: string
  try {
    scope = validateScope(params.scope)
  } catch (error) {
    throw fail('invalid_scope', error instanceof Error ? error.message : 'Invalid scope')
  }

  const requestId = randomBytes(32).toString('hex')
  await prisma.oAuthAuthorizationRequest.create({
    data: {
      requestId,
      clientId: client.clientId,
      redirectUri,
      state: params.state ?? null,
      scope,
      resource: params.resource ?? null,
      codeChallenge: params.code_challenge,
      codeChallengeMethod: 'S256',
      expiresAt: new Date(Date.now() + CONSENT_WINDOW_MS),
    },
  })

  return { requestId, client }
}

export interface PendingConsent {
  request: OAuthAuthorizationRequest
  client: OAuthClient
}

/** Load a consent request that is still awaiting a decision. */
export async function getPendingConsent(requestId: string): Promise<PendingConsent> {
  const request = await prisma.oAuthAuthorizationRequest.findUnique({
    where: { requestId },
    include: { client: true },
  })

  if (!request) {
    throw oauthError('invalid_request', 'Unknown authorization request', 404)
  }
  if (request.approvedAt || request.deniedAt || request.consumedAt) {
    throw oauthError('invalid_request', 'This authorization request has already been answered', 404)
  }
  if (request.expiresAt < new Date()) {
    throw oauthError('invalid_request', 'This authorization request has expired', 404)
  }

  return { request, client: request.client }
}

/**
 * Record the user's decision and return where the browser should go next.
 *
 * Deliberately returns a URL rather than performing a redirect: the consent
 * page submits with a cross-origin `fetch`, which follows redirects
 * transparently. A 302 here would make the browser issue a CORS request against
 * the client's loopback callback server, which sends no CORS headers — the
 * fetch fails, and the code is already burned. Returning JSON lets the page do
 * a real top-level navigation, which is what the client is waiting for.
 */
export async function decideConsent(
  requestId: string,
  userId: number,
  decision: 'approve' | 'deny',
): Promise<{ redirectTo: string }> {
  const { request } = await getPendingConsent(requestId)
  const url = new URL(request.redirectUri)
  if (request.state !== null) url.searchParams.set('state', request.state)

  if (decision === 'deny') {
    await prisma.oAuthAuthorizationRequest.update({
      where: { id: request.id },
      data: { deniedAt: new Date() },
    })
    url.searchParams.set('error', 'access_denied')
    url.searchParams.set('error_description', 'The user declined the request')
    return { redirectTo: url.toString() }
  }

  const code = randomBytes(32).toString('hex')
  await prisma.oAuthAuthorizationRequest.update({
    where: { id: request.id },
    data: {
      userId,
      codeHash: sha256(code),
      approvedAt: new Date(),
      codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  })

  url.searchParams.set('code', code)
  return { redirectTo: url.toString() }
}

export interface CodeExchangeParams {
  code?: string
  client_id?: string
  redirect_uri?: string
  code_verifier?: string
  resource?: string
}

/** Redeem a one-time authorization code for a token pair. */
export async function exchangeAuthorizationCode(params: CodeExchangeParams): Promise<IssuedTokens> {
  if (!params.code) {
    throw oauthError('invalid_request', 'code is required')
  }
  if (!params.code_verifier) {
    throw oauthError('invalid_request', 'code_verifier is required (PKCE is mandatory)')
  }

  const request = await prisma.oAuthAuthorizationRequest.findUnique({
    where: { codeHash: sha256(params.code) },
    include: { client: true },
  })

  if (!request) {
    throw oauthError('invalid_grant', 'Unknown or expired authorization code')
  }

  // Replay. OAuth 2.1 §4.1.3 requires revoking everything the first redemption
  // produced, because we cannot tell which party is the attacker. The family id
  // *is* the authorization request id (see below), so this hits exactly the
  // tokens that code minted and nothing else.
  if (request.consumedAt) {
    await revokeFamily(request.id)
    throw oauthError('invalid_grant', 'Authorization code has already been used')
  }

  if (!request.approvedAt || request.userId === null) {
    throw oauthError('invalid_grant', 'Authorization code was never approved')
  }
  if (!request.codeExpiresAt || request.codeExpiresAt < new Date()) {
    throw oauthError('invalid_grant', 'Authorization code has expired')
  }
  if (params.client_id && params.client_id !== request.clientId) {
    throw oauthError('invalid_grant', 'Authorization code was issued to a different client')
  }
  // Exact match here, not the loopback-tolerant rule: the port was already
  // pinned when the code was issued, so anything else is a mismatch.
  if (params.redirect_uri !== undefined && params.redirect_uri !== request.redirectUri) {
    throw oauthError('invalid_grant', 'redirect_uri does not match the authorization request')
  }
  if (params.resource && params.resource !== request.resource) {
    throw oauthError('invalid_target', 'resource does not match the authorization request')
  }
  if (!verifyPkce(params.code_verifier, request.codeChallenge)) {
    throw oauthError('invalid_grant', 'PKCE verification failed')
  }

  await prisma.oAuthAuthorizationRequest.update({
    where: { id: request.id },
    data: { consumedAt: new Date() },
  })

  const issued = await issueTokenPair({
    userId: request.userId,
    clientId: request.clientId,
    clientName: request.client.clientName,
    scope: request.scope,
    // A token minted through this flow is always audience-bound, even if the
    // client did not ask for one. Only legacy tokens stay audience-less.
    resource: request.resource ?? mcpResourceUri(),
    // The authorization request id doubles as the family id, so a replayed code
    // can revoke precisely the tokens it produced without another column.
    familyId: request.id,
  })

  await prisma.oAuthClient.update({
    where: { clientId: request.clientId },
    data: { lastUsedAt: new Date() },
  })

  return issued
}
