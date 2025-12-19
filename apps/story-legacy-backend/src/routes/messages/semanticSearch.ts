import { Router } from 'express'
import { searchParagraphEmbeddings } from '../../services/paragraphEmbeddingService'

const router = Router()

router.get('/stories/:storyId/messages/search/semantic', async (req, res) => {
  try {
    const { storyId } = req.params
    const query = String(req.query.q ?? '').trim()

    if (!query) {
      res.status(400).json({
        error: 'Missing required query parameter "q"',
      })
    }

    const limitRaw = req.query.limit
    const minScoreRaw = req.query.minScore

    const limit = typeof limitRaw === 'string' && limitRaw.length > 0 ? Number.parseInt(limitRaw, 10) : 10

    if (Number.isNaN(limit) || limit <= 0) {
      res.status(400).json({
        error: 'limit must be a positive integer',
      })
    }

    const minScore =
      typeof minScoreRaw === 'string' && minScoreRaw.length > 0 ? Number.parseFloat(minScoreRaw) : undefined

    if (minScore !== undefined && (Number.isNaN(minScore) || minScore < -1 || minScore > 1)) {
      res.status(400).json({
        error: 'minScore must be a number between -1 and 1',
      })
    }

    const contextRaw = req.query.context as string | undefined
    const contextParagraphs = contextRaw ? Number.parseInt(contextRaw, 10) : 2

    if (contextParagraphs < 0 || Number.isNaN(contextParagraphs)) {
      res.status(400).json({
        error: 'context must be a non-negative integer',
      })
    }

    const results = await searchParagraphEmbeddings({
      storyId,
      query,
      limit,
      minScore,
      contextParagraphs,
    })

    res.json({
      storyId,
      query,
      limit,
      minScore,
      contextParagraphs,
      count: results.length,
      results,
    })
  } catch (error) {
    console.error('Semantic search failed:', error)
    res.status(500).json({
      error: 'Failed to perform semantic search',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

export default router
