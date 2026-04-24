/**
 * Royal Road publishing worker.
 *
 * This module owns the entire publish lifecycle. The HTTP routes in
 * `routes/my/royal-road.ts` only write DB rows (account connection,
 * per-chapter link/unlink); the actual Playwright calls happen here so
 * API request latency never depends on royalroad.com being reachable.
 *
 * Split-process future:
 * -------------------------------------------------------------------
 * The worker is gated behind `ROYAL_ROAD_WORKER_ENABLED=true`. When the
 * split-process setup arrives, we'll flip that off on the API instance
 * and run `bun run src/workers/royal-road.ts` standalone. The module
 * exposes `runOnce()` and `startWorker()` so a thin entry-point script
 * can drive it without depending on the Fastify server.
 *
 * Claim semantics:
 * -------------------------------------------------------------------
 * Each tick we select a small batch of chapters whose parent story has
 * `royalRoadPublishingEnabled` and `publishedAt <= now`, whose
 * ChapterPublishing row is either missing, DRAFT, SCHEDULED, or FAILED
 * with `nextAttemptAt <= now`. We flip status → PUBLISHING inside a
 * transaction using `FOR UPDATE SKIP LOCKED` semantics (Prisma exposes
 * this via raw SQL; we approximate with an atomic updateMany with a
 * status precondition). Then we release the transaction and run
 * Playwright outside it, so a slow browser run doesn't hold a DB lock.
 *
 * Stuck-row recovery: rows that have been PUBLISHING for longer than
 * `PUBLISHING_STALE_MS` are reset to FAILED on the next tick so we
 * retry them instead of leaving them stranded after a crash.
 */

import type { FastifyBaseLogger } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { isSecretEncryptionAvailable } from '../lib/crypto.js'
import {
  RoyalRoadDomError,
  RoyalRoadLoginError,
  openSession,
} from '../lib/royal-road/client.js'
import { buildRoyalRoadChapterHtml } from '../lib/royal-road/serialize.js'

const TICK_INTERVAL_MS = 30 * 1000
const STARTUP_DELAY_MS = 15 * 1000
const BATCH_SIZE = 10
const PUBLISHING_STALE_MS = 10 * 60 * 1000 // 10 min — far beyond any healthy RR round-trip
const INTER_PUBLISH_DELAY_MS = 5 * 1000

const BACKOFF_SCHEDULE_MS = [
  60 * 1000, //  1 min  (first retry)
  5 * 60 * 1000, //  5 min
  30 * 60 * 1000, // 30 min
  2 * 60 * 60 * 1000, // 2 h
  12 * 60 * 60 * 1000, // 12 h  (cap)
]

function backoffFor(attempts: number): number {
  const idx = Math.min(attempts, BACKOFF_SCHEDULE_MS.length - 1)
  return BACKOFF_SCHEDULE_MS[idx]!
}

let intervalHandle: ReturnType<typeof setInterval> | null = null
let startupTimeout: ReturnType<typeof setTimeout> | null = null
let running = false

type DueRow = {
  chapterPublishingId: string | null
  chapterId: string
  chapterName: string
  storyId: string
  storyRoyalRoadId: number | null
  chapterRoyalRoadId: number | null
  userId: number
  attempts: number
}

/**
 * Mark any rows stuck in PUBLISHING past the staleness threshold back to
 * FAILED so the claim logic picks them up on the next tick.
 */
async function reapStaleRows(log: FastifyBaseLogger): Promise<void> {
  const cutoff = new Date(Date.now() - PUBLISHING_STALE_MS)
  const result = await prisma.chapterPublishing.updateMany({
    where: {
      status: 'PUBLISHING',
      updatedAt: { lte: cutoff },
      platform: 'ROYAL_ROAD',
    },
    data: {
      status: 'FAILED',
      errorMessage: 'Worker crashed or timed out while publishing (row reaped after staleness).',
      nextAttemptAt: new Date(),
    },
  })
  if (result.count > 0) {
    log.warn({ count: result.count }, 'Reaped stale PUBLISHING rows back to FAILED')
  }
}

/**
 * Select up to BATCH_SIZE rows due for publish. Returns a flat list so the
 * caller can group by user and process serially per user.
 */
