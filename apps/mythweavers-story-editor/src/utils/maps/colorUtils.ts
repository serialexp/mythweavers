/**
 * Parse color string to hex number for PIXI.js
 */
export function parseColorToHex(colorString: string): number {
  if (!colorString) return 0x000000

  try {
    if (colorString.startsWith('#')) {
      // Remove # and parse as hex
      const hexString = colorString.replace('#', '')
      return Number.parseInt(hexString, 16)
    }
    // Handle named colors by using a temporary canvas
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = colorString
      const computedColor = ctx.fillStyle
      if (computedColor.startsWith('#')) {
        const hexString = computedColor.replace('#', '')
        return Number.parseInt(hexString, 16)
      }
    }
  } catch (e) {
    console.error('Error parsing color:', e)
  }

  return 0x000000
}

/**
 * Colored landmark for overlay rendering
 */
export interface ColoredLandmark {
  x: number
  y: number
  color: number
  name: string
}
