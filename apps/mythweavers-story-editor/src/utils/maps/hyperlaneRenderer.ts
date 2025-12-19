/**
 * Hyperlane Rendering Utilities
 *
 * Functions for rendering hyperlane segments on the PIXI map
 */

import { GlowFilter } from 'pixi-filters'
import * as PIXI from 'pixi.js'
import { Hyperlane, HyperlaneSegment } from '../../types/core'

// Extended HyperlaneGraphics interface
export interface HyperlaneGraphics extends PIXI.Graphics {
  hyperlaneData?: Hyperlane
}

/**
 * Draw a single hyperlane segment
 */
export function drawHyperlaneSegment(
  graphics: PIXI.Graphics,
  segment: HyperlaneSegment,
  mapWidth: number,
  mapHeight: number,
  color = 0xffffff,
  alpha = 1.0,
  lineWidth = 2,
): void {
  const startWorldX = segment.startX * mapWidth
  const startWorldY = segment.startY * mapHeight
  const endWorldX = segment.endX * mapWidth
  const endWorldY = segment.endY * mapHeight

  graphics.moveTo(startWorldX, startWorldY)
  graphics.lineTo(endWorldX, endWorldY)
  graphics.stroke({ width: lineWidth, color, alpha })
}

/**
 * Calculate line width based on speed multiplier
 * Speed multiplier of 10 = 4px width (doubled from original 2px)
 * Scales proportionally: width = (speedMultiplier / 10) * 4
 */
function calculateLineWidth(speedMultiplier: number): number {
  return (speedMultiplier / 10) * 4
}

/**
 * Draw all segments of a hyperlane
 */
export function drawHyperlane(
  graphics: PIXI.Graphics,
  hyperlane: Hyperlane,
  mapWidth: number,
  mapHeight: number,
  color = 0xffffff,
  alpha = 1.0,
): void {
  // Calculate actual line width based on speed multiplier
  const actualLineWidth = calculateLineWidth(hyperlane.speedMultiplier)

  // Sort segments by order
  const sortedSegments = [...hyperlane.segments].sort((a, b) => a.order - b.order)

  for (const segment of sortedSegments) {
    drawHyperlaneSegment(graphics, segment, mapWidth, mapHeight, color, alpha, actualLineWidth)
  }
}

/**
 * Draw all hyperlanes on the map
 * Note: Line width is calculated internally based on each hyperlane's speedMultiplier
 */
export function drawAllHyperlanes(
  container: PIXI.Container,
  hyperlanes: Hyperlane[],
  mapWidth: number,
  mapHeight: number,
  color = 0x3b82f6, // Blue color by default
  alpha = 0.8,
  onHyperlaneClick?: (hyperlane: Hyperlane, screenPos: { x: number; y: number }) => void,
  interactive = true,
  shouldStopPropagation = true,
): void {
  // Clear existing hyperlane graphics
  container.removeChildren()

  // Draw each hyperlane
  for (const hyperlane of hyperlanes) {
    const graphics = new PIXI.Graphics() as HyperlaneGraphics
    graphics.hyperlaneData = hyperlane

    // Make interactive if click handler provided and interactive is true
    if (onHyperlaneClick && interactive) {
      graphics.eventMode = 'static'
      graphics.cursor = 'pointer'
      // Calculate line width for hit area tolerance (add extra padding for easier clicking)
      const lineWidth = calculateLineWidth(hyperlane.speedMultiplier)
      const hitTolerance = lineWidth + 10 // Base line width plus 10px padding
      graphics.hitArea = new PIXI.Polygon(getHyperlaneHitAreaPoints(hyperlane, mapWidth, mapHeight, hitTolerance))

      graphics.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        // Only handle left clicks
        if (e.button !== 0) return

        if (shouldStopPropagation) {
          e.stopPropagation()
          if ('preventDefault' in e) {
            ;(e as any).preventDefault()
          }
        }
        const screenPos = e.screen || e.global
        onHyperlaneClick(hyperlane, { x: screenPos.x, y: screenPos.y })
      })

      // Add hover glow effect
      graphics.on('pointerover', () => {
        // Create glow filter
        const glowFilter = new GlowFilter({
          distance: 15,
          outerStrength: 2,
          innerStrength: 1,
          color: 0x3b82f6,
          quality: 0.5,
        })
        graphics.filters = [glowFilter]
      })

      graphics.on('pointerout', () => {
        // Remove glow filter
        graphics.filters = null
      })
    } else {
      // Non-interactive
      graphics.eventMode = 'none'
    }

    // Draw hyperlane with blue color (line width calculated internally from speedMultiplier)
    drawHyperlane(graphics, hyperlane, mapWidth, mapHeight, color, alpha)

    container.addChild(graphics)

    // DEBUG: Draw hitbox polygon in yellow
    if (onHyperlaneClick && interactive) {
      const debugGraphics = new PIXI.Graphics()
      debugGraphics.eventMode = 'none' // Non-interactive
      const lineWidth = calculateLineWidth(hyperlane.speedMultiplier)
      const hitTolerance = lineWidth + 10
      const hitPoints = getHyperlaneHitAreaPoints(hyperlane, mapWidth, mapHeight, hitTolerance)

      debugGraphics.poly(hitPoints)
      debugGraphics.stroke({ width: 2, color: 0xffff00, alpha: 0.5 }) // Yellow outline
      debugGraphics.fill({ color: 0xffff00, alpha: 0.1 }) // Semi-transparent yellow fill

      container.addChild(debugGraphics)
    }
  }
}

