// @ts-ignore - cuid2 doesn't have TypeScript types
import { createId } from '@paralleldrive/cuid2'

/**
 * Generate a unique ID for messages using cuid2
 * This ensures consistency with backend ID generation
 */
export function generateMessageId(): string {
  return createId()
}
