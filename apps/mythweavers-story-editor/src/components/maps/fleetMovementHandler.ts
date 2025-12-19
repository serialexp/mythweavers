/**
 * Fleet Movement Handler with Pathfinding
 *
 * Handles right-click events to create fleet movements using pathfinding
 */

import { currentStoryStore } from '../../stores/currentStoryStore'
import { mapsStore } from '../../stores/mapsStore'
import { Fleet } from '../../types/core'
import { getFleetPositionAtTime } from '../../utils/fleetUtils'
import { calculateOptimalPath } from '../../utils/maps/pathfinding'

export interface FleetMovementHandlerOptions {
  fleet: Fleet
  targetX: number
  targetY: number
  currentStoryTime: number
  isShiftHeld: boolean
  map: NonNullable<(typeof mapsStore)['selectedMap']>
  currentStoryStore: typeof currentStoryStore
  mapsStore: typeof mapsStore
}

/**
 * Create fleet movements from pathfinding result
 */
export function createFleetMovementsFromPath(options: FleetMovementHandlerOptions): void {
  const { fleet, targetX, targetY, currentStoryTime, isShiftHeld, map, currentStoryStore, mapsStore } = options

  if (!map) return

  // Get fleet's current position at the current story time
  const fleetPosition = getFleetPositionAtTime(fleet, currentStoryTime)

  // Determine start position and time
  let startX = fleetPosition.x
  let startY = fleetPosition.y
  let startTime = currentStoryTime

  // If shift is held, allow chaining from the last movement
  if (isShiftHeld) {
    // Find the last movement (sorted by endStoryTime)
    const sortedMovements = [...fleet.movements].sort((a, b) => b.endStoryTime - a.endStoryTime)
    const lastMovement = sortedMovements[0]

    if (lastMovement) {
      // Chain from the end of the last movement
      startX = lastMovement.endX
      startY = lastMovement.endY
      startTime = lastMovement.endStoryTime
      console.log(`Chaining movement from end of last movement at story time ${startTime}`)
    }
  } else {
    // Not chaining - validate no overlapping movements
    // Check if fleet has any future movements from current time
    const hasActiveMovements = fleet.movements.some((m) => m.endStoryTime > currentStoryTime)

    if (hasActiveMovements) {
      console.error('Fleet already has active or future movements. Hold Shift to chain movements.')
      alert('This fleet already has active movements. Hold Shift to chain a new movement after the current ones.')
      return
    }

    // Check if fleet is currently in transit at this exact time
    if (fleetPosition.status === 'in_transit') {
      console.error('Fleet is currently in transit. Hold Shift to chain movements.')
      alert('Fleet is currently in transit. Hold Shift to chain a new movement.')
      return
    }
  }

  // Calculate optimal path using pathfinding
  const pathResult = calculateOptimalPath(
    startX,
    startY,
    targetX,
    targetY,
    map.landmarks,
    map.hyperlanes || [],
    fleet.hyperdriveRating,
  )

  console.log(`Pathfinding result: ${pathResult.segments.length} segments, total time: ${pathResult.totalTime} minutes`)

  // Create fleet movements from path segments
  let currentTime = startTime

  for (const segment of pathResult.segments) {
    const endTime = currentTime + segment.travelTime

    // Check if there's already a movement starting at this exact time
    const existingMovement = fleet.movements.find((m) => m.startStoryTime === currentTime)

    if (existingMovement) {
      // Update the existing movement
      console.log(
        `Updating movement: (${segment.startX.toFixed(3)}, ${segment.startY.toFixed(3)}) -> (${segment.endX.toFixed(3)}, ${segment.endY.toFixed(3)}) from ${currentTime} to ${endTime} (${segment.travelTime} min, ${segment.type})`,
      )
      mapsStore.updateFleetMovement(map.id, fleet.id, existingMovement.id, {
        endStoryTime: endTime,
        endX: segment.endX,
        endY: segment.endY,
      })
    } else {
      // Create a new movement
      console.log(
        `Creating movement: (${segment.startX.toFixed(3)}, ${segment.startY.toFixed(3)}) -> (${segment.endX.toFixed(3)}, ${segment.endY.toFixed(3)}) from ${currentTime} to ${endTime} (${segment.travelTime} min, ${segment.type})`,
      )
      mapsStore.addFleetMovement(map.id, fleet.id, {
        storyId: currentStoryStore.id,
        startStoryTime: currentTime,
        endStoryTime: endTime,
        startX: segment.startX,
        startY: segment.startY,
        endX: segment.endX,
        endY: segment.endY,
      })
    }

    // Move to next segment
    currentTime = endTime
  }
}
