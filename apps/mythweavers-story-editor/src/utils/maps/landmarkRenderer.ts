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

// Extended LandmarkSprite interface
export interface LandmarkSprite extends PIXI.Graphics {
  landmarkData?: Landmark
  labelText?: PIXI.Text
  baseScale?: number // Store the current zoom-based scale
}

/**
 * Options for creating landmark sprites
 */
export interface LandmarkRenderOptions {
  borderColor?: string
  parseColorToHex: (color: string) => number
  onPointerDown?: (landmark: Landmark, e: PIXI.FederatedPointerEvent) => void
  shouldStopPropagation?: boolean
  interactive?: boolean
}

/**
 * Create a landmark sprite with all visual elements and interactions
 */
export function createLandmarkSprite(landmark: Landmark, options: LandmarkRenderOptions): LandmarkSprite {
  const sprite = new PIXI.Graphics() as LandmarkSprite
  sprite.landmarkData = { ...landmark }

  // Use smaller radius for junctions
  const radius = landmark.type === 'junction' ? JUNCTION_RADIUS : SIZE_MAP[landmark.size || 'medium']
  sprite.clear()

  // Draw border if provided
  const hasBorderColor = options.borderColor && options.borderColor !== ''
  if (hasBorderColor) {
    const borderColorHex = options.parseColorToHex(options.borderColor!)

    // White border ring
    sprite.circle(0, 0, radius - 1).stroke({ width: 2, color: 0xffffff, alpha: 1 })

    sprite.circle(0, 0, radius - 1).fill({ color: borderColorHex })
  }

  // Draw main pin circle
  const color = Number.parseInt(landmark.color?.replace('#', '') || '3498db', 16)
  const innerRadius = hasBorderColor ? radius - 3 : radius

  sprite.circle(0, 0, innerRadius).stroke({ width: 1, color: 0xffffff, alpha: 0.5 }).fill({ color })

  // Add type-specific overlays
  drawTypeOverlay(sprite, landmark.type || 'system', radius, color)

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
