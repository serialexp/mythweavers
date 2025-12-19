import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { RefinementService } from '../../services/refinementService'

const router = Router()

// Initialize refinement service
const refinementService = new RefinementService(
  prisma,
  process.env.OLLAMA_HOST || 'http://localhost:11434',
  Number.parseInt(process.env.PARALLEL_REFINEMENT_BATCHES || '4'),
)

// POST start story refinement
router.post('/stories/:id/refine', async (req, res) => {
  try {
    const { model, person, tense } = req.body
    console.log(
      `[API] Refinement request for story ${req.params.id} with model: ${model || 'default'}, person: ${person || 'third'}, tense: ${tense || 'past'}`,
    )

    // Check if story exists
    const story = await prisma.story.findUnique({
      where: { id: req.params.id },
    })

    if (!story) {
      console.error(`[API] Story ${req.params.id} not found`)
      res.status(404).json({ error: 'Story not found' })
    }

    console.log(`[API] Starting refinement for story: "${story.name}"`)

    // Start refinement in the background
    refinementService
      .refineStory(req.params.id, model || 'llama3.2', person || 'third', tense || 'past')
      .then(() => console.log(`[API] Refinement completed for story ${req.params.id}`))
      .catch((error) => console.error('[API] Refinement error:', error))

    res.json({
      success: true,
      message: 'Refinement started',
      jobId: req.params.id,
    })
  } catch (error) {
    console.error('[API] Error starting refinement:', error)
    res.status(500).json({ error: 'Failed to start refinement' })
  }
})

export { refinementService }
export default router
