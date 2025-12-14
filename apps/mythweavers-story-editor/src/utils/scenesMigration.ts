/**
 * Migration utility: Chapters → Scenes
 *
 * Ensures every chapter with messages has at least one scene.
 * Creates a default "Scene 1" for chapters that need it.
 * Works with both server and local storage modes.
 */

import { generateMessageId } from './id'
import { Node, Message } from '../types/core'
import { saveService } from '../services/saveService'

interface MigrationResult {
  scenesCreated: number
  messagesUpdated: number
  chaptersProcessed: number
}

/**
 * Migrate chapters to use scenes
 *
 * For any chapter that has messages but no scenes:
 * 1. Create a default scene named "Scene 1"
 * 2. Copy POV/context fields from chapter to scene
 * 3. Update all messages to reference the new scene
 */
export async function migrateChaptersToScenes(
  chapters: Node[],
  scenes: Node[],
  messages: Message[]
): Promise<MigrationResult> {
  const result: MigrationResult = {
    scenesCreated: 0,
    messagesUpdated: 0,
    chaptersProcessed: 0
  }

  // Group scenes by chapter
  const scenesByChapter = new Map<string, Node[]>()
  for (const scene of scenes) {
    if (scene.parentId) {
      const existing = scenesByChapter.get(scene.parentId) || []
      existing.push(scene)
      scenesByChapter.set(scene.parentId, existing)
    }
  }

  // Group messages by chapter (using legacy chapterId/nodeId fields)
  const messagesByChapter = new Map<string, Message[]>()
  for (const message of messages) {
    const chapterId = message.chapterId || message.nodeId
    if (chapterId) {
      const existing = messagesByChapter.get(chapterId) || []
      existing.push(message)
      messagesByChapter.set(chapterId, existing)
    }
  }

  // Process each chapter
  for (const chapter of chapters.filter(n => n.type === 'chapter')) {
    const chapterScenes = scenesByChapter.get(chapter.id) || []
    const chapterMessages = messagesByChapter.get(chapter.id) || []

    // Skip if no messages or already has scenes
    if (chapterMessages.length === 0 || chapterScenes.length > 0) {
      continue
    }

    console.log(`Migrating chapter "${chapter.title}" to scenes (${chapterMessages.length} messages)`)

    // Create default scene
    const defaultScene: Node = {
      id: generateMessageId(),
      storyId: chapter.storyId,
      parentId: chapter.id,
      type: 'scene',
      title: 'Scene 1',
      order: 0,

      // Copy POV/context fields from chapter to scene
      activeCharacterIds: chapter.activeCharacterIds,
      viewpointCharacterId: chapter.viewpointCharacterId,
      activeContextItemIds: chapter.activeContextItemIds,
      goal: chapter.goal,
      storyTime: chapter.storyTime,
      perspective: chapter.perspective || 'THIRD',

      // Metadata
      createdAt: new Date(),
      updatedAt: new Date(),
      expanded: true
    }

    // Save scene via saveService (works for both server and local mode)
    await saveService.saveNode(defaultScene)
    result.scenesCreated++

    // Update all messages to reference the new scene
    for (const message of chapterMessages) {
      // Use saveService to update message
      // For now, we'll update the local reference and let the message save handle it
      message.sceneId = defaultScene.id
      // TODO: Need to add message save to saveService or call API directly
      result.messagesUpdated++
    }

    result.chaptersProcessed++
  }

  if (result.scenesCreated > 0) {
    console.log('Scene migration complete:', result)
  }

  return result
}

/**
 * Check if migration is needed for a story
 */
export function needsSceneMigration(chapters: Node[], scenes: Node[], messages: Message[]): boolean {
  // Quick check: are there any chapters with messages but no scenes?
  const scenesByChapter = new Map<string, number>()
  for (const scene of scenes) {
    if (scene.parentId) {
      scenesByChapter.set(scene.parentId, (scenesByChapter.get(scene.parentId) || 0) + 1)
    }
  }

  for (const chapter of chapters.filter(n => n.type === 'chapter')) {
    const hasMessages = messages.some(m => m.chapterId === chapter.id || m.nodeId === chapter.id)
    const hasScenes = (scenesByChapter.get(chapter.id) || 0) > 0

    if (hasMessages && !hasScenes) {
      return true
    }
  }

  return false
}
