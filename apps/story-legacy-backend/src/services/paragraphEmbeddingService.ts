import { Ollama } from 'ollama'
import type { Prisma } from '../generated/prisma'
import { createLogger } from '../lib/logger'
import { prisma } from '../lib/prisma'
import { generateMessageId } from '../utils/id'

const logger = createLogger('paragraphEmbeddingService')

const ollamaHost = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434'
const embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL ?? process.env.EMBEDDING_MODEL ?? 'qwen3-embedding:0.6b'

const ollama = new Ollama({ host: ollamaHost })

const EMBEDDING_DELETE_BATCH_SIZE = 200
const EMBEDDING_INSERT_BATCH_SIZE = 200

export function splitIntoParagraphs(content: string): string[] {
  if (!content.trim()) {
    return []
  }

  return content
    .split(/\r?\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\r/g, '').trim())
    .filter((paragraph) => paragraph.length > 0)
}

// Type guard to ensure we have an ArrayBuffer (not SharedArrayBuffer)
function isArrayBuffer(buffer: ArrayBufferLike): buffer is ArrayBuffer {
  return buffer instanceof ArrayBuffer
}

function vectorToBuffer(vector: number[]): Uint8Array<ArrayBuffer> {
  const floatArray = Float32Array.from(vector)
  // Create a new Uint8Array by copying to ensure proper type compatibility with Prisma
  const uint8Array = new Uint8Array(floatArray)

  // Verify we have an ArrayBuffer (not SharedArrayBuffer)
  if (!isArrayBuffer(uint8Array.buffer)) {
    throw new Error('Expected ArrayBuffer but got SharedArrayBuffer')
  }

  return uint8Array as Uint8Array<ArrayBuffer>
}

async function generateEmbedding(text: string): Promise<number[]> {
  let vector: number[] | undefined

  try {
    const embedResponse = await ollama.embed({
      model: embeddingModel,
      input: text,
    })
    if (Array.isArray(embedResponse.embeddings) && embedResponse.embeddings.length > 0) {
      vector = embedResponse.embeddings[0]
    }
  } catch (error) {
    logger.warn({ err: error, model: embeddingModel }, 'Primary embed request failed; attempting fallback')
  }

  if (!vector || vector.length === 0) {
    throw new Error(`Unexpected embedding response for model "${embeddingModel}"`)
  }

  return vector
}

async function deleteEmbeddingsForMessage(storyId: string, messageId: string) {
  const existing = await prisma.paragraphEmbedding.findMany({
    where: { storyId, messageId },
    select: { id: true },
  })

  if (existing.length === 0) {
    return
  }

  for (let start = 0; start < existing.length; start += EMBEDDING_DELETE_BATCH_SIZE) {
    const batchIds = existing.slice(start, start + EMBEDDING_DELETE_BATCH_SIZE).map((record) => record.id)

    await prisma.paragraphEmbedding.deleteMany({
      where: { id: { in: batchIds } },
    })
  }
}

export async function refreshParagraphEmbeddingsForMessage(options: {
  storyId: string
  messageId: string
  content: string
  paragraphsOverride?: string[]
  embeddingParagraphs?: string[]
  isQuery?: boolean
}): Promise<string[]> {
  const { storyId, messageId, content, paragraphsOverride, embeddingParagraphs, isQuery } = options
  const paragraphs = paragraphsOverride ?? splitIntoParagraphs(content)
  const paragraphsForEmbedding = embeddingParagraphs ?? paragraphs

  try {
    await prisma.message.update({
      where: { storyId_id: { storyId, id: messageId } },
      data: { paragraphs },
    })

    // Delete all existing embeddings so we can rebuild from scratch
    await deleteEmbeddingsForMessage(storyId, messageId)
  } catch (error: unknown) {
    logger.error({ err: error, storyId, messageId }, 'Failed to prepare message for paragraph embeddings')
    throw error instanceof Error ? error : new Error('Failed to prepare message for paragraph embeddings')
  }

  if (paragraphsForEmbedding.length === 0 || isQuery) {
    logger.debug(
      {
        storyId,
        messageId,
        skipped: isQuery,
        paragraphCount: paragraphsForEmbedding.length,
      },
      'Skipped embedding generation for message',
    )
    return paragraphs
  }

  try {
    const records: Prisma.ParagraphEmbeddingCreateManyInput[] = []

    for (const [index, paragraph] of paragraphsForEmbedding.entries()) {
      const vector = await generateEmbedding(paragraph)
      if (vector.length === 0) {
        logger.warn(
          {
            storyId,
            messageId,
            paragraphIndex: index,
            paragraph: paragraph.slice(0, 200),
          },
          'Embedding model returned empty vector; skipping paragraph',
        )
        continue
      }
      records.push({
        id: generateMessageId(),
        storyId,
        messageId,
        paragraphIndex: index,
        content: paragraph,
        embedding: vectorToBuffer(vector),
        model: embeddingModel,
        dimension: vector.length,
      })
    }

    if (records.length > 0) {
      for (let start = 0; start < records.length; start += EMBEDDING_INSERT_BATCH_SIZE) {
        const batch = records.slice(start, start + EMBEDDING_INSERT_BATCH_SIZE)
        await prisma.paragraphEmbedding.createMany({
          data: batch,
        })
      }
    }

    if (records.length === 0) {
      logger.warn({ storyId, messageId }, 'Skipping message embeddings because no vectors were generated')
    }

    logger.debug(
      {
        storyId,
        messageId,
        paragraphCount: records.length,
        model: embeddingModel,
      },
      'Generated paragraph embeddings for message',
    )
  } catch (error: unknown) {
    logger.error(
      {
        err: error,
        storyId,
        messageId,
      },
      'Failed to generate paragraph embeddings',
    )
    throw error instanceof Error ? error : new Error('Failed to generate paragraph embeddings')
  }

  return paragraphs
}

