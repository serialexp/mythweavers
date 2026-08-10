/**
 * OAuth client registration (RFC 7591) and redirect-URI matching (RFC 8252).
 *
 * Registration is open — that is the whole point, it is what lets an MCP client
 * enrol itself the first time a user runs `claude mcp add`. Nothing an
 * unauthenticated caller can create here is useful without a real user
 * completing consent in a browser, and `oauth-cleanup-scheduler.ts` prunes
 * clients that never got that far.
 */

import { randomBytes } from 'node:crypto'
import type { OAuthClient, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { oauthError } from './errors.js'

const MAX_REDIRECT_URIS = 10
const MAX_URI_LENGTH = 2048

/**
 * RFC 8252 §7.3: a native app's loopback redirect is compared ignoring the
 * port, because the app binds an ephemeral port at runtime. Claude Code does
 * exactly this — a fresh port every invocation — so exact matching would work
 * once and then fail forever with a 400 the user cannot interpret.
 */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', '::1', 'localhost'])

export function generateClientId(): string {
  return `mwc_${randomBytes(16).toString('hex')}`
}

function isLoopbackUrl(url: URL): boolean {
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)
}

/** True when `candidate` is an acceptable presentation of a registered redirect URI. */
export function redirectUriMatches(candidate: string, registered: string): boolean {
  // Non-loopback: byte-exact, per OAuth 2.1 §4.1.3. Web clients such as
  // claude.ai register a fixed https callback and always send it back verbatim,
  // so nothing looser is needed — or safe.
  if (candidate === registered) return true

  let a: URL
  let b: URL
  try {
    a = new URL(candidate)
    b = new URL(registered)
  } catch {
    return false
  }

  if (!isLoopbackUrl(a) || !isLoopbackUrl(b)) return false
  // `localhost` and `127.0.0.1` are deliberately NOT unified: they are distinct
  // security origins in browsers, and a client that registered one should not
  // be able to receive a code at the other.
  if (a.hostname !== b.hostname) return false
  return a.pathname === b.pathname && a.search === b.search
}

/** Find the registered redirect URI that `candidate` matches, if any. */
export function resolveRedirectUri(client: OAuthClient, candidate: string | undefined): string {
  if (!candidate) {
    // RFC 6749 §3.1.2.3 permits omission only when exactly one is registered.
    if (client.redirectUris.length === 1) return client.redirectUris[0]
    throw oauthError('invalid_request', 'redirect_uri is required when a client registers more than one')
  }

  const matched = client.redirectUris.find((registered) => redirectUriMatches(candidate, registered))
  if (!matched) {
    throw oauthError('invalid_request', 'redirect_uri is not registered for this client')
  }
  // Return what the client actually asked for, not the registered template —
  // the ephemeral loopback port lives in the candidate and the code must come
  // back to the port the client is listening on.
  return candidate
}

function validateRedirectUri(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URI_LENGTH) {
    throw oauthError('invalid_redirect_uri', 'Each redirect_uri must be a non-empty absolute URL')
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw oauthError('invalid_redirect_uri', `Not an absolute URL: ${value}`)
  }

  if (url.hash) {
    throw oauthError('invalid_redirect_uri', `redirect_uri must not contain a fragment: ${value}`)
  }
  if (url.protocol !== 'https:' && !isLoopbackUrl(url)) {
    throw oauthError(
      'invalid_redirect_uri',
      `redirect_uri must use https, or http with a loopback host (127.0.0.1, ::1, localhost): ${value}`,
    )
  }

  return value
}

export interface RegisterClientInput {
  redirect_uris?: unknown
  client_name?: unknown
  client_uri?: unknown
  logo_uri?: unknown
  scope?: unknown
  grant_types?: unknown
  response_types?: unknown
  token_endpoint_auth_method?: unknown
  software_id?: unknown
  software_version?: unknown
  [key: string]: unknown
}

function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') {
    throw oauthError('invalid_client_metadata', `${field} must be a string`)
  }
  return value
}

function stringArray(value: unknown, field: string, fallback: string[]): string[] {
  if (value === undefined || value === null) return fallback
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw oauthError('invalid_client_metadata', `${field} must be an array of strings`)
  }
  return value as string[]
}

/** RFC 7591 dynamic client registration. Always produces a public client — no secret is issued. */
export async function registerClient(input: RegisterClientInput): Promise<OAuthClient> {
  if (!Array.isArray(input.redirect_uris) || input.redirect_uris.length === 0) {
    throw oauthError('invalid_redirect_uri', 'redirect_uris is required and must contain at least one URL')
  }
  if (input.redirect_uris.length > MAX_REDIRECT_URIS) {
    throw oauthError('invalid_redirect_uri', `At most ${MAX_REDIRECT_URIS} redirect_uris may be registered`)
  }

  const redirectUris = input.redirect_uris.map(validateRedirectUri)

  const authMethod = optionalString(input.token_endpoint_auth_method, 'token_endpoint_auth_method') ?? 'none'
  if (authMethod !== 'none') {
    throw oauthError(
      'invalid_client_metadata',
      'Only public clients are supported; token_endpoint_auth_method must be "none"',
    )
  }

  const grantTypes = stringArray(input.grant_types, 'grant_types', ['authorization_code', 'refresh_token'])
  const unsupported = grantTypes.filter((grant) => grant !== 'authorization_code' && grant !== 'refresh_token')
  if (unsupported.length > 0) {
    throw oauthError('invalid_client_metadata', `Unsupported grant_types: ${unsupported.join(', ')}`)
  }

  const responseTypes = stringArray(input.response_types, 'response_types', ['code'])
  if (responseTypes.some((type) => type !== 'code')) {
    throw oauthError('invalid_client_metadata', 'Only the "code" response_type is supported')
  }

  return prisma.oAuthClient.create({
    data: {
      clientId: generateClientId(),
      clientName: optionalString(input.client_name, 'client_name') ?? 'Unnamed MCP client',
      redirectUris,
      grantTypes,
      responseTypes,
      tokenEndpointAuthMethod: authMethod,
      scope: optionalString(input.scope, 'scope'),
      clientUri: optionalString(input.client_uri, 'client_uri'),
      logoUri: optionalString(input.logo_uri, 'logo_uri'),
      softwareId: optionalString(input.software_id, 'software_id'),
      softwareVersion: optionalString(input.software_version, 'software_version'),
      metadata: input as Prisma.InputJsonValue,
    },
  })
}

export interface ClientRegistrationResponse {
  [key: string]: unknown
  client_id: string
  client_id_issued_at: number
  client_name: string
  redirect_uris: string[]
  grant_types: string[]
  response_types: string[]
  token_endpoint_auth_method: string
}

/** The RFC 7591 registration response: submitted metadata echoed back, plus the assigned identifiers. */
export function clientRegistrationResponse(client: OAuthClient): ClientRegistrationResponse {
  const submitted = (client.metadata ?? {}) as Record<string, unknown>
  return {
    ...submitted,
    client_id: client.clientId,
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    client_name: client.clientName,
    redirect_uris: client.redirectUris,
    grant_types: client.grantTypes,
    response_types: client.responseTypes,
    token_endpoint_auth_method: client.tokenEndpointAuthMethod,
  }
}

export async function requireClient(clientId: string | undefined): Promise<OAuthClient> {
  if (!clientId) {
    throw oauthError('invalid_client', 'client_id is required', 401)
  }
  const client = await prisma.oAuthClient.findUnique({ where: { clientId } })
  if (!client) {
    throw oauthError('invalid_client', 'Unknown client_id', 401)
  }
  return client
}
