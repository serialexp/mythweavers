import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { Router } from 'express'
import { createLogger } from '../../lib/logger'

const router = Router()
const log = createLogger('episodes')

// GET specific episode data
router.get('/episodes/:episodeId', async (req, res) => {
  try {
    const { episodeId } = req.params
    const episodesDir = process.env.EPISODES_DIR || '/home/bart/Projects/video-analyzer/output'

    // Construct the file path
    const filePath = path.join(episodesDir, `${episodeId}.json`)

    log.debug({ filePath }, 'Reading episode file')

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch (_error) {
      log.warn({ episodeId }, 'Episode file not found')
      res.status(404).json({ error: 'Episode not found' })
    }

    // Read and parse the JSON file
    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content)

    // If frames array doesn't exist, build it from the frames directory
    if (!data.frames || !Array.isArray(data.frames)) {
      const framesDir = path.join(episodesDir, `${episodeId}_frames`)
      try {
        const frameFiles = await fs.readdir(framesDir)
        const frameNumbers = frameFiles
          .filter((f) => f.match(/^frame_\d+\.jpg$/))
          .map((f) => {
            const match = f.match(/frame_(\d+)\.jpg/)
            return match ? Number.parseInt(match[1]) : null
          })
          .filter((n): n is number => n !== null)
          .sort((a, b) => a - b)

        // Create frames array with estimated timestamps
        // Estimate video duration (22 min for Clone Wars episodes)
        const estimatedDuration = 1320 // 22 minutes in seconds
        const totalFrames = frameNumbers.length

        data.frames = frameNumbers.map((number, index) => ({
          number,
          timestamp: (index / totalFrames) * estimatedDuration,
          imageUrl: `/api/episodes/${episodeId}/frames/${number}`,
        }))
      } catch (error) {
        log.warn({ episodeId, error }, 'Could not read frames directory')
        data.frames = []
      }
    } else {
      // Process existing frame paths to be relative to the API
      data.frames = data.frames.map((frame: any) => ({
        ...frame,
        imageUrl: `/api/episodes/${episodeId}/frames/${frame.number}`,
        originalPath: frame.path,
      }))
    }

    // Check for video segments and include segment info
    const segmentsDir = path.join(episodesDir, `${episodeId}_segments`)
    let hasVideoSegments = false
    const segmentIndexMap: Record<number, number> = {}

    try {
      const segmentIndexPath = path.join(segmentsDir, 'index.json')
      const segmentIndexContent = await fs.readFile(segmentIndexPath, 'utf-8')
      const segmentData = JSON.parse(segmentIndexContent)
      hasVideoSegments = true

      // Create a map from transcript segment index to video segment index
      // The segments in index.json should align with transcript segments
      if (segmentData.segments && data.transcript?.segments) {
        // Match segments by start time
        data.transcript.segments.forEach((tSeg: any, tIndex: number) => {
          const matchingSegment = segmentData.segments.find(
            (sSeg: any) => Math.abs(sSeg.start - tSeg.start) < 0.5, // Within 0.5 seconds
          )
          if (matchingSegment) {
            segmentIndexMap[tIndex] = matchingSegment.index
          }
        })
      }

      log.debug({ segmentCount: segmentData.segments?.length, hasVideoSegments }, 'Found video segments')
    } catch (_error) {
      log.debug({ episodeId }, 'No video segments found')
    }

    // Extract a shorter episode name
    let episodeName = episodeId
    const match = episodeId.match(/S\d+E\d+.*$/)
    if (match) {
      episodeName = match[0]
    } else if (data.metadata?.input_file) {
      const filename = path.basename(data.metadata.input_file)
      const nameMatch = filename.match(/S\d+E\d+[^.]*/) || filename.match(/([^/\\]+)\.(mkv|mp4|avi)/)
      if (nameMatch) {
        episodeName = nameMatch[1] || nameMatch[0].replace(/\.(mkv|mp4|avi)$/, '')
      }
    }

    // Add segment indices to transcript segments
    if (data.transcript?.segments) {
      data.transcript.segments = data.transcript.segments.map((seg: any, index: number) => ({
        ...seg,
        segmentIndex: segmentIndexMap[index] !== undefined ? segmentIndexMap[index] : index,
      }))
    }

    // Return the episode data with processed frame paths
    res.json({
      id: episodeId,
      name: episodeName,
      hasVideoSegments,
      ...data,
    })
  } catch (error) {
    log.error({ error, episodeId: req.params.episodeId }, 'Error fetching episode')
    res.status(500).json({ error: 'Failed to fetch episode data' })
  }
})

export default router
