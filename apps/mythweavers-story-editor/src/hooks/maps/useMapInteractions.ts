import { Viewport } from 'pixi-viewport'
import * as PIXI from 'pixi.js'
import { Accessor } from 'solid-js'
import { PixiContainers } from './usePixiMap'

export interface MapClickPosition {
  x: number
  y: number
  normalizedX: number
  normalizedY: number
}

export interface UseMapInteractionsOptions {
  viewport: Accessor<Viewport | null>
  containers: Accessor<PixiContainers>
  mapSprite: Accessor<PIXI.Sprite | null>
  canvasContainer: Accessor<HTMLDivElement | undefined>
  isEditing: Accessor<boolean>
  isAddingNew: Accessor<boolean>
  mapSelected: Accessor<boolean>
  lastUsedType: Accessor<'system' | 'station' | 'nebula' | 'junction'>
  creationMode: Accessor<'landmark' | 'fleet' | 'hyperlane'>
  onMapClick?: (position: MapClickPosition) => void
  onMapRightClick?: (position: MapClickPosition) => void
  paintModeEnabled?: Accessor<boolean>
  isShiftHeld?: Accessor<boolean>
  selectedPaintFaction?: Accessor<string | null>
  onPaintClick?: (screenX: number, screenY: number, faction: string | null) => Promise<void>
}

export interface UseMapInteractionsReturn {
  setupInteractions: () => void
  updatePreview: (
    position: { x: number; y: number },
    color: string,
    size: 'small' | 'medium' | 'large',
    type: 'system' | 'station' | 'nebula' | 'junction',
    mode?: 'landmark' | 'fleet' | 'hyperlane',
  ) => void
  hidePreview: () => void
}

/**
 * Hook to manage map interactions (mouse, touch, preview)
 */
