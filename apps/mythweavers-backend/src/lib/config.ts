/**
 * Centralized configuration for the unified backend
 */

/**
 * Authentication configuration
 */
export const authConfig = {
  /**
   * Default session duration in milliseconds (3 days). Used for normal logins.
   */
  sessionDuration: 3 * 24 * 60 * 60 * 1000,

  /**
   * Extended session duration in milliseconds (30 days). Used when the user
   * checks "Remember me" on the login form.
   */
  extendedSessionDuration: 30 * 24 * 60 * 60 * 1000,

  /**
   * Cookie domain - set to root domain (e.g., '.mythweavers.io') to share across subdomains
   * Leave undefined for single-domain setups
   */
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
} as const

/**
 * Get standard cookie options for session cookies. Pass `durationMs` to
 * override the cookie's maxAge — the session row's stored `durationMs`
 * should always be used so the cookie and DB expiry stay in sync.
 */
export const getCookieOptions = (durationMs: number = authConfig.sessionDuration) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: Math.floor(durationMs / 1000),
  path: '/',
  domain: authConfig.cookieDomain,
})
