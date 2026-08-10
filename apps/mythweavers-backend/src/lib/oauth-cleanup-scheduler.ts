/**
 * Periodic pruning of OAuth and device-flow rows.
 *
 * Two of these sweeps matter beyond tidiness:
 *
 * - `OAuthClient` is created by *unauthenticated* dynamic registration. Nothing
 *   cascades it (no user FK), so without the never-used sweep the table grows
 *   without bound for anyone who can reach the endpoint. A client that never
 *   completed a token exchange within a day was never real.
 * - `DeviceCode` rows were already leaking before this change: they are only
 *   deleted on successful redemption, so every abandoned CLI login left one
 *   behind forever.
 */

import type { FastifyBaseLogger } from 'fastify'
import { prisma } from './prisma.js'

const SWEEP_INTERVAL_MS = 15 * 60 * 1000
const STARTUP_DELAY_MS = 30 * 1000

const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * ONE_HOUR_MS
const THIRTY_DAYS_MS = 30 * ONE_DAY_MS

let intervalHandle: ReturnType<typeof setInterval> | null = null
let startupTimeout: ReturnType<typeof setTimeout> | null = null

export async function runOAuthCleanup(log: FastifyBaseLogger): Promise<void> {
  const now = Date.now()

  try {
    const [authorizationRequests, deviceCodes, accessTokens, refreshTokens] = await prisma.$transaction([
      // Keep answered requests around briefly so a replayed code still finds its
      // row and can revoke the family it produced.
      prisma.oAuthAuthorizationRequest.deleteMany({
        where: { expiresAt: { lt: new Date(now - ONE_HOUR_MS) } },
      }),
      prisma.deviceCode.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
      prisma.accessToken.deleteMany({ where: { expiresAt: { lt: new Date(now - ONE_DAY_MS) } } }),
      prisma.oAuthRefreshToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: new Date(now) } }, { revokedAt: { lt: new Date(now - THIRTY_DAYS_MS) } }],
        },
      }),
    ])

    // Separate from the transaction above: this one needs relation filters and
    // is the defence against open registration filling the table.
    const clients = await prisma.oAuthClient.deleteMany({
      where: {
        lastUsedAt: null,
        createdAt: { lt: new Date(now - ONE_DAY_MS) },
        refreshTokens: { none: {} },
        authorizationRequests: { none: {} },
      },
    })

    const total =
      authorizationRequests.count + deviceCodes.count + accessTokens.count + refreshTokens.count + clients.count
    if (total > 0) {
      log.info(
        {
          authorizationRequests: authorizationRequests.count,
          deviceCodes: deviceCodes.count,
          accessTokens: accessTokens.count,
          refreshTokens: refreshTokens.count,
          clients: clients.count,
        },
        'OAuth cleanup: pruned expired rows',
      )
    }
  } catch (error) {
    log.error({ err: error }, 'OAuth cleanup: sweep failed')
  }
}

export function startOAuthCleanupScheduler(log: FastifyBaseLogger): void {
  log.info('OAuth cleanup scheduler: starting (interval: 15 minutes)')

  startupTimeout = setTimeout(async () => {
    await runOAuthCleanup(log)
    intervalHandle = setInterval(() => {
      void runOAuthCleanup(log)
    }, SWEEP_INTERVAL_MS)
  }, STARTUP_DELAY_MS)
}

export function stopOAuthCleanupScheduler(): void {
  if (startupTimeout) {
    clearTimeout(startupTimeout)
    startupTimeout = null
  }
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}
