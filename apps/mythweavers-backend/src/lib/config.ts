/**
 * Centralized configuration for the unified backend
 */

/**
 * Authentication configuration
 */
export const authConfig = {
  /**
   * Session duration in milliseconds (3 days)
   */
  sessionDuration: 3 * 24 * 60 * 60 * 1000,

  /**
   * Cookie refresh threshold - refresh cookie when less than this much time remains
   * (6 hours = 1/12 of the 3-day duration)
   */
  cookieRefreshThreshold: 6 * 60 * 60 * 1000,

  /**
   * Cookie domain - set to root domain (e.g., '.mythweavers.io') to share across subdomains
   * Leave undefined for single-domain setups
   */
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
} as const

/**
 * Get standard cookie options for session cookies
 */
export const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: authConfig.sessionDuration / 1000,
  path: '/',
  domain: authConfig.cookieDomain,
})