export async function deleteParagraphEmbeddings(options: {
  storyId: string
  messageId: string
}) {
  const { storyId, messageId } = options
  await deleteEmbeddingsForMessage(storyId, messageId)
}

function bufferToFloat32Array(buffer: Buffer): Float32Array {
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Float32Array.BYTES_PER_ELEMENT)
}

function cosineSimilarity(queryVector: Float32Array, targetVector: Float32Array, queryMagnitude: number): number {
  let dotProduct = 0
  let targetMagnitudeSquared = 0

  const length = Math.min(queryVector.length, targetVector.length)
  for (let i = 0; i < length; i += 1) {
    const q = queryVector[i] ?? 0
    const t = targetVector[i] ?? 0
    dotProduct += q * t
    targetMagnitudeSquared += t * t
  }

  if (queryMagnitude === 0 || targetMagnitudeSquared === 0) {
    return 0
  }

  return dotProduct / (queryMagnitude * Math.sqrt(targetMagnitudeSquared))
}

export async function rebuildParagraphEmbeddings(options: {
  storyId?: string
  progressInterval?: number
  force?: boolean
  onProgress?: (info: {
    completed: number
    total: number
    storyId: string
    messageId: string
    progress: number
  }) => void
}) {
  const { storyId, progressInterval = 25, force = false, onProgress } = options
  const maxParagraphsPerMessage = Number.parseInt(process.env.EMBEDDING_MAX_PARAGRAPHS_PER_MESSAGE ?? '-1', 10)

  const messages = await prisma.message.findMany({
    where: {
      deleted: false,
      isQuery: false,
      ...(storyId ? { storyId } : {}),
    },
    select: {
      id: true,
      storyId: true,
      content: true,
      isQuery: true,
      timestamp: true,
      paragraphs: true,
    },
    orderBy: [{ storyId: 'asc' }, { order: 'asc' }],
  })

  const embeddingMeta = await prisma.paragraphEmbedding.groupBy({
    by: ['storyId', 'messageId'],
    where: {
      ...(storyId ? { storyId } : {}),
    },
    _max: {
      updatedAt: true,
    },
    _min: {
      dimension: true,
    },
    _count: {
      _all: true,
    },
  })

  const embeddingLookup = new Map<string, { updatedAt: Date | null; count: number; minDimension: number | null }>()
  for (const meta of embeddingMeta) {
    const key = `${meta.storyId}:${meta.messageId}`
    embeddingLookup.set(key, {
      updatedAt: meta._max.updatedAt ?? null,
      count: meta._count._all,
      minDimension: meta._min.dimension ?? null,
    })
  }

  const total = messages.length
  let completed = 0

  logger.info({ storyId: storyId ?? 'all', count: total }, 'Rebuilding paragraph embeddings')

  for (const message of messages) {
    const key = `${message.storyId}:${message.id}`
    const meta = embeddingLookup.get(key)
    const paragraphsFromMessage =
      (Array.isArray(message.paragraphs) ? (message.paragraphs as string[]) : null) ??
      splitIntoParagraphs(message.content)
    const paragraphsToProcess =
      maxParagraphsPerMessage > 0 ? paragraphsFromMessage.slice(0, maxParagraphsPerMessage) : paragraphsFromMessage

    const isUpToDate =
      meta?.updatedAt &&
      message.timestamp &&
      meta.updatedAt >= message.timestamp &&
      meta.count === paragraphsToProcess.length &&
      (meta.minDimension ?? 0) > 0 &&
      paragraphsToProcess.length > 0

    if (isUpToDate && !force) {
      logger.debug(
        {
          storyId: message.storyId,
          messageId: message.id,
          paragraphCount: paragraphsToProcess.length,
        },
        'Skipping paragraph embedding rebuild (up-to-date)',
      )
    } else {
      try {
        await refreshParagraphEmbeddingsForMessage({
          storyId: message.storyId,
          messageId: message.id,
          content: message.content,
          paragraphsOverride: paragraphsFromMessage,
          embeddingParagraphs: paragraphsToProcess,
          isQuery: message.isQuery,
        })
      } catch (error) {
        logger.error(
          { err: error, storyId: message.storyId, messageId: message.id },
          'Failed to rebuild embeddings for message',
        )
      }
    }

    completed += 1
    if (onProgress && (completed % progressInterval === 0 || completed === total)) {
      onProgress({
        completed,
        total,
        storyId: message.storyId,
        messageId: message.id,
        progress: total === 0 ? 1 : completed / total,
      })
    }
  }

  logger.info({ storyId: storyId ?? 'all', count: total }, 'Finished rebuilding paragraph embeddings')
}

