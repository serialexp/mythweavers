import { createHash } from 'node:crypto'
import { promises as fs, createReadStream, createWriteStream } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { MultipartFile } from '@fastify/multipart'
import sharp from 'sharp'

// Configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export interface FileMetadata {
  path: string // Relative path from upload root
  localPath: string // Absolute path on filesystem
  sha256: string
  mimeType: string
  bytes: number
  width: number | null
  height: number | null
}

/**
 * Calculate SHA256 hash of a file
 */
async function calculateSHA256(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  const stream = createReadStream(filePath)

  await pipeline(stream, hash)

  return hash.digest('hex')
}

/**
 * Get image dimensions using sharp
 */
async function getImageDimensions(
  filePath: string,
  mimeType: string,
): Promise<{ width: number | null; height: number | null }> {
  // Only get dimensions for images
  if (!mimeType.startsWith('image/')) {
    return { width: null, height: null }
  }

  try {
    const metadata = await sharp(filePath).metadata()
    return {
      width: metadata.width || null,
      height: metadata.height || null,
    }
  } catch (error) {
    // If sharp fails (corrupted image, etc.), return null
    console.warn('Failed to get image dimensions:', error)
    return { width: null, height: null }
  }
}

/**
 * Create organized directory structure for user uploads
 * Format: /uploads/{ownerId}/{year}/{month}/
 */
function createUploadPath(ownerId: number): string {
  const now = new Date()
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')

  return path.join(UPLOAD_DIR, ownerId.toString(), year, month)
}

/**
 * Generate unique filename to avoid collisions
 */
function generateUniqueFilename(originalFilename: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = path.extname(originalFilename)
  const base = path.basename(originalFilename, ext)
  const sanitized = base.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50)

  return `${sanitized}-${timestamp}-${random}${ext}`
}

/**
 * Validate file before processing
 */
export function validateFile(file: MultipartFile): void {
  // Check mime type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error(`Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`)
  }

  // Note: Size validation happens during streaming in saveFile
}

/**
 * Save uploaded file to organized directory structure
 * Returns file metadata including SHA256 hash and dimensions
 */
export async function saveFile(file: MultipartFile, ownerId: number): Promise<FileMetadata> {
  // Validate file
  validateFile(file)

  // Create upload directory
  const uploadPath = createUploadPath(ownerId)
  await fs.mkdir(uploadPath, { recursive: true })

  // Generate unique filename
  const filename = generateUniqueFilename(file.filename)
  const localPath = path.join(uploadPath, filename)

  // Calculate relative path from upload root
  const relativePath = path.relative(UPLOAD_DIR, localPath)

  // Stream file to disk with size limit
  let bytesWritten = 0
  const fileStream = createWriteStream(localPath)

  try {
    for await (const chunk of file.file) {
      bytesWritten += chunk.length

      if (bytesWritten > MAX_FILE_SIZE) {
        // Stop writing and clean up
        fileStream.destroy()
        await fs.unlink(localPath).catch(() => {})
        throw new Error(`File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`)
      }

      fileStream.write(chunk)
    }

    fileStream.end()

    // Wait for stream to finish
    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve)
      fileStream.on('error', reject)
    })
  } catch (error) {
    // Clean up on error
    await fs.unlink(localPath).catch(() => {})
    throw error
  }

  // Calculate SHA256 hash
  const sha256 = await calculateSHA256(localPath)

  // Get image dimensions
  const { width, height } = await getImageDimensions(localPath, file.mimetype)

  return {
    path: `/files/${relativePath}`,
    localPath,
    sha256,
    mimeType: file.mimetype,
    bytes: bytesWritten,
    width,
    height,
  }
}

/**
 * Delete file from filesystem
 */
export async function deleteFile(localPath: string): Promise<void> {
  try {
    await fs.unlink(localPath)
  } catch (error) {
    // Ignore if file doesn't exist
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

/**
 * Check if file exists on filesystem
 */
export async function fileExists(localPath: string): Promise<boolean> {
  try {
    await fs.access(localPath)
    return true
  } catch {
    return false
  }
}

/**
 * Get upload directory path
 */
export function getUploadDir(): string {
  return UPLOAD_DIR
}
