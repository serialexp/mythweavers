/**
 * Generate a fingerprint/hash of story messages to detect changes
 * Server-side version of the fingerprint generator
 */
export function generateStoryFingerprint(messages: any[]): string {
  if (!messages || messages.length === 0) {
    return 'empty'
  }

  // Create a string representation of key message properties
  const messageStrings = messages.map((msg: any, index: number) => {
    // Include index to detect reordering
    // Include id to detect message replacement
    // Include content and instruction as the main story content
    // Include timestamp to detect edits
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
