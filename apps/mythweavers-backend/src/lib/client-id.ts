/**
 * Support for client-supplied entity IDs on create endpoints.
 *
 * The story editor creates entities optimistically: it generates a cuid2 locally,
 * puts the entity in its store, and queues the create for later. If the server
 * assigns its own ID instead, the client never learns it, and every subsequent
 * update or delete keyed on the local ID hits a row that does not exist. Accepting
 * the client's ID is what keeps the optimistic entity and the row the same thing.
 *
 * That leaves the question of what a create for an ID that already exists means.
 * It is not necessarily a bug: the editor's save queue retries failed operations by
 * pushing them back to the front (see `processQueue` in the editor's saveService),
 * so a create whose response was lost in flight legitimately arrives twice. Failing
 * the replay would strand the entity forever, so a replay inside the same parent is
 * treated as a no-op and answered with the existing row.
 *
 * The status code for a genuine collision is deliberately 400, never 409: the
 * editor's save queue treats 409 as an optimistic-concurrency conflict and drops
 * every other pending operation on the floor when it sees one.
 */

export type ClientIdOutcome<T> =
  /** No ID supplied, or nothing exists under it -- create normally. */
  | { status: 'free' }
  /** The ID already names a row under the same parent -- a retried create. */
  | { status: 'replay'; existing: T }
  /** The ID exists, but somewhere else. A client bug, or a cuid2 collision. */
  | { status: 'conflict' }

/**
 * Decide what a create carrying `id` should do.
 *
 * `inScope` answers "does the existing row belong to the parent this request is
 * creating under?" -- a landmark ID that turns up on a different map is a conflict,
 * not a replay, because answering with that row would hand the caller someone
 * else's entity.
 */
export async function resolveClientId<T>({
  id,
  find,
  inScope,
}: {
  id: string | undefined
  find: (id: string) => Promise<T | null>
  inScope: (existing: T) => boolean
}): Promise<ClientIdOutcome<T>> {
  if (!id) return { status: 'free' }

  const existing = await find(id)
  if (!existing) return { status: 'free' }

  return inScope(existing) ? { status: 'replay', existing } : { status: 'conflict' }
}

/**
 * True for Prisma's unique-constraint violation.
 *
 * `resolveClientId` closes the common case, but it is a check-then-act, so two
 * concurrent creates carrying the same ID can both find nothing and both insert.
 * The loser gets P2002, which means the same thing as a `conflict` outcome.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
}

/** The one error message for both collision paths, so clients see a single shape. */
export const CLIENT_ID_CONFLICT_MESSAGE = 'ID already in use'
