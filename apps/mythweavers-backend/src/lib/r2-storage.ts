import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import type { Readable } from 'node:stream'

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || ''
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || ''
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || ''

// Bucket names
const PUBLIC_BUCKET = process.env.R2_PUBLIC_BUCKET || 'writer2'
const PRIVATE_BUCKET = process.env.R2_PRIVATE_BUCKET || 'writer2-authenticated'

// Public bucket URL for direct access
const PUBLIC_BUCKET_URL = process.env.R2_PUBLIC_BUCKET_URL || `https://pub-${R2_ACCOUNT_ID}.r2.dev`

// Check if R2 is configured
export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY)
}

// Create S3 client for R2
function createR2Client(): S3Client {
  if (!isR2Configured()) {
    throw new Error('R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.')
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })
}

// Lazy-initialized client
let r2Client: S3Client | null = null

function getR2Client(): S3Client {
  if (!r2Client) {
    r2Client = createR2Client()
  }
  return r2Client
}

export type StorageVisibility = 'public' | 'private'

export interface R2UploadResult {
  key: string // Object key in the bucket
  bucket: string // Which bucket it's in
  visibility: StorageVisibility
  url: string // URL to access the file (direct for public, API path for private)
  bytes: number
}

/**
 * Upload a file to R2
 *
 * @param key - Object key (path in bucket)
 * @param body - File content as Buffer or Readable stream
 * @param mimeType - MIME type of the file
 * @param visibility - 'public' or 'private'
 * @returns Upload result with URL
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Readable,
  mimeType: string,
  visibility: StorageVisibility = 'private',
): Promise<R2UploadResult> {
  const client = getR2Client()
  const bucket = visibility === 'public' ? PUBLIC_BUCKET : PRIVATE_BUCKET

  // For large files, use multipart upload
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
    },
  })

  await upload.done()

  // Get file size
  const headResponse = await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  )

  const bytes = headResponse.ContentLength || 0

  // Generate URL based on visibility
  const url = visibility === 'public' ? `${PUBLIC_BUCKET_URL}/${key}` : `/my/files/${key}`

  return {
    key,
    bucket,
    visibility,
    url,
    bytes,
  }
}

/**
 * Upload a file to R2 using a simple PUT (for smaller files)
 */
export async function putToR2(
  key: string,
  body: Buffer,
  mimeType: string,
  visibility: StorageVisibility = 'private',
): Promise<R2UploadResult> {
  const client = getR2Client()
  const bucket = visibility === 'public' ? PUBLIC_BUCKET : PRIVATE_BUCKET

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
    }),
  )

  const url = visibility === 'public' ? `${PUBLIC_BUCKET_URL}/${key}` : `/my/files/${key}`

  return {
    key,
    bucket,
    visibility,
    url,
    bytes: body.length,
  }
}

/**
 * Get a file from R2
 *
 * @param key - Object key
 * @param visibility - Which bucket to get from
 * @returns File stream and metadata
 */
export async function getFromR2(
  key: string,
  visibility: StorageVisibility = 'private',
): Promise<{
  body: Readable
  contentType: string | undefined
  contentLength: number | undefined
}> {
  const client = getR2Client()
  const bucket = visibility === 'public' ? PUBLIC_BUCKET : PRIVATE_BUCKET

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  )

  return {
    body: response.Body as Readable,
    contentType: response.ContentType,
    contentLength: response.ContentLength,
  }
}

/**
 * Delete a file from R2
 *
 * @param key - Object key
 * @param visibility - Which bucket to delete from
 */
export async function deleteFromR2(key: string, visibility: StorageVisibility = 'private'): Promise<void> {
  const client = getR2Client()
  const bucket = visibility === 'public' ? PUBLIC_BUCKET : PRIVATE_BUCKET

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  )
}

/**
 * Check if a file exists in R2
 */
export async function existsInR2(key: string, visibility: StorageVisibility = 'private'): Promise<boolean> {
  const client = getR2Client()
  const bucket = visibility === 'public' ? PUBLIC_BUCKET : PRIVATE_BUCKET

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    )
    return true
  } catch (error) {
    if ((error as { name?: string }).name === 'NotFound') {
      return false
    }
    throw error
  }
}

/**
 * Generate a key for storing a file
 * Format: {ownerId}/{year}/{month}/{filename}
 */
export function generateStorageKey(ownerId: number, filename: string): string {
  const now = new Date()
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')

  return `${ownerId}/${year}/${month}/${filename}`
}
