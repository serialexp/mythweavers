import { unwrap } from 'solid-js/store'
import { messagesStore } from '../stores/messagesStore'
import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { nodeStore } from '../stores/nodeStore'
import { mapsStore } from '../stores/mapsStore'

/**
 * Creates a consistent save payload from all the stores
 * This is THE single source of truth for what gets saved
 * Note: For maps, we only send metadata (id/name) to track mapCount. 
 * Full map data with images is saved separately through dedicated API endpoints
 */
export function createSavePayload(overrides?: Partial<{ name: string }>) {
  // Get map metadata only (no image data or landmarks details, but include count)
  const mapMetadata = unwrap(mapsStore.maps).map(map => ({
    id: map.id,
    name: map.name,
    landmarkCount: map.landmarks?.length || 0
  }))
  
  return {
    name: currentStoryStore.name,
    messages: unwrap(messagesStore.messages),
    characters: unwrap(charactersStore.characters),
    contextItems: unwrap(contextItemsStore.contextItems),
    // chapters removed - now handled through nodes
    nodes: unwrap(nodeStore.nodesArray), // Include nodes for hierarchical structure
    maps: mapMetadata, // Just metadata for counting
    input: messagesStore.input,
    storySetting: currentStoryStore.storySetting,
    person: currentStoryStore.person,
    tense: currentStoryStore.tense,
    globalScript: currentStoryStore.globalScript,
    // selectedChapterId removed - now handled through selectedNodeId
    selectedNodeId: nodeStore.selectedNodeId, // Include selected node
    lastKnownUpdatedAt: currentStoryStore.lastKnownUpdatedAt,
    ...overrides
  }
}