import { apiClient } from './apiClient';
import { currentStoryStore } from '../stores/currentStoryStore';

export async function saveMessageVersion(
  messageId: string,
  content: string,
  instruction?: string | null,
  model?: string | null,
  versionType: 'regeneration' | 'edit' | 'cli_edit' = 'regeneration'
) {
  const storyId = currentStoryStore.id;
  if (!storyId) {
    console.error('No story ID available for saving message version');
    return;
  }

  try {
    // The backend endpoint handles the version creation
    // We just need to save the current state before it's modified
    await apiClient.fetch(`/messages/${storyId}/${messageId}/save-version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
      versionType,
      content,
      instruction,
      model,
      })
    });
  } catch (error) {
    console.error('Failed to save message version:', error);
    // Don't throw - we don't want to block the operation if versioning fails
  }
}
