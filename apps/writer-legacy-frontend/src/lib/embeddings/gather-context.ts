import { getOrderedSceneIds } from '../selectors/orderedSceneIds'
import { treeState } from '../stores/tree'
import { useAi } from '../use-ai'
import { searchEmbeddings } from './embedding-store'
import {
  type CharacterEmbeddingMetadata,
  type LocationEmbeddingMetadata,
  type ParagraphEmbeddingMetadata,
  loadStoryToEmbeddings,
} from './load-story-to-embeddings'

type ContextQuery = {
  query: string
  type: 'character' | 'location' | 'scene' | 'character_actions'
  reason: string
}

type GatheredContext = {
  characters: Array<{
    content: string
    reason: string
  }>
  locations: Array<{
    content: string
    reason: string
  }>
  scenes: Array<{
    content: string
    reason: string
  }>
  character_actions: Array<{
    content: string
    reason: string
  }>
}

export async function gatherContext(
  task: string,
  initialContext: string,
  currentSceneId?: string,
): Promise<GatheredContext> {
  // First, ask the AI what context it needs
  const contextRequest = await useAi('snowflake_gather_context', [
    { text: `Task: ${task}\n\nInitial Context: ${initialContext}`, canCache: true },
  ])

  // Parse the AI's response
  const queries: { queries: ContextQuery[] } = JSON.parse(contextRequest)

  // Initialize results object
  const results: GatheredContext = {
    characters: [],
    locations: [],
    scenes: [],
    character_actions: [],
  }

  // Get ordered scene IDs if we need to filter actions
  let availableSceneIds: Set<string> | undefined
  if (currentSceneId) {
    const orderedSceneIds = getOrderedSceneIds(treeState.structure)
    const currentIndex = orderedSceneIds.indexOf(currentSceneId)
    if (currentIndex !== -1) {
      // Include all scenes up to but not including the current scene
      availableSceneIds = new Set(orderedSceneIds.slice(0, currentIndex))
    }
  }

  // ensure embeddings are loaded
  await loadStoryToEmbeddings()

  // Process each query
  for (const query of queries.queries) {
    // Search embeddings based on query type
    const searchResults = await searchEmbeddings(
      query.query,
      query.type === 'character_actions' ? 10 : 3, // Get more results for actions
      (doc) => {
        const metadata = doc.metadata as
          | CharacterEmbeddingMetadata
          | LocationEmbeddingMetadata
          | ParagraphEmbeddingMetadata
        switch (query.type) {
          case 'character':
            return metadata.kind === 'context' && 'characterId' in metadata && metadata.aspect === 'summary'
          case 'character_actions':
            if (!availableSceneIds) return false
            return (
              metadata.kind === 'context' &&
              'characterId' in metadata &&
              metadata.aspect === 'action' &&
              availableSceneIds.has(metadata.sceneId)
            )
          case 'location':
            return metadata.kind === 'context' && 'locationId' in metadata
          case 'scene':
            return metadata.kind === 'content'
        }
      },
    )

    // Add results to appropriate category
    for (const [doc] of searchResults) {
      const _metadata = doc.metadata as
        | CharacterEmbeddingMetadata
        | LocationEmbeddingMetadata
        | ParagraphEmbeddingMetadata
      const content = doc.pageContent

      // For character actions, only include if the scene has already happened
      if (query.type === 'character_actions') {
        // Extract sceneId from the action content (assumes format includes "(in scene sceneId)")
        const sceneMatch = content.match(/\(in scene ([^)]+)\)/)
        if (!sceneMatch || !availableSceneIds?.has(sceneMatch[1])) {
          continue
        }
      }

      switch (query.type) {
        case 'character':
          results.characters.push({ content, reason: query.reason })
          break
        case 'character_actions':
          results.character_actions.push({ content, reason: query.reason })
          break
        case 'location':
          results.locations.push({ content, reason: query.reason })
          break
        case 'scene':
          results.scenes.push({ content, reason: query.reason })
          break
      }
    }
  }
  console.log('gathered context', results)

  return results
}