export function useMapInteractions(options: UseMapInteractionsOptions): UseMapInteractionsReturn {
  const {
    viewport,
    containers,
    mapSprite,
    canvasContainer,
    isEditing,
    isAddingNew,
    mapSelected,
    lastUsedType,
    creationMode,
    onMapClick,
    onMapRightClick,
    paintModeEnabled,
    isShiftHeld,
    selectedPaintFaction,
    onPaintClick,
  } = options

  let isDragging = false
  let dragStartPos: { x: number; y: number } | null = null
  let lastPaintTime = 0
  let isPainting = false
  let lastButtonPressed = 0 // Track which mouse button was pressed

  const setupInteractions = () => {
    console.log('setupInteractions called')
    const vp = viewport()
    const previewSprite = containers().preview
    const container = canvasContainer()
    console.log('viewport:', vp, 'previewSprite:', previewSprite, 'canvasContainer:', container)
    if (!vp || !previewSprite) {
      console.log('setupInteractions returning early - missing vp or previewSprite')
      return
    }

    // Prevent browser context menu on the canvas element
    if (container) {
      // Remove old listeners if exist
      const oldListener = (container as any)._contextMenuListener
      const oldCanvas = (container as any)._contextMenuCanvas
      const oldContainerListener = (container as any)._contextMenuContainerListener

      if (oldListener && oldCanvas) {
        oldCanvas.removeEventListener('contextmenu', oldListener)
      }
      if (oldContainerListener) {
        container.removeEventListener('contextmenu', oldContainerListener)
      }

      const preventContextMenu = (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        return false
      }

      // Add to container
      container.addEventListener('contextmenu', preventContextMenu, true)
      ;(container as any)._contextMenuContainerListener = preventContextMenu

      // Also add to canvas if it exists
      const canvas = container.querySelector('canvas')
      if (canvas) {
        canvas.addEventListener('contextmenu', preventContextMenu, true)
        ;(container as any)._contextMenuListener = preventContextMenu
        ;(container as any)._contextMenuCanvas = canvas
      }

      console.log('Context menu prevention installed on', canvas ? 'canvas and container' : 'container only')
    }

    // Handle mouse move for preview
    vp.on('pointermove', (e: any) => {
      const sprite = mapSprite()
      if (!previewSprite || !sprite || !vp) return

      // Don't show hover preview when adding new landmark (handled by the effect)
      // Only show preview when just hovering over the map
      if (!isEditing() && !isAddingNew() && mapSelected()) {
        // Get world position
        const worldPos = vp.toWorld(e.global)

        // Calculate normalized position (0-1)
        const normalizedX = worldPos.x / sprite.width
        const normalizedY = worldPos.y / sprite.height

        // Keep preview within bounds
        if (normalizedX >= 0 && normalizedX <= 1 && normalizedY >= 0 && normalizedY <= 1) {
          // Update preview position
          previewSprite.position.set(worldPos.x, worldPos.y)
          previewSprite.visible = true

          previewSprite.clear()

          // Draw different previews based on creation mode
          const mode = creationMode()
          if (mode === 'fleet') {
            // Draw fleet triangle preview
            const size = 14 // Medium size
            const height = size * 1.5
            const baseWidth = size

            // Semi-transparent outline
            previewSprite.lineStyle(2, 0xffffff, 0.3)
            previewSprite.moveTo(0, -height / 2)
            previewSprite.lineTo(-baseWidth / 2, height / 2)
            previewSprite.lineTo(baseWidth / 2, height / 2)
            previewSprite.closePath()
            previewSprite.stroke()

            // Semi-transparent fill
            previewSprite.beginFill(0x00ff00, 0.3)
            previewSprite.moveTo(0, -height / 2)
            previewSprite.lineTo(-baseWidth / 2, height / 2)
            previewSprite.lineTo(baseWidth / 2, height / 2)
            previewSprite.closePath()
            previewSprite.fill()
            previewSprite.endFill()
          } else if (mode === 'hyperlane') {
            // Draw junction preview (small white circle)
            const radius = 8 // Small size for junction

            // Semi-transparent outline
            previewSprite.lineStyle(2, 0xffffff, 0.4)
            previewSprite.drawCircle(0, 0, radius + 2)

            // Semi-transparent fill
            previewSprite.beginFill(0xffffff, 0.3)
            previewSprite.drawCircle(0, 0, radius)
            previewSprite.endFill()
          } else {
            // Draw landmark preview (default)
            const radius = 12 // Default medium size

            // Draw with dashed/dotted outline to indicate it's a preview
            previewSprite.lineStyle(2, 0xffffff, 0.3)
            previewSprite.drawCircle(0, 0, radius + 2)

            // Semi-transparent fill
            previewSprite.beginFill(0x3498db, 0.3)
            previewSprite.drawCircle(0, 0, radius)
            previewSprite.endFill()

            // Add type-specific overlays
            drawTypeOverlay(previewSprite, lastUsedType(), radius)
          }
        } else {
          previewSprite.visible = false
        }
      } else if (!isAddingNew()) {
        // Only hide if we're not adding a new landmark
        previewSprite.visible = false
      }
    })

    // Track drag start
    vp.on('pointerdown', (e: any) => {
      const worldPos = vp.toWorld(e.global)
      dragStartPos = { x: worldPos.x, y: worldPos.y }
      isDragging = false

      // Track which button was pressed
      lastButtonPressed = e.data?.button ?? e.button ?? 0

      // Start painting if in paint mode with shift held
      if (paintModeEnabled?.() && isShiftHeld?.()) {
        isPainting = true
        // Pause viewport dragging so we can paint instead
        const dragPlugin = (vp as any).plugins?.get?.('drag')
        if (dragPlugin) {
          dragPlugin.pause()
        }
      }
    })

    // Detect if pointer moved enough to be considered a drag
    vp.on('pointermove', (e: any) => {
      if (dragStartPos && !isDragging) {
        const worldPos = vp.toWorld(e.global)
        const distance = Math.sqrt((worldPos.x - dragStartPos.x) ** 2 + (worldPos.y - dragStartPos.y) ** 2)
        // Consider it a drag if moved more than 5 pixels
        if (distance > 5) {
          isDragging = true
          // Hide preview if we're dragging
          if (previewSprite) {
            previewSprite.visible = false
          }
        }
      }

      // Handle continuous painting when shift+dragging in paint mode
      if (
        paintModeEnabled?.() &&
        isShiftHeld?.() &&
        isPainting &&
        isDragging &&
        onPaintClick &&
        selectedPaintFaction !== undefined
      ) {
        const now = Date.now()
        // Throttle to ~100ms intervals
        if (now - lastPaintTime > 100) {
          lastPaintTime = now
          const screenPos = e.screen || vp.toScreen(e.global)
          const container = canvasContainer()
          const baseX = screenPos.x + (container?.offsetLeft || 0)
          const baseY = screenPos.y + (container?.offsetTop || 0)
          onPaintClick(baseX, baseY, selectedPaintFaction())
        }
      }
    })

    // Reset drag state on pointer up
    vp.on('pointerup', () => {
      dragStartPos = null
      isPainting = false
      // Resume viewport dragging
      const dragPlugin = (vp as any).plugins?.get?.('drag')
      if (dragPlugin?.paused) {
        dragPlugin.resume()
      }
      // Small delay to let the clicked event know if it was a drag
      setTimeout(() => {
        isDragging = false
        // Reset button tracking after click has been processed
        lastButtonPressed = 0
      }, 50)
    })

    // Handle viewport clicks for adding landmarks or painting
    vp.on('clicked', (e: any) => {
      const sprite = mapSprite()
      // Ignore if user was dragging or if this is a right-click
      // button: 0 = left, 1 = middle, 2 = right
      if (isDragging || !sprite) return

      // Filter out right-clicks (they're handled by the rightclick event)
      // Check both the event button and the tracked button from pointerdown
      if (lastButtonPressed === 2) return

      if (mapSelected()) {
        // The viewport 'clicked' event provides world coordinates directly
        const worldPos = e.world || vp.toWorld(e.screen)

        // Convert to normalized coordinates (0-1)
        const normalizedX = worldPos.x / sprite.width
        const normalizedY = worldPos.y / sprite.height

        // Check bounds
        if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
          return
        }

        // Get screen position for popup positioning
        const screenPos = e.screen || vp.toScreen(worldPos)
        const container = canvasContainer()
        const baseX = screenPos.x + (container?.offsetLeft || 0)
        const baseY = screenPos.y + (container?.offsetTop || 0)

        // Handle paint mode clicks
        if (paintModeEnabled?.() && onPaintClick && selectedPaintFaction !== undefined) {
          onPaintClick(baseX, baseY, selectedPaintFaction())
          return
        }

        // Call the normal click handler for adding landmarks
        if (onMapClick) {
          onMapClick({
            x: baseX,
            y: baseY,
            normalizedX,
            normalizedY,
          })
        }
      }
    })

    // Handle right-click for fleet movement creation
    vp.on('rightclick', (e: any) => {
      const sprite = mapSprite()
      // Ignore if user was dragging or no handler
      if (isDragging || !sprite || !onMapRightClick) return

      if (mapSelected()) {
        // The viewport 'rightclick' event provides world coordinates
        const worldPos = e.world || vp.toWorld(e.screen)

        // Convert to normalized coordinates (0-1)
        const normalizedX = worldPos.x / sprite.width
        const normalizedY = worldPos.y / sprite.height

        // Check bounds
        if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
          return
        }

        // Get screen position for popup positioning
        const screenPos = e.screen || vp.toScreen(worldPos)
        const container = canvasContainer()
        const baseX = screenPos.x + (container?.offsetLeft || 0)
        const baseY = screenPos.y + (container?.offsetTop || 0)

        // Prevent default context menu
        e.stopPropagation()
        if (e.preventDefault) {
          e.preventDefault()
        }
        // Also prevent on the native event if available
        if (e.data?.originalEvent?.preventDefault) {
          e.data.originalEvent.preventDefault()
        }
        if (e.nativeEvent?.preventDefault) {
          e.nativeEvent.preventDefault()
        }

        // Call the right-click handler
        onMapRightClick({
          x: baseX,
          y: baseY,
          normalizedX,
          normalizedY,
        })
      }
    })
  }

  const updatePreview = (
    position: { x: number; y: number },
    color: string,
    size: 'small' | 'medium' | 'large',
    type: 'system' | 'station' | 'nebula' | 'junction',
    mode: 'landmark' | 'fleet' | 'hyperlane' = 'landmark',
  ) => {
    const previewSprite = containers().preview
    const sprite = mapSprite()
    if (!previewSprite || !sprite) return

    const worldX = position.x * sprite.width
    const worldY = position.y * sprite.height

    previewSprite.position.set(worldX, worldY)
    previewSprite.visible = true

    previewSprite.clear()

    if (mode === 'fleet') {
      // Draw fleet triangle preview
      const sizeMap = { small: 10, medium: 14, large: 18 }
      const fleetSize = sizeMap[size]
      const height = fleetSize * 1.5
      const baseWidth = fleetSize
      const colorHex = Number.parseInt(color.replace('#', '') || '00ff00', 16)

      // Pulsing outline effect
      previewSprite.lineStyle(2, 0xffffff, 0.8)
      previewSprite.moveTo(0, -height / 2 - 2)
      previewSprite.lineTo(-baseWidth / 2 - 2, height / 2 + 2)
      previewSprite.lineTo(baseWidth / 2 + 2, height / 2 + 2)
      previewSprite.closePath()
      previewSprite.stroke()

      // Semi-transparent preview
      previewSprite.beginFill(colorHex, 0.6)
      previewSprite.moveTo(0, -height / 2)
      previewSprite.lineTo(-baseWidth / 2, height / 2)
      previewSprite.lineTo(baseWidth / 2, height / 2)
      previewSprite.closePath()
      previewSprite.fill()
      previewSprite.endFill()
    } else if (mode === 'hyperlane') {
      // Draw junction preview (small white circle)
      const sizeMap = { small: 6, medium: 8, large: 10 }
      const radius = sizeMap[size]

      // Pulsing outline effect
      previewSprite.lineStyle(2, 0xffffff, 0.8)
      previewSprite.drawCircle(0, 0, radius + 3)

      // Semi-transparent preview
      previewSprite.beginFill(0xffffff, 0.6)
      previewSprite.drawCircle(0, 0, radius)
      previewSprite.endFill()
    } else {
      // Draw landmark preview (default)
      const sizeMap = { small: 8, medium: 12, large: 16 }
      const radius = sizeMap[size]
      const colorHex = Number.parseInt(color.replace('#', '') || '3498db', 16)

      // Pulsing outline effect
      previewSprite.lineStyle(2, 0xffffff, 0.8)
      previewSprite.drawCircle(0, 0, radius + 3)

      // Semi-transparent preview
      previewSprite.beginFill(colorHex, 0.6)
      previewSprite.drawCircle(0, 0, radius)
      previewSprite.endFill()

      // Add type-specific overlays
      drawTypeOverlay(previewSprite, type, radius, colorHex, 0.6)
    }
  }

  const hidePreview = () => {
    const previewSprite = containers().preview
    if (previewSprite) {
      previewSprite.visible = false
    }
  }

  return {
    setupInteractions,
    updatePreview,
    hidePreview,
  }
}

