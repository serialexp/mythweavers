import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { Router } from 'express'
import { createLogger } from '../../lib/logger'

const router = Router()
const log = createLogger('episodes')

// GET all analyzed episodes
router.get('/episodes', async (_req, res) => {
  try {
    // Get the episodes directory from environment variable or use default
    const episodesDir = process.env.EPISODES_DIR || '/home/bart/Projects/video-analyzer/output'

    log.debug({ episodesDir }, 'Scanning episodes directory')

    // Check if directory exists
    try {
      await fs.access(episodesDir)
    } catch (_error) {
      log.warn({ episodesDir }, 'Episodes directory does not exist')
      res.json([])
    }

    // Read all entries in the directory
    const entries = await fs.readdir(episodesDir, { withFileTypes: true })

    // Filter for JSON files and extract metadata
    const episodes = []

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const filePath = path.join(episodesDir, entry.name)

        try {
          // Read the JSON file to get metadata
          const content = await fs.readFile(filePath, 'utf-8')
          const data = JSON.parse(content)

          // Extract episode name from filename or metadata
          let episodeName = entry.name.replace('.json', '')

          // Try to extract a shorter name (e.g., S01E02 Rising Malevolence)
          const match = episodeName.match(/S\d+E\d+.*$/)
          if (match) {
            episodeName = match[0]
          } else {
            // Try to extract from input_file in metadata
            if (data.metadata?.input_file) {
              const filename = path.basename(data.metadata.input_file)
              const nameMatch = filename.match(/S\d+E\d+[^.]*/) || filename.match(/([^/\\]+)\.(mkv|mp4|avi)/)
              if (nameMatch) {
                episodeName = nameMatch[1] || nameMatch[0].replace(/\.(mkv|mp4|avi)$/, '')
              }
            }
          }

          // Get file stats
          const stats = await fs.stat(filePath)

          episodes.push({
            id: entry.name.replace('.json', ''),
            name: episodeName,
            filename: entry.name,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            size: stats.size,
            frameCount: data.metadata?.frames_extracted || 0,
            duration: data.metadata?.duration_processed,
            hasTranscript: data.metadata?.transcription_successful || false,
            hasSpeakers: data.metadata?.speaker_diarization || false,
          })
        } catch (error) {
          log.error({ filename: entry.name, error }, 'Failed to parse episode JSON')
        }
      }
    }

    // Sort by modified date (newest first)
    episodes.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())

    log.info({ count: episodes.length }, 'Found episodes')
    res.json(episodes)
  } catch (error) {
    log.error({ error }, 'Error fetching episodes')
    res.status(500).json({ error: 'Failed to fetch episodes' })
  }
})

export default router
