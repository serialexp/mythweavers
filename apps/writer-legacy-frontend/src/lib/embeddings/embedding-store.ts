import type { Document } from '@langchain/core/documents'
import { OpenAIEmbeddings } from '@langchain/openai'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { settingsState } from '../stores/settings'
import {
  CharacterEmbeddingMetadata,
  LocationEmbeddingMetadata,
  ParagraphEmbeddingMetadata,
} from './load-story-to-embeddings'

let memoryStore: MemoryVectorStore
export const getVectorStore = async () => {
  if (memoryStore) {
    return memoryStore
  }
  const key = settingsState.openaiKey
  if (!key) {
    throw new Error('No openai key set')
  }
  memoryStore = new MemoryVectorStore(
    new OpenAIEmbeddings({
      model: 'text-embedding-3-small',
      apiKey: key,
      batchSize: 500,
      onFailedAttempt: (error) => {
        console.error('Failed attempt', error)
      },
      maxConcurrency: 5,
    }),
  )

  return memoryStore
}

export const resetVectorStore = () => {
  memoryStore = new MemoryVectorStore(
    new OpenAIEmbeddings({
      model: 'text-embedding-3-small',
      apiKey: settingsState.openaiKey,
      batchSize: 500,
      onFailedAttempt: (error) => {
        console.error('Failed attempt', error)
      },
      maxConcurrency: 5,
    }),
  )
}

export const addDocuments = async (documents: Document[]) => {
  const store = await getVectorStore()
  return store.addDocuments(documents)
}

export const removeDocuments = async (documentIds: string[]) => {
  const store = await getVectorStore()
  return store.memoryVectors.filter((doc) => !doc.id || !documentIds.includes(doc.id))
}

export const searchEmbeddings = async (
  query: string,
  numResults: number,
  filter?: (doc: Document) => boolean,
  minRelevanceScore?: number,
): Promise<
  [Document<CharacterEmbeddingMetadata | LocationEmbeddingMetadata | ParagraphEmbeddingMetadata>, number][]
> => {
  const store = await getVectorStore()
  console.log('searching embeddings', store.memoryVectors.length)
  return store.similaritySearchWithScore(query, numResults, filter).then((res) => {
    return res.filter((r) => r[1] >= (minRelevanceScore ?? 0))
  }) as Promise<
    [Document<CharacterEmbeddingMetadata | LocationEmbeddingMetadata | ParagraphEmbeddingMetadata>, number][]
  >
}
