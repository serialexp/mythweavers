import * as PIXI from 'pixi.js'
import { Landmark } from '../../types/core'

// Size mapping for landmarks
const SIZE_MAP = {
  small: 8,
  medium: 12,
  large: 16,
}

// Junctions are even smaller
const JUNCTION_RADIUS = 4

// Texture cache for landmark sprites - key is `${color}-${size}-${type}-${borderColor}`
const textureCache = new Map<string, PIXI.Texture>()

// Get or create a cached texture for a landmark appearance
function getOrCreateLandmarkTexture(
  app: PIXI.Application,
  color: string,
  size: 'small' | 'medium' | 'large',
  type: 'system' | 'station' | 'nebula' | 'junction',
  borderColor: string | undefined,
  parseColorToHex: (color: string) => number,
): PIXI.Texture {
  const cacheKey = `${color}-${size}-${type}-${borderColor || 'none'}`

  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!
  }

  // Create a temporary graphics object to draw the landmark
  const graphics = new PIXI.Graphics()
  const radius = type === 'junction' ? JUNCTION_RADIUS : SIZE_MAP[size]

  // Draw border if provided
  const hasBorderColor = borderColor && borderColor !== ''
  if (hasBorderColor) {
    const borderColorHex = parseColorToHex(borderColor!)
    graphics.circle(0, 0, radius - 1).stroke({ width: 2, color: 0xffffff, alpha: 1 })
    graphics.circle(0, 0, radius - 1).fill({ color: borderColorHex })
  }

  // Draw main pin circle
  const colorHex = Number.parseInt(color?.replace('#', '') || '3498db', 16)
  const innerRadius = hasBorderColor ? radius - 3 : radius
  graphics.circle(0, 0, innerRadius).stroke({ width: 1, color: 0xffffff, alpha: 0.5 }).fill({ color: colorHex })

  // Add type-specific overlays
  drawTypeOverlay(graphics, type, radius, colorHex)

  // Calculate bounds for the texture (add padding for borders and overlays)
  const padding = 4
  const maxRadius = radius + padding
  const textureSize = maxRadius * 2

  // Render to texture
  const renderTexture = PIXI.RenderTexture.create({
    width: textureSize,
    height: textureSize,
    resolution: window.devicePixelRatio || 1,
  })

  // Position graphics at center of texture
  graphics.x = maxRadius
  graphics.y = maxRadius

  // Create a temporary container to render
  const container = new PIXI.Container()
  container.addChild(graphics)

  app.renderer.render({
    container,
    target: renderTexture,
  })

  // Clean up the temporary graphics
  graphics.destroy()
  container.destroy()

  // Cache and return the texture
  textureCache.set(cacheKey, renderTexture)
  return renderTexture
}

// Clear the texture cache (call when switching maps or cleaning up)
export function clearLandmarkTextureCache(): void {
  for (const texture of textureCache.values()) {
    texture.destroy(true)
  }
  textureCache.clear()
}

// Extended LandmarkSprite interface - now extends Sprite instead of Graphics
export interface LandmarkSprite extends PIXI.Sprite {
  landmarkData?: Landmark
  labelText?: PIXI.Text
  baseScale?: number // Store the current zoom-based scale
  cacheKey?: string // Track which texture this sprite uses
}

/**
 * Options for creating landmark sprites
 */
export interface LandmarkRenderOptions {
  app: PIXI.Application // Required for texture rendering
  borderColor?: string
  parseColorToHex: (color: string) => number
  onPointerDown?: (landmark: Landmark, e: PIXI.FederatedPointerEvent) => void
  shouldStopPropagation?: boolean
  interactive?: boolean
}

/**
 * Create a landmark sprite with all visual elements and interactions
 * Uses cached textures for better performance with many landmarks
 */
export function createLandmarkSprite(landmark: Landmark, options: LandmarkRenderOptions): LandmarkSprite {
  const color = landmark.color || '#3498db'
  const size = landmark.size || 'medium'
  const type = (landmark.type || 'system') as 'system' | 'station' | 'nebula' | 'junction'

  // Get or create cached texture
  const texture = getOrCreateLandmarkTexture(
    options.app,
    color,
    size,
    type,
    options.borderColor,
    options.parseColorToHex,
  )

  // Create sprite from texture
  const sprite = new PIXI.Sprite(texture) as LandmarkSprite
  sprite.anchor.set(0.5, 0.5) // Center the sprite
  sprite.landmarkData = { ...landmark }
  sprite.cacheKey = `${color}-${size}-${type}-${options.borderColor || 'none'}`

  // Set initial appearance
  sprite.alpha = 0.8
  sprite.baseScale = 1 // Initialize base scale

  // Make interactive (or not, depending on options)
  const isInteractive = options.interactive !== undefined ? options.interactive : true
  sprite.eventMode = isInteractive ? 'static' : 'none'
  sprite.cursor = isInteractive ? 'pointer' : 'default'

  // Only add hover effects and click handlers if interactive
  if (isInteractive) {
    // Add hover effects
    const hoverMultiplier = 1.2

    sprite.on('pointerover', () => {
      const baseScale = sprite.baseScale || 1
      sprite.scale.set(baseScale * hoverMultiplier, baseScale * hoverMultiplier)
      sprite.alpha = 1
      if (sprite.labelText) {
        sprite.labelText.visible = true
      }
    })

    sprite.on('pointerout', () => {
      const baseScale = sprite.baseScale || 1
      sprite.scale.set(baseScale, baseScale)
      sprite.alpha = 0.8
      if (sprite.labelText) {
        sprite.labelText.visible = false
      }
    })

    // Handle click if callback provided
    if (options.onPointerDown) {
      sprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        // Only stop propagation if shouldStopPropagation is true (default is true for backward compatibility)
        const shouldStop = options.shouldStopPropagation !== undefined ? options.shouldStopPropagation : true
        if (shouldStop) {
          e.stopPropagation()
          if ('preventDefault' in e) {
            ;(e as any).preventDefault()
          }
        }
        options.onPointerDown!(landmark, e)
      })
    }
  }

  return sprite
}