async function findDueRows(): Promise<DueRow[]> {
  const now = new Date()
  // We need chapters whose story is RR-enabled and whose publishedAt <= now.
  // A chapter is eligible if:
  //   (a) no ChapterPublishing row exists for ROYAL_ROAD yet, OR
  //   (b) the row is DRAFT, SCHEDULED, or FAILED with nextAttemptAt <= now.
  // We skip PUBLISHING and PUBLISHED.
  const chapters = await prisma.chapter.findMany({
    where: {
      deleted: false,
      publishedAt: { lte: now },
      arc: {
        book: {
          story: {
            royalRoadPublishingEnabled: true,
            publishedAt: { lte: now },
          },
        },
      },
      AND: [
        {
          OR: [
            { publishingStatus: { none: { platform: 'ROYAL_ROAD' } } },
            {
              publishingStatus: {
                some: {
                  platform: 'ROYAL_ROAD',
                  status: { in: ['DRAFT', 'SCHEDULED'] },
                },
              },
            },
            {
              publishingStatus: {
                some: {
                  platform: 'ROYAL_ROAD',
                  status: 'FAILED',
                  OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
                },
              },
            },
          ],
        },
      ],
    },
    take: BATCH_SIZE,
    orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      royalRoadId: true,
      arc: {
        select: {
          book: {
            select: {
              story: {
                select: {
                  id: true,
                  ownerId: true,
                  royalRoadId: true,
                },
              },
            },
          },
        },
      },
      publishingStatus: {
        where: { platform: 'ROYAL_ROAD' },
        select: { id: true, attempts: true },
      },
    },
  })

  return chapters.map((c) => ({
    chapterPublishingId: c.publishingStatus[0]?.id ?? null,
    chapterId: c.id,
    chapterName: c.name,
    storyId: c.arc.book.story.id,
    storyRoyalRoadId: c.arc.book.story.royalRoadId,
    chapterRoyalRoadId: c.royalRoadId,
    userId: c.arc.book.story.ownerId,
    attempts: c.publishingStatus[0]?.attempts ?? 0,
  }))
}

/**
 * Atomically flip a row to PUBLISHING, creating it if absent. Returns the
 * ChapterPublishing row id on successful claim, null if someone else got
 * there first (another worker process, or a concurrent retry).
 */
async function claim(row: DueRow): Promise<string | null> {
  if (row.chapterPublishingId) {
    // Only flip if we still see an eligible status. Using updateMany lets
    // us attach a status precondition; if 0 rows are updated the claim lost.
    const result = await prisma.chapterPublishing.updateMany({
      where: {
        id: row.chapterPublishingId,
        status: { in: ['DRAFT', 'SCHEDULED', 'FAILED'] },
      },
      data: { status: 'PUBLISHING', lastAttempt: new Date() },
    })
    if (result.count === 0) return null
    return row.chapterPublishingId
  }
  // No row yet — create one in PUBLISHING. The @@unique(chapterId, platform)
  // constraint makes concurrent creations fail safely; we catch and return null.
  try {
    const created = await prisma.chapterPublishing.create({
      data: {
        chapterId: row.chapterId,
        platform: 'ROYAL_ROAD',
        status: 'PUBLISHING',
        lastAttempt: new Date(),
      },
      select: { id: true },
    })
    return created.id
  } catch {
    return null
  }
}

/**
 * Run a single publish for the given claimed row. Writes terminal status
 * (PUBLISHED or FAILED) to ChapterPublishing before returning.
 */