export interface SemanticSearchOptions {
  query: string
  storyId?: string
  limit?: number
  minScore?: number
  contextParagraphs?: number
}

export interface SemanticSearchContextItem {
  paragraphIndex: number
  text: string
}

export interface SemanticSearchResult {
  storyId: string
  messageId: string
  nodeId: string | null
  paragraphIndex: number
  matchingParagraph: string
  context: SemanticSearchContextItem[]
  score: number
  model: string
  dimension: number
  message: {
    sentenceSummary: string | null
    summary: string | null
    paragraphSummary: string | null
  }
}

export async function searchParagraphEmbeddings(options: SemanticSearchOptions): Promise<SemanticSearchResult[]> {
  const { query, storyId, limit = 10, minScore = 0, contextParagraphs = 1 } = options

  if (!query.trim()) {
    return []
  }

  let queryVector: number[]
  try {
    queryVector = await generateEmbedding(query)
  } catch (error) {
    logger.error({ err: error }, 'Failed to generate query embedding')
    return []
  }

  const queryFloat = Float32Array.from(queryVector)
  const queryMagnitude = Math.sqrt(queryFloat.reduce((sum, value) => sum + value * value, 0))

  const embeddings = await prisma.paragraphEmbedding.findMany({
    where: {
      ...(storyId ? { storyId } : {}),
      message: {
        deleted: false,
        isQuery: false,
      },
    },
    select: {
      storyId: true,
      messageId: true,
      paragraphIndex: true,
      content: true,
      embedding: true,
      model: true,
      dimension: true,
    },
  })

  type ScoredEmbedding = {
    storyId: string
    messageId: string
    paragraphIndex: number
    content: string
    paragraph: string
    score: number
    model: string
    dimension: number
  }

  const scored: ScoredEmbedding[] = []

  for (const record of embeddings) {
    const vector = bufferToFloat32Array(record.embedding as Buffer)
    if (vector.length === 0 || queryFloat.length !== vector.length) {
      logger.warn(
        {
          storyId: record.storyId,
          messageId: record.messageId,
          paragraphIndex: record.paragraphIndex,
          expectedDimension: queryFloat.length,
          actualDimension: vector.length,
        },
        'Skipping embedding with mismatched dimensions',
      )
      continue
    }

    const score = cosineSimilarity(queryFloat, vector, queryMagnitude)

    if (score < minScore) {
      continue
    }

    const paragraphText = record.content
    scored.push({
      storyId: record.storyId,
      messageId: record.messageId,
      paragraphIndex: record.paragraphIndex,
      content: paragraphText,
      paragraph: paragraphText,
      score,
      model: record.model,
      dimension: record.dimension,
    })
  }

  scored.sort((a, b) => b.score - a.score)
  const topResults = scored.slice(0, limit)

  if (topResults.length === 0) {
    return []
  }

  const messageIds = Array.from(new Set(topResults.map((result) => result.messageId)))

  const messages = await prisma.message.findMany({
    where: {
      id: {
        in: messageIds,
      },
    },
    select: {
      id: true,
      nodeId: true,
      sentenceSummary: true,
      summary: true,
      paragraphSummary: true,
      paragraphs: true,
    },
  })

  const messageById = new Map(messages.map((message) => [message.id, message]))

  return topResults.map<SemanticSearchResult>((result) => {
    const message = messageById.get(result.messageId)
    const context: SemanticSearchContextItem[] = []

    if (message?.paragraphs && Array.isArray(message.paragraphs)) {
      const paragraphs = message.paragraphs as string[]
      const start = Math.max(0, result.paragraphIndex - contextParagraphs)
      const end = Math.min(paragraphs.length - 1, result.paragraphIndex + contextParagraphs)

      for (let i = start; i <= end; i += 1) {
        if (i === result.paragraphIndex) {
          continue
        }
        context.push({
          paragraphIndex: i,
          text: paragraphs[i],
        })
      }
    }

    const matchingParagraph =
      message?.paragraphs &&
      Array.isArray(message.paragraphs) &&
      message.paragraphs[result.paragraphIndex] !== undefined
        ? (message.paragraphs[result.paragraphIndex] as string)
        : result.content

    return {
      storyId: result.storyId,
      messageId: result.messageId,
      nodeId: message?.nodeId ?? null,
      paragraphIndex: result.paragraphIndex,
      matchingParagraph,
      context,
      score: result.score,
      model: result.model,
      dimension: result.dimension,
      message: {
        sentenceSummary: message?.sentenceSummary ?? null,
        summary: message?.summary ?? null,
        paragraphSummary: message?.paragraphSummary ?? null,
      },
    }
  })
}
