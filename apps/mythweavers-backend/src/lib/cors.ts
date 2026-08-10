import type { FastifyCorsOptionsDelegateCallback } from '@fastify/cors'

const DEFAULT_ALLOWED_ORIGINS = [
  'https://mythweavers.io',
  'https://www.mythweavers.io',
  'https://write.mythweavers.io',
  'https://admin.mythweavers.io',
  'http://localhost:3200',
  'http://localhost:3202',
  'http://localhost:3203',
  'http://localhost:3204',
]

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function withDefaultScheme(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

export function getAllowedOrigins(): ReadonlySet<string> {
  const configured = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (configured?.includes('*')) {
    throw new Error('CORS_ORIGIN cannot contain "*" while credentialed requests are enabled')
  }

  const candidates = configured?.length
    ? configured
    : [...DEFAULT_ALLOWED_ORIGINS, ...(process.env.EDITOR_URL ? [process.env.EDITOR_URL] : [])]

  return new Set(
    candidates
      .map(withDefaultScheme)
      .map(normalizeOrigin)
      .filter((origin): origin is string => origin !== null),
  )
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  const normalized = normalizeOrigin(origin)
  return normalized !== null && allowedOrigins.has(normalized)
}

const allowedOrigins = getAllowedOrigins()

/**
 * Paths reachable from any browser origin.
 *
 * OAuth discovery, registration and token exchange have to work for clients we
 * have never met — a web-hosted MCP client on some other origin must be able to
 * read the metadata documents and complete a token request. Same for /mcp
 * itself. None of these use cookies, so opening them costs nothing: they are
 * served without credentials, and every cookie-authenticated route keeps the
 * existing allowlist untouched.
 */
const PUBLIC_CORS_PATHS = [
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-authorization-server',
  '/.well-known/openid-configuration',
  '/oauth/authorize',
  '/oauth/token',
  '/oauth/register',
  '/oauth/revoke',
  '/authorize',
  '/token',
  '/register',
  '/revoke',
  '/mcp',
]

export function isPublicCorsPath(pathname: string): boolean {
  return PUBLIC_CORS_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

/**
 * `WWW-Authenticate` is the load-bearing one: without it in the exposed list, a
 * browser client's `response.headers.get('WWW-Authenticate')` returns null, so
 * it never finds the `resource_metadata` URL and OAuth discovery silently never
 * starts. That failure looks identical to "the server just doesn't support it".
 */
const EXPOSED_HEADERS = ['Content-Disposition', 'WWW-Authenticate', 'Mcp-Session-Id']

/**
 * Per-request CORS policy.
 *
 * Registered as `@fastify/cors`'s `delegator` rather than as a second scoped
 * plugin: the root instance terminates OPTIONS preflights in its own onRequest
 * hook, so an encapsulated inner instance would never run.
 *
 * Note `allowedHeaders` is deliberately left unset. When it is null the plugin
 * reflects `Access-Control-Request-Headers` verbatim, which is what lets
 * `MCP-Protocol-Version` through — a header the MCP SDK sends on every
 * discovery request. Pinning a static list breaks clients not yet written.
 */
export const corsDelegator: FastifyCorsOptionsDelegateCallback = (req, cb) => {
  if (isAllowedOrigin(req.headers.origin)) {
    cb(null, { origin: true, credentials: true, exposedHeaders: EXPOSED_HEADERS, maxAge: 600 })
    return
  }

  // Match on the raw URL, not `request.routeOptions.url`: preflights are routed
  // through a wildcard handler where that is '*', so the carve-out would never
  // fire for exactly the requests that need it.
  const pathname = req.url.split('?')[0]
  if (isPublicCorsPath(pathname)) {
    cb(null, {
      origin: '*',
      credentials: false,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      exposedHeaders: EXPOSED_HEADERS,
      maxAge: 600,
    })
    return
  }

  cb(null, { origin: false })
}
