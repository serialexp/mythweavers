import { Router } from 'express'
import { refinementService } from './startRefinement'

const router = Router()

// DELETE stop refinement job
router.delete('/stories/:id/refine', async (req, res) => {
  try {
    console.log(`[API] Stop refinement request for story ${req.params.id}`)

    const stopped = refinementService.stopRefinement(req.params.id)

    if (stopped) {
      res.json({ success: true, message: 'Refinement stopped' })
    } else {
      res.status(404).json({
        success: false,
        message: 'No active refinement found',
      })
    }
  } catch (error) {
    console.error('Error stopping refinement:', error)
    res.status(500).json({ error: 'Failed to stop refinement' })
  }
})

export default router