/**
 * Get hit area points for a hyperlane (creates a wider clickable area)
 */
function getHyperlaneHitAreaPoints(
  hyperlane: Hyperlane,
  mapWidth: number,
  mapHeight: number,
  tolerance: number,
): number[] {
  const points: number[] = []
  const sortedSegments = [...hyperlane.segments].sort((a, b) => a.order - b.order)

  // Create a polygon around the hyperlane path with tolerance on each side
  for (let i = 0; i < sortedSegments.length; i++) {
    const segment = sortedSegments[i]
    const startWorldX = segment.startX * mapWidth
    const startWorldY = segment.startY * mapHeight
    const endWorldX = segment.endX * mapWidth
    const endWorldY = segment.endY * mapHeight

    // Calculate perpendicular offset
    const dx = endWorldX - startWorldX
    const dy = endWorldY - startWorldY
    const length = Math.sqrt(dx * dx + dy * dy)
    const perpX = (-dy / length) * tolerance
    const perpY = (dx / length) * tolerance

    if (i === 0) {
      // First segment: add both offset points at start
      points.push(startWorldX + perpX, startWorldY + perpY)
    }
    // Add offset point at end
    points.push(endWorldX + perpX, endWorldY + perpY)
  }

  // Add points on the other side (in reverse)
  for (let i = sortedSegments.length - 1; i >= 0; i--) {
    const segment = sortedSegments[i]
    const startWorldX = segment.startX * mapWidth
    const startWorldY = segment.startY * mapHeight
    const endWorldX = segment.endX * mapWidth
    const endWorldY = segment.endY * mapHeight

    const dx = endWorldX - startWorldX
    const dy = endWorldY - startWorldY
    const length = Math.sqrt(dx * dx + dy * dy)
    const perpX = (-dy / length) * tolerance
    const perpY = (dx / length) * tolerance

    if (i === sortedSegments.length - 1) {
      points.push(endWorldX - perpX, endWorldY - perpY)
    }
    points.push(startWorldX - perpX, startWorldY - perpY)
  }

  return points
}

/**
 * Draw a preview segment (for hyperlane creation)
 */
export function drawPreviewSegment(
  graphics: PIXI.Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  mapWidth: number,
  mapHeight: number,
  color = 0x3b82f6, // Blue color to match hyperlanes
  alpha = 0.4,
  lineWidth = 4, // Doubled from 2 to match new default
): void {
  const startWorldX = startX * mapWidth
  const startWorldY = startY * mapHeight
  const endWorldX = endX * mapWidth
  const endWorldY = endY * mapHeight

  graphics.clear()
  graphics.moveTo(startWorldX, startWorldY)
  graphics.lineTo(endWorldX, endWorldY)
  graphics.stroke({ width: lineWidth, color, alpha })
}
