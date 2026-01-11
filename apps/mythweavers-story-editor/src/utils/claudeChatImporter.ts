import { postMyStories } from '../client/config'
import { saveService } from '../services/saveService'
import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { mapsStore } from '../stores/mapsStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import type { Message, Node } from '../types/core'
import type { SceneSegment } from './claudeChatImport'
import { storyManager } from './storyManager'

export interface ImportClaudeChatOptions {
  conversationName: string
  messages: Message[]
  importTarget: 'new' | 'current'
  storageMode: 'local' | 'server'
}

export interface ImportClaudeChatWithBranchesOptions {
  conversationName: string
  segments: SceneSegment[]
  branchChoices: Record<string, string>
  importTarget: 'new' | 'current'
  storageMode: 'local' | 'server'
}

export interface ImportClaudeChatResult {
  storyId: string
}

/**
 * Import a Claude chat conversation into MythWeavers.
 * Creates the story structure (book > arc > chapter > scene) and imports all messages.
 * Uses batch API for server mode to minimize network requests.
 *
 * @returns The story ID (either new or current)
 */
export async function importClaudeChat(options: ImportClaudeChatOptions): Promise<ImportClaudeChatResult> {
  const { conversationName, messages, importTarget, storageMode } = options
  const storyName = conversationName || 'Imported Claude Chat'

  // Create new story if needed
  if (importTarget === 'new') {
    if (storageMode === 'server') {
      const result = await postMyStories({
        body: {
          name: storyName,
          summary: '',
        },
      })

      if (!result.data) {
        throw new Error('Failed to create story on server')
      }

      const newStoryId = result.data.story.id

      // Initialize the story in the store BEFORE adding content
      currentStoryStore.loadStory(newStoryId, storyName, 'server')
    } else {
      // Local storage: create story client-side
      messagesStore.setMessages([])
      messagesStore.setInput('')
      charactersStore.setCharacters([])
      contextItemsStore.setContextItems([])
      nodeStore.clear()
      mapsStore.clearMaps()
      currentStoryStore.clearStory()

      currentStoryStore.newStory('local')
      currentStoryStore.setName(storyName, false)
    }
  }

  const storyId = currentStoryStore.id

  // Create full node hierarchy: book > arc > chapter > scene
  const book = nodeStore.addNode(null, 'book', storyName)
  const arc = nodeStore.addNode(book.id, 'arc', 'Part 1')
  const chapter = nodeStore.addNode(arc.id, 'chapter', 'Chapter 1')
  const scene = nodeStore.addNode(chapter.id, 'scene', 'Conversation')

  // Collect messages with scene ID
  const messagesWithScene: Message[] = []

  // Always use batch save for efficiency and consistency
  // Prepare messages for batch API
  const batchMessages = messages.map((msg, index) => ({
    id: msg.id,
    sceneId: scene.id,
    sortOrder: index,
    instruction: msg.instruction,
    content: msg.content,
  }))

  console.log('[claudeChatImporter] Batch messages before save:', {
    messageCount: batchMessages.length,
    messagesWithInstructions: batchMessages.filter(m => m.instruction).length,
    sampleMessage: batchMessages[0] ? {
      id: batchMessages[0].id,
      hasInstruction: !!batchMessages[0].instruction,
      instruction: batchMessages[0].instruction,
    } : null,
  })

  // Save all messages in one batch call
  await saveService.saveMessagesBatch(storyId, batchMessages)

  // Add messages to local store (without triggering individual saves)
  // IMPORTANT: Clear content since it's been saved as paragraphs on the server.
  // This prevents the editor from recreating paragraphs from content.
  for (const msg of messages) {
    const messageWithScene: Message = {
      ...msg,
      sceneId: scene.id,
      content: '', // Content is now stored as paragraphs on server
    }
    messagesWithScene.push(messageWithScene)
    // Use no-save version to avoid triggering saveService (already saved via batch)
    messagesStore.appendMessageNoSave(messageWithScene)
  }

  // For local storage with new story, save the complete story
  if (importTarget === 'new' && storageMode === 'local') {
    await storyManager.updateLocalStory(storyId, {
      id: storyId,
      name: storyName,
      savedAt: new Date(),
      messages: messagesWithScene,
      characters: [],
      contextItems: [],
      nodes: [book, arc, chapter, scene],
      input: '',
      storySetting: '',
      storageMode: 'local',
      person: 'third',
      tense: 'past',
    })
  }

  return { storyId }
}

/**
 * Import a Claude chat conversation with ALL branches preserved.
 * Creates separate scenes for each branch, with branch messages at fork points.
 */
