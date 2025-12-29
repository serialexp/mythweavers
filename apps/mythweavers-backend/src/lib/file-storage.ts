import { createHash } from 'node:crypto'
import { promises as fs, createReadStream, createWriteStream } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { MultipartFile } from '@fastify/multipart'
import sharp from 'sharp'
import {
  type StorageVisibility,
  deleteFromR2,
  generateStorageKey,
  getFromR2,
  isR2Configured,
  putToR2,
} from './r2-storage.js'

// Configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

// Use R2 if configured, otherwise fall back to local storage
const USE_R2 = isR2Configured()

export interface FileMetadata {
  path: string // URL path to access the file
  localPath: string | null // Absolute path on filesystem (null for R2)
  r2Key: string | null // R2 object key (null for local storage)
  visibility: StorageVisibility // 'public' or 'private'
  sha256: string
  mimeType: string
  bytes: number
  width: number | null
  height: number | null
}

/**
 * Calculate SHA256 hash of a buffer
 */
function calculateSHA256FromBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Calculate SHA256 hash of a file on disk
 */
async function calculateSHA256FromFile(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  const stream = createReadStream(filePath)

  await pipeline(stream, hash)

  return hash.digest('hex')
}

/**
 * Get image dimensions using sharp
 */
async function getImageDimensions(
  input: string | Buffer,
  mimeType: string,
): Promise<{ width: number | null; height: number | null }> {
  // Only get dimensions for images
  if (!mimeType.startsWith('image/')) {
    return { width: null, height: null }
  }

  try {
    const metadata = await sharp(input).metadata()
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
 * Generate filename using content hash for natural deduplication
 * Same content + same month = same path = no duplicate upload
 */
function generateFilename(originalFilename: string, contentHash: string): string {
  const ext = path.extname(originalFilename)
  const base = path.basename(originalFilename, ext)
  const sanitized = base.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50)
  // Use first 12 chars of hash - provides 48 bits of uniqueness
  const hashPrefix = contentHash.substring(0, 12)

  return `${sanitized}-${hashPrefix}${ext}`
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
 * Save uploaded file to R2 or local filesystem
 * Returns file metadata including SHA256 hash and dimensions
 */
export async function saveFile(
  file: MultipartFile,
  ownerId: number,
  visibility: StorageVisibility = 'private',
): Promise<FileMetadata> {
  // Validate file
  validateFile(file)

  // Read file into buffer (we need it for hashing and dimensions anyway)
  const chunks: Buffer[] = []
  let totalBytes = 0

  for await (const chunk of file.file) {
    totalBytes += chunk.length

    if (totalBytes > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }

    chunks.push(chunk)
  }

  const buffer = Buffer.concat(chunks)

  // Calculate SHA256 hash
  const sha256 = calculateSHA256FromBuffer(buffer)

  // Get image dimensions
  const { width, height } = await getImageDimensions(buffer, file.mimetype)

  // Generate filename using content hash for deduplication
  const filename = generateFilename(file.filename, sha256)

  if (USE_R2) {
    // Upload to R2
    const key = generateStorageKey(ownerId, filename)
    const result = await putToR2(key, buffer, file.mimetype, visibility)

    return {
      path: result.url,
      localPath: null,
      r2Key: key,
      visibility,
      sha256,
      mimeType: file.mimetype,
      bytes: result.bytes,
      width,
      height,
    }
  }

  // Fall back to local storage
  const uploadPath = createUploadPath(ownerId)
  await fs.mkdir(uploadPath, { recursive: true })

  const localPath = path.join(uploadPath, filename)
  await fs.writeFile(localPath, buffer)

  const relativePath = path.relative(UPLOAD_DIR, localPath)

  return {
    path: `/my/files/${relativePath}`,
    localPath,
    r2Key: null,
    visibility,
    sha256,
    mimeType: file.mimetype,
    bytes: buffer.length,
    width,
    height,
  }
}

/**
 * Save a raw buffer to storage (for migration, etc.)
 */
export async function saveBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  ownerId: number,
  visibility: StorageVisibility = 'private',
): Promise<FileMetadata> {
  // Calculate SHA256 hash
  const sha256 = calculateSHA256FromBuffer(buffer)

  // Get image dimensions
  const { width, height } = await getImageDimensions(buffer, mimeType)

  // Generate filename using content hash for deduplication
  const uniqueFilename = generateFilename(filename, sha256)

  if (USE_R2) {
    // Upload to R2
    const key = generateStorageKey(ownerId, uniqueFilename)
    const result = await putToR2(key, buffer, mimeType, visibility)

    return {
      path: result.url,
      localPath: null,
      r2Key: key,
      visibility,
      sha256,
      mimeType,
      bytes: result.bytes,
      width,
      height,
    }
  }

  // Fall back to local storage
  const uploadPath = createUploadPath(ownerId)
  await fs.mkdir(uploadPath, { recursive: true })

  const localPath = path.join(uploadPath, uniqueFilename)
  await fs.writeFile(localPath, buffer)

  const relativePath = path.relative(UPLOAD_DIR, localPath)

  return {
    path: `/my/files/${relativePath}`,
    localPath,
    r2Key: null,
    visibility,
    sha256,
    mimeType,
    bytes: buffer.length,
    width,
    height,
  }
}

/**
 * Delete file from storage (R2 or local filesystem)
 */
export async function deleteFile(
  localPath: string | null,
  r2Key: string | null,
  visibility: StorageVisibility = 'private',
): Promise<void> {
  if (r2Key) {
    // Delete from R2
    await deleteFromR2(r2Key, visibility)
  } else if (localPath) {
    // Delete from local filesystem
    try {
      await fs.unlink(localPath)
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }
}

/**
 * Get file stream from storage (R2 or local filesystem)
 */
export async function getFileStream(
  localPath: string | null,
  r2Key: string | null,
  visibility: StorageVisibility = 'private',
): Promise<{
  stream: NodeJS.ReadableStream
  contentType?: string
  contentLength?: number
}> {
  if (r2Key) {
    // Get from R2
    const result = await getFromR2(r2Key, visibility)
    return {
      stream: result.body,
      contentType: result.contentType,
      contentLength: result.contentLength,
    }
  }

  if (localPath) {
    // Get from local filesystem
    const stats = await fs.stat(localPath)
    return {
      stream: createReadStream(localPath),
      contentLength: stats.size,
    }
  }

  throw new Error('No file path or R2 key provided')
}

/**
 * Check if file exists in storage
 */
export async function fileExists(localPath: string | null, r2Key: string | null): Promise<boolean> {
  if (r2Key) {
    // Check in R2
    const { existsInR2 } = await import('./r2-storage.js')
    return existsInR2(r2Key)
  }

  if (localPath) {
    // Check local filesystem
    try {
      await fs.access(localPath)
      return true
    } catch {
      return false
    }
  }

  return false
}

/**
 * Get upload directory path (for local storage)
 */
export function getUploadDir(): string {
  return UPLOAD_DIR
}

/**
 * Check if R2 storage is being used
 */
export function isUsingR2(): boolean {
  return USE_R2
}
