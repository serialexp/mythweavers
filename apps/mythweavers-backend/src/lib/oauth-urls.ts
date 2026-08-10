/**
 * Canonical URLs for the OAuth authorization server and the MCP resource.
 *
 * Every value here is computed **per call**, never captured at module load.
 * `tests/helpers.ts` caches a single Fastify instance for the whole suite, and
 * `src/lib/cors.ts` already demonstrates the failure mode of the other choice:
 * its allowlist is frozen at import, so env changes after the first import are
 * invisible. Discovery documents must reflect the environment they are served
 * in, so these stay as functions.
 */

/**
 * Origin the API is reachable at. Everything a client sees — the issuer, the
 * resource identifier, the `resource_metadata` challenge — derives from this,
 * so a wrong value breaks discovery before a request ever reaches us.
 */
export function apiBase(): string {
  return (process.env.API_URL || `http://localhost:${process.env.PORT || 3201}`).replace(/\/+$/, '')
}

/** Origin of the story-editor, which hosts the consent screen. */
export function editorBase(): string {
  return (process.env.EDITOR_URL || 'http://localhost:3203').replace(/\/+$/, '')
}

/** OAuth issuer identifier. The AS lives at the root origin so clients never path-insert its lookup. */
export function issuer(): string {
  return apiBase()
}

/** RFC 8707 resource identifier for the MCP endpoint. */
export function mcpResourceUri(): string {
  return `${apiBase()}/mcp`
}

/**
 * RFC 9728 metadata URL for the MCP resource, in the path-insertion form
 * (well-known segment goes *before* the resource path). This exact string is
 * what the `WWW-Authenticate` challenge advertises.
 */
export function prmUrl(): string {
  return `${apiBase()}/.well-known/oauth-protected-resource/mcp`
}

/** Scopes this authorization server will issue. */
export const SCOPES = ['stories:read', 'stories:write'] as const

export const DEFAULT_SCOPE = SCOPES.join(' ')

/** Human-readable labels for the consent screen, keyed by scope. */
export const SCOPE_DESCRIPTIONS: Record<string, string> = {
  'stories:read': 'Read your stories, outlines and prose',
  'stories:write': 'Create and edit your stories, chapters and prose',
}

/**
 * Validate `API_URL` at boot rather than discovering it is wrong when a client
 * fails discovery. A trailing slash or a path component makes the resource
 * identifier mismatch what clients compute, and plaintext HTTP in production
 * means bearer tokens over the wire.
 */
export function assertOAuthUrlsSane(): void {
  const raw = process.env.API_URL
  if (!raw) return

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`API_URL is not a valid absolute URL: ${raw}`)
  }

  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`API_URL must be a bare origin with no path, query or fragment (got ${raw})`)
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error(`API_URL must use https in production (got ${raw})`)
  }
}
