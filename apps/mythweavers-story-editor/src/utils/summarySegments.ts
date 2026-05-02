import { Message, SummarySegment } from '../types/core'

/**
 * A planned segment, before its summary text is generated. Carries the IDs of
 * the messages that compose it so callers can look up content.
 */
export interface SummarySegmentPlan {
  startMessageId: string
  endMessageId: string
  /** Messages in this segment, in sortOrder. Always non-empty. */
  messages: Message[]
}

/**
 * Compute the segment plan for a scene's messages.
 *
 * A segment is a maximal contiguous run of messages (in sortOrder) such that:
 *   - the run starts at the scene's first message OR at a message that is
 *     `targetMessageId` of some branch option anywhere in the story;
 *   - the run ends at a branch message (inclusive) OR at the message just
 *     before the next segment-start OR at the last message of the scene.
 *
 * Why these rules:
 *   - Segment boundaries follow the branch graph rather than raw sortOrder,
 *     so a scene containing intra-scene branch targets gets correctly split.
 *   - Branches close a segment because everything past a branch is reached
 *     by jumping (possibly elsewhere); it has no path-independent successor
 *     within the same segment.
 *   - Branch targets open a segment because they are reachable on a path
 *     that doesn't include the messages immediately preceding them.
 *
 * `sceneMessages` is expected to be filtered to assistant/non-chapter/non-query
 * messages of a single scene, in sortOrder.
 *
 * `allBranchTargetMessageIds` is the set of every `targetMessageId` referenced
 * by any branch option anywhere in the story (callers compute this once over
 * `messagesStore.messages`). Targets that don't fall in this scene are
 * harmless — the intersection is checked here.
 */
export function planSummarySegments(
  sceneMessages: Message[],
  allBranchTargetMessageIds: ReadonlySet<string>,
): SummarySegmentPlan[] {
  if (sceneMessages.length === 0) return []

  const segments: SummarySegmentPlan[] = []
  let currentRun: Message[] = []

  const flushRun = () => {
    if (currentRun.length === 0) return
    segments.push({
      startMessageId: currentRun[0].id,
      endMessageId: currentRun[currentRun.length - 1].id,
      messages: currentRun,
    })
    currentRun = []
  }

  for (let i = 0; i < sceneMessages.length; i++) {
    const msg = sceneMessages[i]
    const isBranchTarget = allBranchTargetMessageIds.has(msg.id)
    const isBranch = msg.type === 'branch'

    // A branch target message starts a NEW segment — flush whatever's open
    // before adding it (unless this is already the first message and the
    // run is empty).
    if (isBranchTarget && currentRun.length > 0) {
      flushRun()
    }

    currentRun.push(msg)

    // A branch message closes the current segment (inclusive).
    if (isBranch) {
      flushRun()
    }
  }

  flushRun()
  return segments
}

/**
 * Walk the active branch path through a scene's messages and pick the
 * segments the path actually traverses.
 *
 * A segment is "on the path" if at least one of its messages is in
 * `activeMessageIds`. This catches segments that are entered by a branch
 * jump (their start is the branch target) and segments that fall in the
 * straight pre-branch portion (their messages are reached by linear walk).
 *
 * Returned segments are in scene sortOrder.
 *
 * If `activeMessageIds` is null, the scene has no branch context (no branch
 * choices recorded), so all segments are considered active.
 */
export function selectActiveSegments(
  segments: SummarySegment[],
  sceneMessages: Message[],
  activeMessageIds: ReadonlySet<string> | null,
): SummarySegment[] {
  if (segments.length === 0) return []
  if (!activeMessageIds) return segments

  // Build a map: messageId -> ordinal position in scene, so segment ordering
  // is stable even if the segments array was stored in any order.
  const positionByMessageId = new Map<string, number>()
  sceneMessages.forEach((msg, idx) => positionByMessageId.set(msg.id, idx))

  const segmentsWithRange = segments
    .map((seg) => {
      const startPos = positionByMessageId.get(seg.startMessageId)
      const endPos = positionByMessageId.get(seg.endMessageId)
      if (startPos === undefined || endPos === undefined) {
        // Segment references messages that no longer exist. Drop it; the
        // summary is stale and would be misleading.
        return null
      }
      return { seg, startPos, endPos }
    })
    .filter((entry): entry is { seg: SummarySegment; startPos: number; endPos: number } => entry !== null)

  // A segment is on the active path if any message in [startPos..endPos]
  // (inclusive) is in activeMessageIds.
  const onPath = segmentsWithRange.filter(({ startPos, endPos }) => {
    for (let i = startPos; i <= endPos; i++) {
      if (activeMessageIds.has(sceneMessages[i].id)) return true
    }
    return false
  })

  onPath.sort((a, b) => a.startPos - b.startPos)
  return onPath.map(({ seg }) => seg)
}

/**
 * Collect every `targetMessageId` referenced by any branch option in any
 * message in the given list. Used to feed `planSummarySegments`.
 */
export function collectBranchTargetMessageIds(messages: Message[]): Set<string> {
  const targets = new Set<string>()
  for (const msg of messages) {
    if (msg.type !== 'branch' || !msg.options) continue
    for (const opt of msg.options) {
      if (opt.targetMessageId) targets.add(opt.targetMessageId)
    }
  }
  return targets
}
