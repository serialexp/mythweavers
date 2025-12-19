import { createId } from '@paralleldrive/cuid2'

export function generateMessageId(): string {
  return createId()
}
