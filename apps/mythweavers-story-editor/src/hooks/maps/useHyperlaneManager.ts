import { Viewport } from 'pixi-viewport'
import * as PIXI from 'pixi.js'
import { Accessor } from 'solid-js'
import { Hyperlane } from '../../types/core'
import { drawAllHyperlanes, drawPreviewSegment } from '../../utils/maps/hyperlaneRenderer'
import { PixiContainers } from './usePixiMap'

export type HyperlaneClickHandler = (hyperlane: Hyperlane, screenPos: { x: number; y: number }) => void

export interface UseHyperlaneManagerOptions {
  viewport: Accessor<Viewport | null>
  containers: Accessor<PixiContainers>
  mapSprite: Accessor<PIXI.Sprite | null>
  canvasContainer: Accessor<HTMLDivElement | undefined>
  onHyperlaneClick?: HyperlaneClickHandler
  shouldStopPropagation?: () => boolean
  interactive?: () => boolean
}

export interface UseHyperlaneManagerReturn {
  refreshAllHyperlanes: (hyperlanes: Hyperlane[]) => void
  clearAllHyperlanes: () => void
  showPreviewSegment: (startX: number, startY: number, endX: number, endY: number) => void
  hidePreviewSegment: () => void
  setInteractive: (interactive: boolean) => void
}

/**
 * Hook to manage hyperlane rendering on the map
 */
export function useHyperlaneManager(options: UseHyperlaneManagerOptions): UseHyperlaneManagerReturn {
  const { containers, mapSprite, canvasContainer, onHyperlaneClick, shouldStopPropagation, interactive } = options

  // Preview graphics for hyperlane creation
  let previewGraphics: PIXI.Graphics | null = null

  const refreshAllHyperlanes = (hyperlanes: Hyperlane[]) => {
    const hyperlaneContainer = containers().hyperlane
    const sprite = mapSprite()

    if (!hyperlaneContainer || !sprite) return

    // Evaluate interactive state at render time
    const isInteractive = interactive ? interactive() : true
    const stopPropagation = shouldStopPropagation ? shouldStopPropagation() : true

    // Wrapper for click handler to adjust coordinates
    const clickHandler = onHyperlaneClick
      ? (hyperlane: Hyperlane, screenPos: { x: number; y: number }) => {
          const container = canvasContainer()
          const baseX = screenPos.x + (container?.offsetLeft || 0)
          const baseY = screenPos.y + (container?.offsetTop || 0)
          onHyperlaneClick(hyperlane, { x: baseX, y: baseY })
        }
      : undefined

    // Draw all hyperlanes (uses blue color by default)
    // Note: Line width is calculated based on speedMultiplier in drawAllHyperlanes
    drawAllHyperlanes(
      hyperlaneContainer,
      hyperlanes,
      sprite.width,
      sprite.height,
      0x3b82f6, // Blue color
      0.4, // 40% opacity
      clickHandler,
      isInteractive,
      stopPropagation,
    )
  }

  const clearAllHyperlanes = () => {
    const hyperlaneContainer = containers().hyperlane
    if (!hyperlaneContainer) return

    hyperlaneContainer.removeChildren()
  }

  const showPreviewSegment = (startX: number, startY: number, endX: number, endY: number) => {
    const hyperlaneContainer = containers().hyperlane
    const sprite = mapSprite()

    if (!hyperlaneContainer || !sprite) return

    // Create preview graphics if it doesn't exist OR if it's been orphaned from the container
    if (!previewGraphics || previewGraphics.parent !== hyperlaneContainer) {
      previewGraphics = new PIXI.Graphics()
      previewGraphics.eventMode = 'none' // Non-interactive
      hyperlaneContainer.addChild(previewGraphics)
    }

    // Draw preview segment (uses blue color by default)
    drawPreviewSegment(
      previewGraphics,
      startX,
      startY,
      endX,
      endY,
      sprite.width,
      sprite.height,
      0x3b82f6, // Blue color
      0.4, // 40% opacity (faded)
      4, // Line width (doubled from 2)
    )
  }

  const hidePreviewSegment = () => {
    if (previewGraphics) {
      previewGraphics.clear()
    }
  }

  const setInteractive = (interactive: boolean) => {
    const hyperlaneContainer = containers().hyperlane
    if (!hyperlaneContainer) return

    // Only control interactiveChildren - don't set eventMode on the container itself
    // This allows the viewport to handle drag events even when children are non-interactive
    hyperlaneContainer.interactiveChildren = interactive
  }

  return {
    refreshAllHyperlanes,
    clearAllHyperlanes,
    showPreviewSegment,
    hidePreviewSegment,
    setInteractive,
  }
}
