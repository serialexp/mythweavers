/**
 * Cleanup script: remove File rows whose bytes are unreachable.
 *
 * A row is "unreachable" if neither of these is true:
 *   - `localPath` is set AND the file exists on disk, OR
 *   - `r2Key` is set AND HEAD against the configured private R2 bucket
 *     succeeds. (If R2 is not configured, the r2Key path is treated as
 *     unverifiable and the row is judged on local disk presence alone.)
 *
 * Defaults to dry-run. Pass `--apply` to actually delete the rows. All File
 * relations in the schema use `onDelete: SetNull`, so deletion safely nulls
 * the FK on every Story / Book / Arc / Chapter / Scene / Message / Character
 * row that referenced the row.
 *
 * Usage:
 *   pnpm --filter @mythweavers/backend tsx scripts/cleanup-unreachable-files.ts
 *   pnpm --filter @mythweavers/backend tsx scripts/cleanup-unreachable-files.ts --apply
 */

import { promises as fs } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { existsInR2, isR2Configured } from '../src/lib/r2-storage.js'

const prisma = new PrismaClient()

type Verdict = {
  id: string
  ownerId: number
  path: string
  localPath: string | null
  r2Key: string | null
  reason: string
}

async function fileExistsOnDisk(localPath: string): Promise<boolean> {
  try {
    await fs.access(localPath)
    return true
  } catch {
    return false
  }
}

async function isReachable(file: {
  localPath: string | null
  r2Key: string | null
}): Promise<{ reachable: boolean; reason: string }> {
  if (file.localPath && (await fileExistsOnDisk(file.localPath))) {
    return { reachable: true, reason: 'local file present' }
  }
  if (file.r2Key) {
    if (!isR2Configured()) {
      // We can't verify; treat as unreachable only if there's also no local
      // path. If localPath is missing AND we can't check R2, mark unverifiable
      // — the operator should configure R2 before running with --apply, or
      // accept these rows will be dropped.
      if (!file.localPath) {
        return { reachable: false, reason: 'has r2Key but R2 not configured (cannot verify)' }
      }
      return { reachable: false, reason: 'local file missing; r2Key set but R2 not configured' }
    }
    try {
      if (await existsInR2(file.r2Key, 'private')) {
        return { reachable: true, reason: 'present in R2 (private)' }
      }
      // Try public bucket too, since visibility metadata may be wrong.
      if (await existsInR2(file.r2Key, 'public')) {
        return { reachable: true, reason: 'present in R2 (public)' }
      }
      return { reachable: false, reason: 'r2Key set but object missing in both buckets' }
    } catch (err) {
      return {
        reachable: false,
        reason: `R2 HEAD failed: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }
  if (file.localPath) {
    return { reachable: false, reason: 'localPath set but file missing on disk' }
  }
  return { reachable: false, reason: 'no localPath and no r2Key' }
}

async function main() {
  const apply = process.argv.includes('--apply')

  console.log(`R2 configured: ${isR2Configured()}`)
  console.log(`Mode: ${apply ? 'APPLY (will delete rows)' : 'dry-run (pass --apply to delete)'}`)
  console.log('')

  const files = await prisma.file.findMany({
    select: {
      id: true,
      ownerId: true,
      path: true,
      localPath: true,
      r2Key: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Scanning ${files.length} File rows...`)
  console.log('')

  const unreachable: Verdict[] = []
  let reachableCount = 0
  let scanned = 0

  for (const file of files) {
    scanned++
    if (scanned % 50 === 0) {
      process.stdout.write(`  scanned ${scanned}/${files.length}\r`)
    }
    const { reachable, reason } = await isReachable(file)
    if (reachable) {
      reachableCount++
    } else {
      unreachable.push({ ...file, reason })
    }
  }

  console.log(`  scanned ${scanned}/${files.length}`)
  console.log('')
  console.log(`Reachable:   ${reachableCount}`)
  console.log(`Unreachable: ${unreachable.length}`)
  console.log('')

  if (unreachable.length === 0) {
    console.log('Nothing to do.')
    await prisma.$disconnect()
    return
  }

  // Group by reason for the summary
  const byReason = new Map<string, Verdict[]>()
  for (const v of unreachable) {
    const existing = byReason.get(v.reason)
    if (existing) existing.push(v)
    else byReason.set(v.reason, [v])
  }

  console.log('Unreachable rows by reason:')
  for (const [reason, rows] of byReason) {
    console.log(`  [${rows.length}] ${reason}`)
  }
  console.log('')

  // Show a sample
  const sample = unreachable.slice(0, 10)
  console.log(`Sample (first ${sample.length}):`)
  for (const v of sample) {
    console.log(`  ${v.id}  owner=${v.ownerId}  path=${v.path}`)
    console.log(`    -> ${v.reason}`)
  }
  if (unreachable.length > sample.length) {
    console.log(`  ... and ${unreachable.length - sample.length} more`)
  }
  console.log('')

  if (!apply) {
    console.log('Dry-run complete. Re-run with --apply to delete these rows.')
    await prisma.$disconnect()
    return
  }

  console.log(`Deleting ${unreachable.length} rows...`)
  const ids = unreachable.map((v) => v.id)
  // Delete in chunks to keep the parameter list manageable.
  const chunkSize = 500
  let deleted = 0
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const result = await prisma.file.deleteMany({ where: { id: { in: chunk } } })
    deleted += result.count
  }
  console.log(`Deleted ${deleted} File rows. Related FKs were SetNull by Prisma.`)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
