import { getApiBaseUrl } from '../client/config'

/**
 * Result of uploading an image to the backend `/my/files` endpoint.
 *
 * `path` is a relative URL (e.g. `/files/1/2025/12/cover.png`) — resolve
 * against `getApiBaseUrl()` (or use {@link resolveStoryImageUrl}) before
 * setting it as an `<img src>`.
 */
export interface UploadedStoryImage {
  id: string
  path: string
}

/**
 * Upload a single image file to `POST /my/files` (multipart) and return the
 * `{ id, path }` of the resulting File row. Used by both story/book cover-art
 * pickers and per-message background pickers.
 *
 * - `storyId` scopes the file to a story (so `/my/files` can dedupe + list
 *   images per story). Pass undefined when uploading a globally-owned file.
 * - Network/HTTP failures surface as `Error`s with the response body text
 *   when available — callers should catch and present to the user.
 */
export async function uploadStoryImage(file: File, storyId?: string): Promise<UploadedStoryImage> {
  const formData = new FormData()
  formData.append('file', file, file.name)
  if (storyId) formData.append('storyId', storyId)

  const response = await fetch(`${getApiBaseUrl()}/my/files`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `Upload failed (HTTP ${response.status})`)
  }

  const result = await response.json()
  const id: string | undefined = result?.file?.id
  const path: string | undefined = result?.file?.path
  if (!id || !path) {
    throw new Error('Upload response missing file id or path')
  }
  return { id, path }
}

/**
 * Resolve a relative image path returned by the backend (`/files/...`) to an
 * absolute URL using the configured API base. Pass-through for absolute URLs
 * and null for null/undefined.
 */
export function resolveStoryImageUrl(urlPath: string | null | undefined): string | null {
  if (!urlPath) return null
  if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) return urlPath
  return `${getApiBaseUrl()}${urlPath}`
}
