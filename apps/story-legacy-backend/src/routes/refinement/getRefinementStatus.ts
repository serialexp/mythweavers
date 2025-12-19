import { Router } from 'express'
import { refinementService } from './startRefinement'

const router = Router()

// GET refinement job status
router.get('/stories/:id/refine/status', async (req, res) => {
  try {
    const job = refinementService.getJobStatus(req.params.id)

    if (!job) {
      res.json({ status: 'not_found' })
    }

    // Only log significant status updates
    if (job.status === 'completed' || job.status === 'failed' || job.progress % 20 === 0) {
      console.log(`[API] Status check for ${req.params.id}: ${job.status} ${job.progress}%`)
    }

    res.json({
      status: job.status,
      progress: job.progress,
      error: job.error,
      newStoryId: job.newStoryId,
      batches: job.batches || [],
      averageBatchTime: job.averageBatchTime,
      estimatedTimeRemaining: job.estimatedTimeRemaining,
    })
  } catch (error) {
    console.error('Error getting refinement status:', error)
    return res.status(500).json({ error: 'Failed to get refinement status' })
  }
})

export default router