export async function importClaudeChatWithBranches(
  options: ImportClaudeChatWithBranchesOptions,
): Promise<ImportClaudeChatResult> {
  const { conversationName, segments, branchChoices, importTarget, storageMode } = options
  const storyName = conversationName || 'Imported Claude Chat'

  // Create new story if needed
  if (importTarget === 'new') {
    if (storageMode === 'server') {
      const result = await postMyStories({
        body: {
          name: storyName,
          summary: '',
        },
      })

      if (!result.data) {
        throw new Error('Failed to create story on server')
      }

      const newStoryId = result.data.story.id
      currentStoryStore.loadStory(newStoryId, storyName, 'server')
    } else {
      messagesStore.setMessages([])
      messagesStore.setInput('')
      charactersStore.setCharacters([])
      contextItemsStore.setContextItems([])
      nodeStore.clear()
      mapsStore.clearMaps()
      currentStoryStore.clearStory()

      currentStoryStore.newStory('local')
      currentStoryStore.setName(storyName, false)
    }
  }

  const storyId = currentStoryStore.id

  // Create hierarchy: book > arc > chapter
  const book = nodeStore.addNode(null, 'book', storyName)
  const arc = nodeStore.addNode(book.id, 'arc', 'Part 1')
  const chapter = nodeStore.addNode(arc.id, 'chapter', 'Chapter 1')

  // Map segment IDs to created scene IDs
  const segmentToSceneId = new Map<string, string>()
  const allNodes: Node[] = [book, arc, chapter]
  const allMessages: Message[] = []

  // Find root segment (no parent)
  const rootSegment = segments.find((s) => !s.parentSegmentId)
  if (!rootSegment) {
    throw new Error('No root segment found in branch data')
  }

  // Helper to get child segments of a given segment (via branchMessage options)
  function getChildSegments(segment: SceneSegment): SceneSegment[] {
    if (!segment.branchMessage) return []
    return segment.branchMessage.options
      .map((opt) => {
        // Find segment where branchOptionId matches this option
        return segments.find((s) => s.parentSegmentId === segment.id && s.branchOptionId === opt.id)
      })
      .filter((s): s is SceneSegment => !!s)
  }

  // Process segments in tree order (BFS) to create scenes
  const queue: { segment: SceneSegment; depth: number }[] = [{ segment: rootSegment, depth: 0 }]
  let sceneOrder = 0

  while (queue.length > 0) {
    const { segment, depth } = queue.shift()!

    // Create scene for this segment
    const sceneName = depth === 0 ? 'Conversation' : `Branch ${sceneOrder}`
    const scene = nodeStore.addNode(chapter.id, 'scene', sceneName)
    segmentToSceneId.set(segment.id, scene.id)
    allNodes.push(scene)
    sceneOrder++

    // Prepare messages for this scene
    const sceneMessages: Message[] = []

    // Add regular messages
    for (let i = 0; i < segment.messages.length; i++) {
      const msg = segment.messages[i]
      const messageWithScene: Message = {
        ...msg,
        sceneId: scene.id,
        order: i,
      }
      sceneMessages.push(messageWithScene)
      allMessages.push(messageWithScene)
    }

    // Add branch message if this segment has one
    if (segment.branchMessage) {
      const branchMsg: Message = {
        id: segment.branchMessage.id,
        role: 'assistant',
        type: 'branch',
        content: segment.branchMessage.content,
        options: segment.branchMessage.options, // Options will be updated with targets after all scenes created
        sceneId: scene.id,
        order: sceneMessages.length,
        timestamp: new Date(),
      }
      sceneMessages.push(branchMsg)
      allMessages.push(branchMsg)
    }

    // Queue child segments
    const children = getChildSegments(segment)
    for (const child of children) {
      queue.push({ segment: child, depth: depth + 1 })
    }
  }

  // Now update branch message options with actual scene/message targets
  for (const segment of segments) {
    if (!segment.branchMessage) continue

    const branchMsg = allMessages.find((m) => m.id === segment.branchMessage!.id)
    if (!branchMsg || !branchMsg.options) continue

    // Update each option with target scene and first message
    for (const option of branchMsg.options) {
      // Find the child segment for this option
      const childSegment = segments.find(
        (s) => s.parentSegmentId === segment.id && s.branchOptionId === option.id,
      )
      if (!childSegment) continue

      const targetSceneId = segmentToSceneId.get(childSegment.id)
      if (!targetSceneId) continue

      // Find first message in the target scene
      const firstMessageInScene = allMessages.find(
        (m) => m.sceneId === targetSceneId && m.type !== 'branch',
      )

      option.targetNodeId = targetSceneId
      option.targetMessageId = firstMessageInScene?.id || ''
    }
  }

  // Batch save all messages
  const batchMessages = allMessages.map((msg) => ({
    id: msg.id,
    sceneId: msg.sceneId!,
    sortOrder: msg.order,
    instruction: msg.instruction,
    content: msg.content,
    type: msg.type,
    options: msg.options,
  }))

  console.log('[claudeChatImporter] Importing with branches:', {
    segmentCount: segments.length,
    sceneCount: segmentToSceneId.size,
    messageCount: allMessages.length,
    branchChoices,
  })

  await saveService.saveMessagesBatch(storyId, batchMessages)

  // Add messages to local store
  // IMPORTANT: Clear content since it's been saved as paragraphs on the server.
  // This prevents the editor from recreating paragraphs from content.
  for (const msg of allMessages) {
    messagesStore.appendMessageNoSave({ ...msg, content: '' })
  }

  // Set branch choices on the story
  if (Object.keys(branchChoices).length > 0) {
    currentStoryStore.setBranchChoices(branchChoices)
    await saveService.saveStorySettings(storyId, { branchChoices })
  }

  // For local storage with new story, save the complete story
  if (importTarget === 'new' && storageMode === 'local') {
    await storyManager.updateLocalStory(storyId, {
      id: storyId,
      name: storyName,
      savedAt: new Date(),
      messages: allMessages,
      characters: [],
      contextItems: [],
      nodes: allNodes,
      input: '',
      storySetting: '',
      storageMode: 'local',
      person: 'third',
      tense: 'past',
      branchChoices,
    })
  }

  return { storyId }
}
