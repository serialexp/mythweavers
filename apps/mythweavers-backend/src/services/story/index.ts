/**
 * Story service layer.
 *
 * These functions are the single implementation behind two transports: the
 * REST routes under /my, and the MCP tools under /mcp. Anything either one can
 * do lives here, so the two can't drift.
 */

export * from './content.js'
export * from './entities.js'
export * from './errors.js'
export * from './nodes.js'
export * from './outline.js'
export * from './prose.js'
export * from './resolve.js'
export * from './search.js'

import { ContentTooLargeError } from './content.js'
import { StoryServiceError } from './errors.js'

/**
 * Both service error types carry `statusCode`, which Fastify's error handler
 * already turns into the right status and `{ error: message }` body — so REST
 * routes let them propagate rather than catching. The MCP layer has no such
 * handler, and uses this to decide whether an error is a usable message for
 * the model or a genuine bug that should surface as one.
 */
export function isExpectedServiceError(error: unknown): error is StoryServiceError | ContentTooLargeError {
  return error instanceof StoryServiceError || error instanceof ContentTooLargeError
}
