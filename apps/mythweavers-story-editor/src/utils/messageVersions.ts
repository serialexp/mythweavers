/**
 * Save message version before regeneration.
 *
 * Note: In the new backend architecture, versioning is handled via MessageRevisions.
 * Calling the regenerate endpoint creates a new revision, preserving the old content.
 * This function is kept for API compatibility but the actual version creation
 * happens when content is regenerated via the normal flow.
 *
 * @deprecated The new backend handles versioning automatically through MessageRevisions.
 * This function now just logs that versioning will happen during regeneration.
 */
export async function saveMessageVersion(
  messageId: string,
  _content: string,
  _instruction?: string | null,
  _model?: string | null,
  _versionType: 'regeneration' | 'edit' | 'cli_edit' = 'regeneration',
) {
  // In the new backend architecture, versioning is handled by the MessageRevision system.
  // When content is regenerated, a new MessageRevision is created automatically,
  // preserving the old content in the previous revision.
  //
  // This function is now a no-op. The actual versioning happens when:
  // 1. POST /my/messages/:id/regenerate is called (creates new revision)
  // 2. Paragraphs are updated with new content
  //
  // The old revision's content remains in the database for history.
  console.log(`[MessageVersions] Version will be preserved for message ${messageId} via MessageRevision system`)
}
