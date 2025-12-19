import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { Router } from 'express'
import { createLogger } from '../../lib/logger'

const router = Router()
const log = createLogger('episodes')

// GET frame image for a specific episode
router.get('/episodes/:episodeId/frames/:frameNumber', async (req, res) => {
  try {
    const { episodeId, frameNumber } = req.params
    const episodesDir = process.env.EPISODES_DIR || '/home/bart/Projects/video-analyzer/output'

    // Construct the frame directory path
    const framesDir = path.join(episodesDir, `${episodeId}_frames`)
    const framePath = path.join(framesDir, `frame_${frameNumber}.jpg`)

    log.debug({ framePath }, 'Serving frame image')

    // Check if file exists and get stats
    let stats
    try {
      stats = await fs.stat(framePath)
    } catch (_error) {
      log.warn({ episodeId, frameNumber }, 'Frame image not found')
      res.status(404).json({ error: 'Frame not found' })
    }

    // Generate ETag based on file modification time and size
    const etag = `"${stats.mtime.getTime()}-${stats.size}"`

    // Check if client has a cached version
    const ifNoneMatch = req.headers['if-none-match']
    if (ifNoneMatch === etag) {
      // Client has the latest version
      res.status(304).end() // Not Modified
    }

    // Read the image file
    const imageBuffer = await fs.readFile(framePath)

    // Set appropriate headers
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('ETag', etag)
    res.setHeader('Cache-Control', 'public, must-revalidate') // Must check ETag

    // Send the image
    res.send(imageBuffer)
  } catch (error) {
    log.error({ error, episodeId: req.params.episodeId, frameNumber: req.params.frameNumber }, 'Error serving frame')
    res.status(500).json({ error: 'Failed to serve frame image' })
  }
})

export default router
