import { addNotification } from '../stores/notifications'
import { currentScene } from '../stores/retrieval/current-scene'
import { useAi } from '../use-ai'
import { searchEmbeddings } from './embedding-store'
import { loadStoryToEmbeddings } from './load-story-to-embeddings'

export type EmbeddingResult = [
  {
    pageContent: string
    metadata: Record<string, string>
  },
  number,
]

/**
 * Retrieves relevant context and story content based on the input text
 * @param inputText The text to search for relevant content
 * @returns An object containing the formatted RAG content and the raw results
 */
export async function retrieveRagContent(inputText: string): Promise<{
  ragContent: string
  appropriateContext: EmbeddingResult[]
  storyContent: EmbeddingResult[]
  queries: string[]
}> {
  if (!inputText) {
    return {
      ragContent: '',
      appropriateContext: [],
      storyContent: [],
      queries: [inputText],
    }
  }

  try {
    await loadStoryToEmbeddings()

    const scene = currentScene()
    if (!scene) {
      return {
        ragContent: '',
        appropriateContext: [],
        storyContent: [],
        queries: [inputText],
      }
    }

    // Search for appropriate context (locations, etc.)
    const appropriateContext = await searchEmbeddings(
      inputText,
      5,
      (doc) => {
        // Only filter out character and location information that's already included in the scene's properties
        if (doc.metadata.kind !== 'context') return false

        // If it's a character that's already in the scene's characterIds or referredCharacterIds, exclude it
        if ('characterId' in doc.metadata) {
          const characterId = doc.metadata.characterId as string

          // Skip if this character is already in the scene
          if (scene.characterIds?.includes(characterId) || scene.referredCharacterIds?.includes(characterId)) {
            return false
          }

          // For characters not in the scene, only include the summary aspect
          // This reduces noise by focusing on the most important character information
          return doc.metadata.aspect === 'summary'
        }

        // If it's a location that's already in the scene's locationId, exclude it
        if ('locationId' in doc.metadata) {
          const locationId = doc.metadata.locationId as string
          return locationId !== scene.locationId
        }

        return true
      },
      0.35,
    )

    // Search for relevant story content
    const storyContent = await searchEmbeddings(inputText, 5, (doc) => {
      return doc.metadata.kind === 'content' && scene?.id !== doc.metadata.sceneId
    })

    // Format the RAG content
    const blockSep = '```'
    const ragContentText = `${
      appropriateContext && appropriateContext.length > 0
        ? `Relevant context (locations, etc.):\n${blockSep}\n${appropriateContext
            .map((c) => {
              const metadata = c[0].metadata
              if ('locationId' in metadata) {
                return `Location: ${c[0].pageContent} (${c[1]})`
              }
              return c[0].pageContent
            })
            .join('\n\n')}\n${blockSep}\n\n`
        : ''
    }${
      storyContent && storyContent.length > 0
        ? `Relevant Story content (sorted by relevance):\n${blockSep}\n${storyContent
            .map((c) => `${c[0].pageContent} (${c[1]})`)
            .join('\n\n')}\n${blockSep}\n\n`
        : ''
    }`

    return {
      ragContent: ragContentText,
      appropriateContext,
      storyContent,
      queries: [inputText],
    }
  } catch (error: unknown) {
    console.error('Error searching embeddings:', error)
    addNotification({
      title: 'Error searching embeddings',
      message: error instanceof Error ? error.message : String(error),
      type: 'error',
    })

    return {
      ragContent: '',
      appropriateContext: [],
      storyContent: [],
      queries: [inputText],
    }
  }
}

/**
 * Generates additional RAG queries based on the current content
 * @param inputText The current input text
 * @returns An array of generated queries
 */
export async function generateRagQueries(inputText: string): Promise<string[]> {
  try {
    const prompt = `Text: "${inputText}"`

    const result = await useAi('rag_queries', prompt, false)

    try {
      // Try to parse the result as JSON
      const queries = JSON.parse(result)
      if (Array.isArray(queries) && queries.length > 0) {
        return queries.slice(0, 3) // Ensure we only return up to 3 queries
      }
    } catch (parseError) {
      console.error('Error parsing AI-generated queries:', parseError)
    }

    // Fallback: Try to extract queries from the text if JSON parsing fails
    const lines = result.split('\n')
    const extractedQueries = lines
      .filter((line) => line.trim().startsWith('"') || line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map((line) =>
        line
          .replace(/^["\-*]\s*/, '')
          .replace(/"$/, '')
          .trim(),
      )
      .filter((line) => line.length > 0)
      .slice(0, 3)

    return extractedQueries.length > 0 ? extractedQueries : []
  } catch (error) {
    console.error('Error generating RAG queries:', error)
    return []
  }
}

/**
 * Retrieves RAG content using both the original input and AI-generated queries
 * @param inputText The original input text
 * @returns An object containing the combined RAG content and the queries used
 */
export async function retrieveEnhancedRagContent(inputText: string): Promise<{
  ragContent: string
  queries: string[]
}> {
  if (!inputText) {
    return { ragContent: '', queries: [] }
  }

  // Generate additional queries
  const additionalQueries = await generateRagQueries(inputText)

  // Only use the AI-generated queries, not the original input
  if (additionalQueries.length === 0) {
    // If no additional queries were generated, fall back to using the original input
    const result = await retrieveRagContent(inputText)
    return { ragContent: result.ragContent, queries: [inputText] }
  }

  // Execute each AI-generated query and collect results
  const allResults = await Promise.all(additionalQueries.map((query) => retrieveRagContent(query)))

  // Combine all appropriate context and story content with deduplication
  const seenContextIds = new Set<string>()
  const seenStoryIds = new Set<string>()

  const combinedAppropriateContext = allResults
    .flatMap((result) => result.appropriateContext)
    .filter((item) => {
      // Create a unique key based on content and metadata
      const key = `${item[0].pageContent}-${JSON.stringify(item[0].metadata)}`
      if (seenContextIds.has(key)) {
        return false
      }
      seenContextIds.add(key)
      return true
    })

  const combinedStoryContent = allResults
    .flatMap((result) => result.storyContent)
    .filter((item) => {
      // Create a unique key based on content and metadata
      const key = `${item[0].pageContent}-${JSON.stringify(item[0].metadata)}`
      if (seenStoryIds.has(key)) {
        return false
      }
      seenStoryIds.add(key)
      return true
    })

  // Format the combined RAG content
  const blockSep = '```'
  const ragContentText = `${
    combinedAppropriateContext && combinedAppropriateContext.length > 0
      ? `Relevant context (locations, etc.):\n${blockSep}\n${combinedAppropriateContext
          .map((c) => {
            const metadata = c[0].metadata
            if ('locationId' in metadata) {
              return `Location: ${c[0].pageContent} (${c[1]})`
            }
            return c[0].pageContent
          })
          .join('\n\n')}\n${blockSep}\n\n`
      : ''
  }${
    combinedStoryContent && combinedStoryContent.length > 0
      ? `Relevant Story content (sorted by relevance):\n${blockSep}\n${combinedStoryContent
          .map((c) => `${c[0].pageContent} (${c[1]})`)
          .join('\n\n')}\n${blockSep}\n\n`
      : ''
  }`

  return { ragContent: ragContentText, queries: additionalQueries }
}
