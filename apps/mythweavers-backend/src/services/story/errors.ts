/**
 * Typed errors for the story service layer.
 *
 * These services are consumed by two very different callers: Fastify route
 * handlers (which need an HTTP status) and MCP tool handlers (which need a
 * message the model can act on). Carrying the status on the error lets both
 * translate without the services knowing about either transport.
 *
 * The field is named `statusCode` because that is what Fastify's error handler
 * reads (`error.statusCode || 500`, src/index.ts and tests/helpers.ts). Route
 * handlers can therefore let these propagate instead of catching and
 * re-sending them.
 */

export class StoryServiceError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'StoryServiceError'
    this.statusCode = statusCode
  }
}

/**
 * Ownership failures use 404, not 403 — this matches the convention used
 * throughout the existing routes (see routes/my/stories.ts, which returns
 * "Story not found" when ownerId !== userId) and avoids leaking the existence
 * of other users' content.
 */
export const notFound = (message: string) => new StoryServiceError(message, 404)
export const badRequest = (message: string) => new StoryServiceError(message, 400)
export const conflict = (message: string) => new StoryServiceError(message, 409)

export function isStoryServiceError(error: unknown): error is StoryServiceError {
  return error instanceof StoryServiceError
}
