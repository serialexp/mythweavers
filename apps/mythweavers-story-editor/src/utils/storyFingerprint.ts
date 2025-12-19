import { Message } from '../types/core'

/**
 * Generate a fingerprint/hash of story messages to detect changes
 * Uses a simple hash function that's fast and good enough for change detection
 */
export function generateStoryFingerprint(messages: Message[]): string {
  if (!messages || messages.length === 0) {
    return 'empty'
  }

  // Create a string representation of key message properties
  // We focus on content, instruction, and order - the things that matter for story equality
  const messageStrings = messages.map((msg, index) => {
    // Include index to detect reordering
    // Include id to detect message replacement
    // Include content and instruction as the main story content
    // Include timestamp to detect edits (timestamp changes when edited)
    const timestamp = msg.timestamp instanceof Date ? msg.timestamp.getTime() : new Date(msg.timestamp).getTime()

    return `${index}:${msg.id}:${msg.content}:${msg.instruction || ''}:${timestamp}`
  })

  const combined = messageStrings.join('|')

  // Simple hash function - good enough for detecting differences
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }

  // Convert to hex string for easier comparison
  return hash.toString(16)
}

/**
 * Compare two sets of messages to see if they're effectively the same
 */
export function areMessagesEqual(messages1: Message[], messages2: Message[]): boolean {
  // Quick checks first
  if (messages1.length !== messages2.length) {
    return false
  }

  // Generate and compare fingerprints
  return generateStoryFingerprint(messages1) === generateStoryFingerprint(messages2)
}
