import { Viewport } from 'pixi-viewport'
import * as PIXI from 'pixi.js'
import { Accessor } from 'solid-js'
import { mapEditorStore } from '../../stores/mapEditorStore'
import { mapsStore } from '../../stores/mapsStore'
import { Fleet } from '../../types/core'
import { getFleetPositionAtTime } from '../../utils/fleetUtils'
import { parseColorToHex } from '../../utils/maps/colorUtils'
import {
  FleetSprite,
  createFleetLabelText,
  createFleetSprite,
  fleetHasChanged,
  positionFleet,
  updateFleetStatus,
} from '../../utils/maps/fleetRenderer'
import { PixiContainers } from './usePixiMap'

export type FleetClickHandler = (fleet: Fleet, screenPos: { x: number; y: number }, button: number) => void

export interface UseFleetManagerOptions {
  viewport: Accessor<Viewport | null>
  containers: Accessor<PixiContainers>
  mapSprite: Accessor<PIXI.Sprite | null>
  canvasContainer: Accessor<HTMLDivElement | undefined>
  onFleetClick?: FleetClickHandler
}

export interface UseFleetManagerReturn {
  addFleet: (fleet: Fleet) => void
  removeFleet: (fleetId: string) => void
  updateFleet: (fleet: Fleet) => void
  clearAllFleets: () => void
  refreshAllFleets: (fleets: Fleet[]) => void
  updateFleetPositions: (fleets: Fleet[]) => void
  drawAllFleetPaths: (fleets: Fleet[]) => void
}

/**
 * Hook to manage fleet sprites on the map.
 * Reads currentStoryTime and selectedFleetId from stores.
 */
