import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { Router } from 'express'
import { createLogger } from '../../lib/logger'

const router = Router()
const log = createLogger('episodes')

// GET video segment for a specific episode
router.get('/episodes/:episodeId/segments/:segmentIndex', async (req, res) => {
  try {
    const { episodeId, segmentIndex } = req.params
    const episodesDir = process.env.EPISODES_DIR || '/home/bart/Projects/video-analyzer/output'

    // Construct the segment directory path
    const segmentsDir = path.join(episodesDir, `${episodeId}_segments`)
    const segmentPath = path.join(segmentsDir, `segment_${segmentIndex.padStart(4, '0')}.mp4`)

    log.debug({ segmentPath }, 'Serving segment video')

    // Check if file exists and get stats
    let stats
    try {
      stats = await fs.stat(segmentPath)
    } catch (_error) {
      log.warn({ episodeId, segmentIndex }, 'Segment video not found')
      res.status(404).json({ error: 'Segment not found' })
    }

    // Generate ETag based on file modification time and size
    const etag = `"${stats.mtime.getTime()}-${stats.size}"`

    // Check if client has a cached version
    const ifNoneMatch = req.headers['if-none-match']
    if (ifNoneMatch === etag) {
      // Client has the latest version
      res.status(304).end() // Not Modified
    }

    // Set appropriate headers for video streaming
    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Length', stats.size.toString())
    res.setHeader('ETag', etag)
    res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for a year (videos don't change)
    res.setHeader('Accept-Ranges', 'bytes')

    // Handle range requests for video streaming
    const range = req.headers.range
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = Number.parseInt(parts[0], 10)
      const end = parts[1] ? Number.parseInt(parts[1], 10) : stats.size - 1
      const chunksize = end - start + 1

      res.status(206)
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`)
      res.setHeader('Content-Length', chunksize.toString())

      const stream = require('node:fs').createReadStream(segmentPath, { start, end })
      return stream.pipe(res)
    }

    // Stream the entire file
    const stream = require('node:fs').createReadStream(segmentPath)
    return stream.pipe(res)
  } catch (error) {
    log.error(
      { error, episodeId: req.params.episodeId, segmentIndex: req.params.segmentIndex },
      'Error serving segment',
    )
    res.status(500).json({ error: 'Failed to serve segment video' })
  }
})

export default router
