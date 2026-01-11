export interface CropParams {
  /** The image element to crop */
  image: HTMLImageElement
  /** Current zoom level */
  zoom: number
  /** Pan offset from center */
  offset: { x: number; y: number }
  /** Viewport width */
  viewportWidth: number
  /** Viewport height */
  viewportHeight: number
  /** Output width in pixels */
  outputWidth: number
  /** Output height in pixels */
  outputHeight: number
  /** Output format */
  format: 'image/jpeg' | 'image/png' | 'image/webp'
  /** Output quality (0-1) */
  quality: number
}

/**
 * Crop an image based on current zoom and pan offset.
 * Returns a base64 data URL of the cropped image.
 */
export function cropImage(params: CropParams): string {
  const {
    image,
    zoom,
    offset,
    viewportWidth,
    viewportHeight,
    outputWidth,
    outputHeight,
    format,
    quality,
  } = params

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Failed to get canvas 2d context')
  }

  // Calculate the scaled image dimensions
  const scaledWidth = image.naturalWidth * zoom
  const scaledHeight = image.naturalHeight * zoom

  // Calculate where the image is positioned relative to viewport center
  const imageX = (viewportWidth - scaledWidth) / 2 + offset.x
  const imageY = (viewportHeight - scaledHeight) / 2 + offset.y

  // Calculate what portion of the image is visible in the viewport
  // The viewport represents the crop area
  const sourceX = -imageX / zoom
  const sourceY = -imageY / zoom
  const sourceWidth = viewportWidth / zoom
  const sourceHeight = viewportHeight / zoom

  // Draw the cropped portion onto the canvas
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight
  )

  return canvas.toDataURL(format, quality)
}

/**
 * Calculate the minimum zoom level to ensure the image covers the entire viewport.
 */
export function calculateMinZoom(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number
): number {
  const widthRatio = viewportWidth / imageWidth
  const heightRatio = viewportHeight / imageHeight
  // Return the larger ratio to ensure full coverage
  return Math.max(widthRatio, heightRatio)
}

/**
 * Clamp offset to ensure the image always covers the viewport.
 */
export function clampOffset(
  offset: { x: number; y: number },
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number
): { x: number; y: number } {
  const scaledWidth = imageWidth * zoom
  const scaledHeight = imageHeight * zoom

  // Calculate the maximum offset allowed in each direction
  // This is the distance from the centered position to where the edge would leave the viewport
  const maxOffsetX = Math.max(0, (scaledWidth - viewportWidth) / 2)
  const maxOffsetY = Math.max(0, (scaledHeight - viewportHeight) / 2)

  return {
    x: Math.max(-maxOffsetX, Math.min(maxOffsetX, offset.x)),
    y: Math.max(-maxOffsetY, Math.min(maxOffsetY, offset.y)),
  }
}

/**
 * Calculate the distance between two touch points.
 */
export function getTouchDistance(touch1: Touch, touch2: Touch): number {
  const dx = touch1.clientX - touch2.clientX
  const dy = touch1.clientY - touch2.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate the center point between two touches.
 */
export function getTouchCenter(
  touch1: Touch,
  touch2: Touch
): { x: number; y: number } {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  }
}