async function publish(
  row: DueRow,
  chapterPublishingId: string,
  log: FastifyBaseLogger,
): Promise<void> {
  let session: Awaited<ReturnType<typeof openSession>> | null = null
  try {
    session = await openSession(row.userId)
    await session.ensureLoggedIn()

    const html = await buildRoyalRoadChapterHtml(row.chapterId)
    if (!html) {
      throw new Error('Chapter has no renderable content; refusing to publish empty chapter.')
    }

    let rrChapterId: number
    if (row.chapterRoyalRoadId) {
      await session.updateChapter(row.chapterRoyalRoadId, row.chapterName, html)
      rrChapterId = row.chapterRoyalRoadId
    } else {
      if (!row.storyRoyalRoadId) {
        throw new Error(
          'Story has royalRoadPublishingEnabled=true but no Story.royalRoadId yet. ' +
            'Create the story on royalroad.com first and paste the numeric id in the story settings.',
        )
      }
      rrChapterId = await session.createChapter(row.storyRoyalRoadId, row.chapterName, html)
      // Persist the new chapter id so subsequent republishes update instead of create.
      await prisma.chapter.update({
        where: { id: row.chapterId },
        data: { royalRoadId: rrChapterId },
      })
    }

    await prisma.chapterPublishing.update({
      where: { id: chapterPublishingId },
      data: {
        status: 'PUBLISHED',
        platformId: String(rrChapterId),
        publishedAt: new Date(),
        errorMessage: null,
        attempts: 0,
        nextAttemptAt: null,
      },
    })

    log.info({ chapterId: row.chapterId, rrChapterId }, 'Published chapter to Royal Road')
  } catch (err) {
    const isLogin = err instanceof RoyalRoadLoginError
    const isDom = err instanceof RoyalRoadDomError
    const message = err instanceof Error ? err.message : String(err)
    const nextAttempts = row.attempts + 1
    await prisma.chapterPublishing.update({
      where: { id: chapterPublishingId },
      data: {
        status: 'FAILED',
        errorMessage: message.slice(0, 500),
        attempts: nextAttempts,
        nextAttemptAt: new Date(Date.now() + backoffFor(nextAttempts)),
      },
    })
    log.error(
      {
        chapterId: row.chapterId,
        userId: row.userId,
        isLogin,
        isDom,
        attempts: nextAttempts,
        err: message,
      },
      'Royal Road publish failed',
    )
  } finally {
    if (session) await session.dispose()
  }
}

/**
 * Run one tick: reap stale rows, fetch a batch, publish sequentially
 * grouped by user (so each user's Playwright context is reused if we add
 * that optimization later). Returns the number of successful publishes.
 */
export async function runOnce(log: FastifyBaseLogger): Promise<number> {
  if (!isSecretEncryptionAvailable()) {
    log.warn('ROYAL_ROAD_ENC_KEY is not set; worker cannot decrypt credentials. Skipping tick.')
    return 0
  }
  if (running) {
    log.debug('Worker tick already in progress; skipping.')
    return 0
  }
  running = true
  try {
    await reapStaleRows(log)
    const rows = await findDueRows()
    if (rows.length === 0) return 0

    // Group by user so each user's Playwright work is serialized and we
    // honour inter-publish delays per-user rather than globally.
    const byUser = new Map<number, DueRow[]>()
    for (const r of rows) {
      const list = byUser.get(r.userId) ?? []
      list.push(r)
      byUser.set(r.userId, list)
    }

    let successes = 0
    for (const userRows of byUser.values()) {
      for (const row of userRows) {
        const claimedId = await claim(row)
        if (!claimedId) continue
        await publish(row, claimedId, log)
        // Best-effort: if the most recent status is PUBLISHED, count it.
        const after = await prisma.chapterPublishing.findUnique({
          where: { id: claimedId },
          select: { status: true },
        })
        if (after?.status === 'PUBLISHED') successes += 1
        await new Promise((r) => setTimeout(r, INTER_PUBLISH_DELAY_MS))
      }
    }
    return successes
  } finally {
    running = false
  }
}

/**
 * Start the in-process worker loop. No-op if ROYAL_ROAD_WORKER_ENABLED is
 * not set to 'true' — deploys that run the worker as a separate process
 * should leave it off here.
 */
export function startWorker(log: FastifyBaseLogger): void {
  if (process.env.ROYAL_ROAD_WORKER_ENABLED !== 'true') {
    log.info('Royal Road worker: disabled (set ROYAL_ROAD_WORKER_ENABLED=true to enable)')
    return
  }
  if (!isSecretEncryptionAvailable()) {
    log.warn(
      'Royal Road worker: ROYAL_ROAD_ENC_KEY is not configured. Worker will start but every tick will skip.',
    )
  }
  log.info(
    { intervalMs: TICK_INTERVAL_MS, batchSize: BATCH_SIZE },
    'Royal Road worker: starting',
  )
  startupTimeout = setTimeout(() => {
    runOnce(log).catch((err) => log.error({ err }, 'Royal Road worker tick threw'))
    intervalHandle = setInterval(() => {
      runOnce(log).catch((err) => log.error({ err }, 'Royal Road worker tick threw'))
    }, TICK_INTERVAL_MS)
  }, STARTUP_DELAY_MS)
}

export function stopWorker(): void {
  if (startupTimeout) {
    clearTimeout(startupTimeout)
    startupTimeout = null
  }
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}
