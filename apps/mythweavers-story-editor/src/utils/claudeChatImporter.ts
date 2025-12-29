import { postMyStories } from '../client/config'
import { saveService } from '../services/saveService'
import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { mapsStore } from '../stores/mapsStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import type { Message } from '../types/core'
import { storyManager } from './storyManager'

export interface ImportClaudeChatOptions {
  conversationName: string
  messages: Message[]
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

  // For server storage, use batch save endpoint for efficiency
  if (storageMode === 'server') {
    // Prepare messages for batch API
    const batchMessages = messages.map((msg, index) => ({
      id: msg.id,
      sceneId: scene.id,
      sortOrder: index,
      instruction: msg.instruction,
      content: msg.content,
    }))

    // Save all messages in one API call
    await saveService.saveMessagesBatch(storyId, batchMessages)

    // Add messages to local store (without triggering individual saves)
    for (const msg of messages) {
      const messageWithScene: Message = {
        ...msg,
        sceneId: scene.id,
      }
      messagesWithScene.push(messageWithScene)
      // Use no-save version to avoid triggering saveService (already saved via batch)
      messagesStore.appendMessageNoSave(messageWithScene)
    }
  } else {
    // For local storage, add messages normally
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const messageWithScene: Message = {
        ...msg,
        sceneId: scene.id,
      }
      messagesWithScene.push(messageWithScene)
      messagesStore.appendMessage(messageWithScene)

      // Yield to event loop every 10 messages to keep UI responsive
      if (i % 10 === 9) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }

    // For local storage with new story, save the complete story
    if (importTarget === 'new') {
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
  }

  return { storyId }
}
