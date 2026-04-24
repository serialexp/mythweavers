/**
 * Standalone entry point for the Royal Road publishing worker.
 *
 * Run with:
 *   ROYAL_ROAD_WORKER_ENABLED=true bun run src/workers/royal-road-standalone.ts
 *
 * Used when the worker is scaled out to its own process/container (so the
 * API instance doesn't carry the Playwright blast radius). The Fastify
 * server should then start with ROYAL_ROAD_WORKER_ENABLED=false to avoid
 * running the loop twice.
 *
 * We intentionally avoid the Fastify/pino stack here — the worker doesn't
 * need an HTTP server and we want the entry-point to stay minimal. The
 * logger below is a thin shim that matches the subset of FastifyBaseLogger
 * surface the worker actually calls (`info`, `warn`, `error`, `debug`).
 */

import type { FastifyBaseLogger } from 'fastify'
import { runOnce, startWorker, stopWorker } from './royal-road.js'

// Force-enable the worker regardless of ROYAL_ROAD_WORKER_ENABLED when run
// standalone — the env flag is there to gate the in-process variant, not
// the dedicated process.
if (process.env.ROYAL_ROAD_WORKER_ENABLED !== 'true') {
  process.env.ROYAL_ROAD_WORKER_ENABLED = 'true'
}

function fmt(obj: unknown, msg?: string): string {
  if (typeof obj === 'string' && msg === undefined) return obj
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj)
  return msg ? `${msg} ${body}` : body
}

/**
 * Minimal FastifyBaseLogger-compatible console shim. Only the handful of
 * methods the worker calls are implemented with real bodies; the rest are
 * no-op pass-throughs so the type-cast below is safe in practice.
 */
const log = {
  info: (obj: unknown, msg?: string) => console.log(`[info] ${fmt(obj, msg)}`),
  warn: (obj: unknown, msg?: string) => console.warn(`[warn] ${fmt(obj, msg)}`),
  error: (obj: unknown, msg?: string) => console.error(`[error] ${fmt(obj, msg)}`),
  debug: (obj: unknown, msg?: string) => {
    if (process.env.LOG_LEVEL === 'debug') console.debug(`[debug] ${fmt(obj, msg)}`)
  },
  // The worker only uses the four methods above; the rest exist so the
  // `as unknown as FastifyBaseLogger` cast below doesn't hide typos.
  fatal: (obj: unknown, msg?: string) => console.error(`[fatal] ${fmt(obj, msg)}`),
  trace: () => {},
  child: () => log,
  level: 'info',
  silent: () => {},
}

const logger = log as unknown as FastifyBaseLogger

startWorker(logger)

// Best-effort initial tick so we don't idle for STARTUP_DELAY_MS on boot.
runOnce(logger).catch((err) => logger.error({ err }, 'Royal Road worker: initial tick threw'))

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'Stopping worker')
    stopWorker()
    process.exit(0)
  })
}