/**
 * Update a landmark sprite's texture if its appearance changed
 */
export function updateLandmarkSpriteTexture(
  sprite: LandmarkSprite,
  landmark: Landmark,
  options: LandmarkRenderOptions,
): void {
  const color = landmark.color || '#3498db'
  const size = landmark.size || 'medium'
  const type = (landmark.type || 'system') as 'system' | 'station' | 'nebula' | 'junction'
  const newCacheKey = `${color}-${size}-${type}-${options.borderColor || 'none'}`

  // Only update texture if appearance changed
  if (sprite.cacheKey !== newCacheKey) {
    const texture = getOrCreateLandmarkTexture(
      options.app,
      color,
      size,
      type,
      options.borderColor,
      options.parseColorToHex,
    )
    sprite.texture = texture
    sprite.cacheKey = newCacheKey
  }

  // Update landmark data
  sprite.landmarkData = { ...landmark }
}

/**
 * Draw type-specific overlay on landmark sprite
 */
function drawTypeOverlay(
  sprite: PIXI.Graphics,
  type: 'system' | 'station' | 'nebula' | 'junction',
  radius: number,
  color: number,
): void {
  if (type === 'station') {
    // Vertical bar for stations
    const barWidth = Math.max(2, radius / 3)
    const barHeight = radius * 2.2

    // White outline
    sprite
      .rect(-barWidth / 2 - 1, -barHeight / 2 - 1, barWidth + 2, barHeight + 2)
      .fill({ color: 0xffffff, alpha: 0.8 })

    // Colored bar
    sprite.rect(-barWidth / 2, -barHeight / 2, barWidth, barHeight).fill({ color })
  } else if (type === 'nebula') {
    // Three horizontal bars for nebula
    const barHeight = Math.max(2, radius / 4)
    const middleBarWidth = radius * 1.92
    const outerBarWidth = radius * 1.44
    const barSpacing = radius * 0.5

    // Top bar
    sprite
      .rect(-outerBarWidth / 2 - 1, -barSpacing - barHeight / 2 - 1, outerBarWidth + 2, barHeight + 2)
      .fill({ color: 0xffffff, alpha: 0.8 })
    sprite.rect(-outerBarWidth / 2, -barSpacing - barHeight / 2, outerBarWidth, barHeight).fill({ color })

    // Middle bar
    sprite
      .rect(-middleBarWidth / 2 - 1, -barHeight / 2 - 1, middleBarWidth + 2, barHeight + 2)
      .fill({ color: 0xffffff, alpha: 0.8 })
    sprite.rect(-middleBarWidth / 2, -barHeight / 2, middleBarWidth, barHeight).fill({ color })

    // Bottom bar
    sprite
      .rect(-outerBarWidth / 2 - 1, barSpacing - barHeight / 2 - 1, outerBarWidth + 2, barHeight + 2)
      .fill({ color: 0xffffff, alpha: 0.8 })
    sprite.rect(-outerBarWidth / 2, barSpacing - barHeight / 2, outerBarWidth, barHeight).fill({ color })
  }
  // System type has no overlay
}

/**
 * Create label text for a landmark
 */
export function createLabelText(landmark: Landmark, radius: number): PIXI.Text {
  const labelText = new PIXI.Text(landmark.name, {
    fontSize: 14,
    fill: 0xffffff,
    stroke: {
      color: 0x000000,
      width: 3,
    },
    fontWeight: 'bold',
    align: 'center',
  })

  labelText.anchor.set(0.5, 1)
  labelText.y = -radius - 8
  labelText.visible = false

  return labelText
}

/**
 * Position landmark sprite and label on the map
 */
export function positionLandmark(
  sprite: LandmarkSprite,
  landmark: Landmark,
  mapWidth: number,
  mapHeight: number,
): void {
  sprite.x = landmark.x * mapWidth
  sprite.y = landmark.y * mapHeight

  if (sprite.labelText) {
    sprite.labelText.x = sprite.x
    sprite.labelText.y = sprite.y - SIZE_MAP[landmark.size || 'medium'] - 8
  }
}

/**
 * Check if two landmarks have different visual properties
 */
export function landmarkHasChanged(oldData: Landmark, newData: Landmark): boolean {
  return (
    oldData.name !== newData.name ||
    oldData.description !== newData.description ||
    oldData.color !== newData.color ||
    oldData.size !== newData.size ||
    oldData.x !== newData.x ||
    oldData.y !== newData.y ||
    oldData.type !== newData.type
  )
}

/**
 * Draw preview sprite for placement
 */
export function drawPreviewSprite(
  sprite: PIXI.Graphics,
  type: 'system' | 'station' | 'nebula' | 'junction',
  size: 'small' | 'medium' | 'large',
  color: string,
  alpha = 0.6,
): void {
  const radius = SIZE_MAP[size]
  const colorHex = Number.parseInt(color.replace('#', '') || '3498db', 16)

  sprite.clear()

  // Pulsing outline
  sprite.lineStyle(2, 0xffffff, 0.8)
  sprite.drawCircle(0, 0, radius + 3)

  // Semi-transparent preview
  sprite.beginFill(colorHex, alpha)
  sprite.drawCircle(0, 0, radius)
  sprite.endFill()

  // Add type-specific overlay
  drawTypeOverlay(sprite, type, radius, colorHex)
}