/**
 * Draw type-specific overlay on preview sprite
 */
function drawTypeOverlay(
  sprite: PIXI.Graphics,
  type: 'system' | 'station' | 'nebula' | 'junction',
  radius: number,
  color = 0xffffff,
  alpha = 0.3,
): void {
  if (type === 'station') {
    const barWidth = Math.max(2, radius / 3)
    const barHeight = radius * 2.2

    // White outline for the bar
    sprite.beginFill(0xffffff, alpha)
    sprite.drawRect(-barWidth / 2 - 1, -barHeight / 2 - 1, barWidth + 2, barHeight + 2)
    sprite.endFill()

    // Colored bar
    sprite.beginFill(color, alpha)
    sprite.drawRect(-barWidth / 2, -barHeight / 2, barWidth, barHeight)
    sprite.endFill()
  } else if (type === 'nebula') {
    const barHeight = Math.max(2, radius / 4)
    const middleBarWidth = radius * 1.92
    const outerBarWidth = radius * 1.44
    const barSpacing = radius * 0.5

    // Draw bars with white outlines
    sprite.beginFill(0xffffff, alpha)
    // Top bar outline
    sprite.drawRect(-outerBarWidth / 2 - 1, -barSpacing - barHeight / 2 - 1, outerBarWidth + 2, barHeight + 2)
    // Middle bar outline
    sprite.drawRect(-middleBarWidth / 2 - 1, -barHeight / 2 - 1, middleBarWidth + 2, barHeight + 2)
    // Bottom bar outline
    sprite.drawRect(-outerBarWidth / 2 - 1, barSpacing - barHeight / 2 - 1, outerBarWidth + 2, barHeight + 2)
    sprite.endFill()

    // Colored bars
    sprite.beginFill(color, alpha)
    // Top bar
    sprite.drawRect(-outerBarWidth / 2, -barSpacing - barHeight / 2, outerBarWidth, barHeight)
    // Middle bar
    sprite.drawRect(-middleBarWidth / 2, -barHeight / 2, middleBarWidth, barHeight)
    // Bottom bar
    sprite.drawRect(-outerBarWidth / 2, barSpacing - barHeight / 2, outerBarWidth, barHeight)
    sprite.endFill()
  }
  // System type has no overlay
}