export function useFleetManager(options: UseFleetManagerOptions): UseFleetManagerReturn {
  const { viewport, containers, mapSprite, canvasContainer, onFleetClick } = options

  // Read from stores - compute current story time with pending override
  const currentStoryTime = (): number => {
    const pending = mapEditorStore.pendingStoryTime
    if (pending !== null) return pending
    return mapsStore.currentStoryTime ?? 0
  }

  // Selected fleet for movement highlighting
  const selectedFleetId = (): string | null => mapEditorStore.selectedFleetForMovement?.id ?? null

  // Get a container for fleets (dedicated fleet container)
  const getFleetContainer = () => {
    return containers().fleet
  }

  const getLabelContainer = () => {
    return containers().label
  }

  const addFleet = (fleet: Fleet) => {
    const fleetContainer = getFleetContainer()
    const labelContainer = getLabelContainer()
    const sprite = mapSprite()
    if (!fleetContainer || !sprite) return

    // Get the fleet's position at current story time
    const position = getFleetPositionAtTime(fleet, currentStoryTime())

    // Check if this fleet is selected
    const isSelected = selectedFleetId ? selectedFleetId() === fleet.id : false

    // Create the sprite using the imported utility
    const fleetSprite = createFleetSprite(fleet, {
      position,
      parseColorToHex,
      isSelected,
      onPointerDown: (f, e) => {
        if (onFleetClick) {
          const vp = viewport()
          if (!vp) return
          const screenPos = vp.toScreen(fleetSprite.position)
          const container = canvasContainer()
          const baseX = screenPos.x + (container?.offsetLeft || 0)
          const baseY = screenPos.y + (container?.offsetTop || 0)
          onFleetClick(f, { x: baseX, y: baseY }, e.button)
        }
      },
    })

    // Create and add label
    const size = fleet.size === 'large' ? 18 : fleet.size === 'small' ? 10 : 14
    const labelText = createFleetLabelText(fleet, size)
    fleetSprite.labelText = labelText

    // Position the sprite and label
    positionFleet(fleetSprite, position, sprite.width, sprite.height)

    // Add to containers
    fleetContainer.addChild(fleetSprite)
    if (labelContainer) {
      labelContainer.addChild(labelText)
    }
  }

  const removeFleet = (fleetId: string) => {
    const fleetContainer = getFleetContainer()
    const labelContainer = getLabelContainer()
    if (!fleetContainer) return

    const existingSprites = fleetContainer.children as FleetSprite[]
    const spriteToRemove = existingSprites.find((s) => s.fleetData?.id === fleetId)

    if (spriteToRemove) {
      fleetContainer.removeChild(spriteToRemove)
      if (spriteToRemove.labelText && labelContainer) {
        labelContainer.removeChild(spriteToRemove.labelText)
      }
    }
  }

  const updateFleet = (fleet: Fleet) => {
    const fleetContainer = getFleetContainer()
    const labelContainer = getLabelContainer()
    const sprite = mapSprite()
    if (!fleetContainer || !sprite) return

    const existingSprites = fleetContainer.children as FleetSprite[]
    const existingSprite = existingSprites.find((s) => s.fleetData?.id === fleet.id)

    if (existingSprite?.fleetData) {
      const hasChanged = fleetHasChanged(existingSprite.fleetData, fleet)

      // Also check if position changed (due to story time)
      const oldPosition = getFleetPositionAtTime(existingSprite.fleetData, currentStoryTime())
      const newPosition = getFleetPositionAtTime(fleet, currentStoryTime())
      const positionChanged =
        oldPosition.x !== newPosition.x || oldPosition.y !== newPosition.y || oldPosition.status !== newPosition.status

      if (hasChanged || positionChanged) {
        // Remove old sprite
        fleetContainer.removeChild(existingSprite)
        if (existingSprite.labelText && labelContainer) {
          labelContainer.removeChild(existingSprite.labelText)
        }
        // Add updated sprite
        addFleet(fleet)
      } else {
        // Update the stored fleet data copy even if visual hasn't changed
        existingSprite.fleetData = { ...fleet }
      }
    } else {
      // New fleet
      addFleet(fleet)
    }
  }

  const clearAllFleets = () => {
    const fleetContainer = getFleetContainer()
    const labelContainer = getLabelContainer()
    if (!fleetContainer) return

    // Remove only fleet sprites, not landmarks
    const allSprites = fleetContainer.children as FleetSprite[]
    const fleetSprites = allSprites.filter((s) => s.fleetData)

    for (const sprite of fleetSprites) {
      fleetContainer.removeChild(sprite)
      if (sprite.labelText && labelContainer) {
        labelContainer.removeChild(sprite.labelText)
      }
    }
  }

  const refreshAllFleets = (fleets: Fleet[]) => {
    clearAllFleets()
    fleets.forEach((fleet) => {
      addFleet(fleet)
    })
  }

  const updateFleetPositions = (fleets: Fleet[]) => {
    const fleetContainer = getFleetContainer()
    const sprite = mapSprite()
    if (!fleetContainer || !sprite) return

    const existingSprites = fleetContainer.children as FleetSprite[]

    for (const fleet of fleets) {
      const fleetSprite = existingSprites.find((s) => s.fleetData?.id === fleet.id)
      if (fleetSprite) {
        const position = getFleetPositionAtTime(fleet, currentStoryTime())
        positionFleet(fleetSprite, position, sprite.width, sprite.height)
        updateFleetStatus(fleetSprite, position.status)
      }
    }
  }

  const drawAllFleetPaths = (fleets: Fleet[]) => {
    const pathsContainer = containers().paths
    const sprite = mapSprite()
    if (!pathsContainer || !sprite) return

    // Clear existing paths
    pathsContainer.removeChildren()

    const currentTime = currentStoryTime()

    for (const fleet of fleets) {
      if (!fleet.movements || fleet.movements.length === 0) continue

      // Sort movements by start time
      const sortedMovements = [...fleet.movements].sort((a, b) => a.startStoryTime - b.startStoryTime)

      // Find consecutive movements starting from current time or earlier
      const relevantMovements: typeof sortedMovements = []
      let lastEndTime: number | null = null

      for (const movement of sortedMovements) {
        // Skip movements that ended before current time
        if (movement.endStoryTime <= currentTime) continue

        // If this is the first movement or it connects to the previous one
        if (lastEndTime === null) {
          // Check if this movement is active (started before or at current time)
          if (movement.startStoryTime <= currentTime) {
            relevantMovements.push(movement)
            lastEndTime = movement.endStoryTime
          }
        } else {
          // Check if this movement starts exactly when the previous one ended (no gap)
          if (movement.startStoryTime === lastEndTime) {
            relevantMovements.push(movement)
            lastEndTime = movement.endStoryTime
          } else {
            // Gap detected, stop collecting movements
            break
          }
        }
      }

      // Draw paths for relevant movements
      for (let i = 0; i < relevantMovements.length; i++) {
        const movement = relevantMovements[i]
        const isActive = movement.startStoryTime <= currentTime && movement.endStoryTime > currentTime

        const pathLine = new PIXI.Graphics()

        // Calculate world positions
        const startWorldX = movement.startX * sprite.width
        const startWorldY = movement.startY * sprite.height
        const endWorldX = movement.endX * sprite.width
        const endWorldY = movement.endY * sprite.height

        // Different style for active vs queued movements
        if (isActive) {
          // Active movement: solid line
          pathLine.moveTo(startWorldX, startWorldY)
          pathLine.lineTo(endWorldX, endWorldY)
          pathLine.stroke({ width: 2, color: 0xffaa00, alpha: 0.8 })
        } else {
          // Queued movement: dashed red line
          drawDashedLine(pathLine, startWorldX, startWorldY, endWorldX, endWorldY, 10, 5, 0xff3333, 0.6)
        }

        pathsContainer.addChild(pathLine)
      }
    }
  }

  // Helper function to draw dashed lines
  const drawDashedLine = (
    graphics: PIXI.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dashLength: number,
    gapLength: number,
    color: number,
    alpha: number,
  ) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const distance = Math.sqrt(dx * dx + dy * dy)
    const dashCount = Math.floor(distance / (dashLength + gapLength))
    const normalizedDx = dx / distance
    const normalizedDy = dy / distance

    for (let i = 0; i < dashCount; i++) {
      const startDist = i * (dashLength + gapLength)
      const endDist = startDist + dashLength

      const startX = x1 + normalizedDx * startDist
      const startY = y1 + normalizedDy * startDist
      const endX = x1 + normalizedDx * endDist
      const endY = y1 + normalizedDy * endDist

      graphics.moveTo(startX, startY)
      graphics.lineTo(endX, endY)
      graphics.stroke({ width: 2, color, alpha })
    }

    // Draw remaining segment if any
    const remainingDist = distance - dashCount * (dashLength + gapLength)
    if (remainingDist > 0) {
      const startDist = dashCount * (dashLength + gapLength)
      const startX = x1 + normalizedDx * startDist
      const startY = y1 + normalizedDy * startDist
      const endX = x1 + normalizedDx * (startDist + Math.min(remainingDist, dashLength))
      const endY = y1 + normalizedDy * (startDist + Math.min(remainingDist, dashLength))

      graphics.moveTo(startX, startY)
      graphics.lineTo(endX, endY)
      graphics.stroke({ width: 2, color, alpha })
    }
  }

  return {
    addFleet,
    removeFleet,
    updateFleet,
    clearAllFleets,
    refreshAllFleets,
    updateFleetPositions,
    drawAllFleetPaths,
  }
}
