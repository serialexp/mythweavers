import { deleteMyStoriesById, getHealth, getMyStories, patchMyStoriesById } from '../client/config'
import { Character, Message } from '../types/core'
import { SavedStory, StoryMetadata } from '../types/store'
import { ApiStoryMetadata, apiClient } from './apiClient'
import { getErrorMessage, getErrorName, getErrorStack, isError } from './errorHandling'
import { generateMessageId } from './id'
import { storage } from './storage'

// Re-export for backward compatibility
export type { SavedStory, StoryMetadata }

const STORY_INDEX_KEY = 'story-index'
const STORY_PREFIX = 'story-saved-'

export const storyManager = {
  // Get list of saved story metadata
  getSavedStories: async (): Promise<StoryMetadata[]> => {
    try {
      const index = await storage.get<StoryMetadata[]>(STORY_INDEX_KEY)
      if (!index) return []

      return index.map((story) => ({
        ...story,
        savedAt: new Date(story.savedAt),
      }))
    } catch {
      return []
    }
  },

  // Save current story state
  saveStory: async (
    name: string,
    messages: Message[],
    characters: Character[],
    input: string,
    storySetting: string,
    storageMode: 'server' | 'local' = 'local',
    person: 'first' | 'second' | 'third' = 'third',
    tense: 'present' | 'past' = 'present',
  ): Promise<string> => {
    const id = generateMessageId()

    const storyData: SavedStory = {
      id,
      name,
      savedAt: new Date(),
      messages: messages.map((msg) => ({
        ...msg,
        isSummarizing: false, // Don't save temporary state
      })),
      characters,
      input,
      storySetting,
      storageMode,
      person,
      tense,
    }

    try {
      // Save the full story data to its own key
      await storage.set(`${STORY_PREFIX}${id}`, storyData)

      // Update the index with metadata only
      const index = await storyManager.getSavedStories()
      const metadata: StoryMetadata = {
        id,
        name,
        savedAt: new Date(),
        messageCount: messages.length,
        characterCount: characters.length,
        chapterCount: 0, // New stories start with no chapters
        storySetting,
        storageMode,
      }

      index.push(metadata)
      await storage.set(STORY_INDEX_KEY, index)
      return id
    } catch (error) {
      // Clean up if save failed
      try {
        await storage.remove(`${STORY_PREFIX}${id}`)
      } catch {}

      console.error('Failed to save story:', error)
      // Return empty string to indicate failure without breaking the UI
      return ''
    }
  },

  // Update an existing local story
  updateLocalStory: async (id: string, storyData: SavedStory): Promise<boolean> => {
    try {
      // Check if story exists in index
      const index = await storyManager.getSavedStories()
      const existingStory = index.find((s) => s.id === id)

      if (!existingStory) {
        // If story doesn't exist in index, add it
        const metadata: StoryMetadata = {
          id,
          name: storyData.name,
          savedAt: storyData.savedAt,
          messageCount: storyData.messages.length,
          characterCount: storyData.characters ? storyData.characters.length : 0,
          chapterCount: storyData.chapters ? storyData.chapters.length : 0,
          storySetting: storyData.storySetting,
          storageMode: storyData.storageMode || 'local',
        }
        index.push(metadata)
      } else {
        // Update existing metadata
        const storyIndex = index.findIndex((s) => s.id === id)
        index[storyIndex] = {
          ...existingStory,
          name: storyData.name,
          savedAt: storyData.savedAt,
          messageCount: storyData.messages.length,
          characterCount: storyData.characters ? storyData.characters.length : 0,
          chapterCount: storyData.chapters ? storyData.chapters.length : 0,
          storySetting: storyData.storySetting,
          storageMode: storyData.storageMode || 'local',
        }
      }

      // Save the full story data
      console.log('[storyManager.updateLocalStory] Saving story data to IndexedDB...')
      await storage.set(`${STORY_PREFIX}${id}`, storyData)

      // Update the index
      console.log('[storyManager.updateLocalStory] Updating story index...')
      await storage.set(STORY_INDEX_KEY, index)

      console.log('[storyManager.updateLocalStory] Successfully updated story')
      return true
    } catch (error) {
      console.error('[storyManager.updateLocalStory] Failed to update local story:', error)
      console.error('[storyManager.updateLocalStory] Error details:', {
        errorName: getErrorName(error),
        errorMessage: getErrorMessage(error),
        errorStack: getErrorStack(error),
        errorType: isError(error) ? error.constructor.name : 'Unknown',
        isDOMException: error instanceof DOMException,
        storyId: id,
        hasChapters: storyData.chapters ? storyData.chapters.length : 0,
      })
      return false
    }
  },

  // Load a story and return its data
  loadStory: async (id: string): Promise<SavedStory | null> => {
    try {
      const story = await storage.get<SavedStory>(`${STORY_PREFIX}${id}`)
      if (!story) {
        console.error(`Story with id ${id} not found in storage`)
        return null
      }

      // Convert timestamps back to Date objects
      return {
        ...story,
        savedAt: new Date(story.savedAt),
        messages: story.messages.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
      }
    } catch (error) {
      console.error(`Failed to load story ${id}:`, error)
      return null
    }
  },

  // Delete a saved story
  deleteStory: async (id: string): Promise<boolean> => {
    try {
      // Remove the story data
      await storage.remove(`${STORY_PREFIX}${id}`)

      // Update the index
      const index = await storyManager.getSavedStories()
      const filteredIndex = index.filter((s) => s.id !== id)
      await storage.set(STORY_INDEX_KEY, filteredIndex)
      return true
    } catch {
      return false
    }
  },

  // Update story name
  renameStory: async (id: string, newName: string, type: 'local' | 'server' = 'local'): Promise<boolean> => {
    try {
      if (type === 'server') {
        // Directly call unified backend for server stories
        // (can't use saveService since story isn't loaded)
        await patchMyStoriesById({
          path: { id },
          body: { name: newName },
        })
        return true
      }
      // For local stories, update local storage
      const story = await storage.get<SavedStory>(`${STORY_PREFIX}${id}`)
      if (!story) return false

      story.name = newName
      await storage.set(`${STORY_PREFIX}${id}`, story)

      // Update the index
      const index = await storyManager.getSavedStories()
      const storyIndex = index.findIndex((s) => s.id === id)
      if (storyIndex === -1) return false

      index[storyIndex].name = newName
      await storage.set(STORY_INDEX_KEY, index)
      return true
    } catch (error) {
      console.error('Failed to rename story:', error)
      return false
    }
  },

  // Sync methods for backend integration
  syncToServer: async (id: string): Promise<string | null> => {
    try {
      const story = await storyManager.loadStory(id)
      if (!story) return null

      const contextItems = story.contextItems || []

      // Create new story on server
      const apiStory = await apiClient.createStory({
        name: story.name,
        messages: story.messages,
        characters: story.characters,
        contextItems,
        input: story.input,
        storySetting: story.storySetting,
        person: story.person,
        tense: story.tense,
        globalScript: story.globalScript,
      })

      // Update local story with sync timestamp
      // Note: We no longer sync local to server
      story.syncedAt = new Date()
      await storage.set(`${STORY_PREFIX}${id}`, story)

      return apiStory.id
    } catch (error) {
      console.error('Failed to sync story to server:', error)
      return null
    }
  },

  syncFromServer: async (serverId: string): Promise<string | null> => {
    try {
      const apiStory = await apiClient.getStory(serverId)

      // Create local story from server data
      const localId = generateMessageId()
      const storyData: SavedStory = {
        id: localId,
        name: apiStory.name,
        savedAt: new Date(apiStory.savedAt),
        messages: apiStory.messages.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
        characters: apiStory.characters,
        contextItems: apiStory.contextItems,
        chapters: apiStory.chapters,
        input: apiStory.input,
        storySetting: apiStory.storySetting,
        person: apiStory.person || 'third',
        tense: apiStory.tense || 'present',
        globalScript: apiStory.globalScript,
        // serverId removed - server stories use server ID as primary ID,
        syncedAt: new Date(),
        storageMode: 'server',
      }

      // Save to storage
      await storage.set(`${STORY_PREFIX}${localId}`, storyData)

      // Update index
      const index = await storyManager.getSavedStories()
      const metadata: StoryMetadata = {
        id: localId,
        name: apiStory.name,
        savedAt: new Date(apiStory.savedAt),
        messageCount: apiStory.messages.length,
        characterCount: apiStory.characters.length,
        storySetting: apiStory.storySetting,
        storageMode: 'server',
      }

      index.push(metadata)
      await storage.set(STORY_INDEX_KEY, index)

      return localId
    } catch (error) {
      console.error('Failed to sync story from server:', error)
      return null
    }
  },

  getServerStories: async (): Promise<ApiStoryMetadata[]> => {
    try {
      const result = await getMyStories()
      if (!result.data) return []

      // Convert unified backend format to expected format
      return result.data.stories.map((story) => ({
        id: story.id,
        name: story.name,
        savedAt: story.updatedAt,
        updatedAt: story.updatedAt,
        messageCount: story.messageCount,
        characterCount: story.characterCount,
        chapterCount: story.chapterCount,
        storySetting: story.summary || '',
        fingerprint: undefined,
      }))
    } catch (error) {
      console.error('Failed to fetch server stories:', error)
      return []
    }
  },

  deleteFromServer: async (storyId: string): Promise<boolean> => {
    try {
      await deleteMyStoriesById({ path: { id: storyId } })
      return true
    } catch (error) {
      console.error('Failed to delete story from server:', error)
      return false
    }
  },

  isServerAvailable: async (): Promise<boolean> => {
    try {
      const result = await getHealth()
      return !!result.data
    } catch {
      return false
    }
  },

  // Get storage information
  getStorageInfo: async () => {
    try {
      // Get storage estimate from browser API
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        const usedKB = Math.ceil((estimate.usage || 0) / 1024)
        const totalKB = Math.ceil((estimate.quota || 0) / 1024)

        // Get story count
        const index = await storyManager.getSavedStories()
        const storyCount = index.length

        return {
          usedKB,
          totalKB,
          storyCount,
          totalSizeKB: usedKB, // For compatibility
        }
      }
    } catch (error) {
      console.error('Failed to get storage info:', error)
    }

    // Fallback for older browsers
    const index = await storyManager.getSavedStories()
    return {
      usedKB: 0,
      totalKB: 0,
      storyCount: index.length,
      totalSizeKB: 0,
    }
  },

  // Store the detected storage limit when we hit quota
  setDetectedStorageLimit: (limitKB: number) => {
    try {
      localStorage.setItem('detected-storage-limit', limitKB.toString())
    } catch {
      // Ignore if we can't save it
    }
  },

  // Migrate existing stories to include person, tense, and storySetting
  migrateStories: async (): Promise<void> => {
    try {
      const stories = await storyManager.getSavedStories()

      for (const metadata of stories) {
        const story = await storyManager.loadStory(metadata.id)
        if (story && (!story.person || !story.tense)) {
          // Add default values for missing fields
          story.person = story.person || 'third'
          story.tense = story.tense || 'present'
          story.storySetting = story.storySetting || ''

          // Save the updated story
          await storage.set(`${STORY_PREFIX}${story.id}`, story)
        }
      }
    } catch (error) {
      console.error('Failed to migrate stories:', error)
    }
  },

  // Update story metadata (like storageMode)
  updateStoryMetadata: async (id: string, updates: Partial<StoryMetadata>): Promise<boolean> => {
    try {
      // Update in index
      const index = (await storage.get<StoryMetadata[]>(STORY_INDEX_KEY)) || []
      const storyIndex = index.findIndex((s) => s.id === id)

      if (storyIndex >= 0) {
        index[storyIndex] = { ...index[storyIndex], ...updates }
        await storage.set(STORY_INDEX_KEY, index)
      }

      // Update in story data
      const story = await storyManager.loadStory(id)
      if (story) {
        Object.assign(story, updates)
        await storage.set(`${STORY_PREFIX}${id}`, story)
        return true
      }

      return false
    } catch (error) {
      console.error('Failed to update story metadata:', error)
      return false
    }
  },
}
