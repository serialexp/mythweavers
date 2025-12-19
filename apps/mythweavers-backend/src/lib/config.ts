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
} as const
