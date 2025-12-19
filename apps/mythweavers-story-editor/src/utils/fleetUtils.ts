/**
 * Fleet Utilities
 *
 * Helpers for calculating fleet positions and movements over time
 */

import { Fleet } from '../types/core'

export interface FleetPosition {
  x: number
  y: number
  status: 'stationed' | 'in_transit'
}

/**
 * Calculate the Euclidean distance between two points on the map
 */
export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate travel time in minutes based on distance and hyperdrive rating
 *
 * Formula: baseTime * hyperdriveRating
 * - Lower rating = faster (0.5 = twice as fast)
 * - Higher rating = slower (2.0 = twice as slow)
 *
 * Base travel time uses a reasonable scale:
 * - Map diagonal (1.414 units) ≈ 31.5 days for rating 1.0
 * - This means crossing the entire galaxy takes about a month with standard hyperdrive
 */
export function calculateTravelTime(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  hyperdriveRating: number,
): number {
  const distance = calculateDistance(startX, startY, endX, endY)

  // Base travel time: diagonal = 31.5 days = 45,360 minutes (7 days * 4.5)
  const baseMinutesPerUnit = 45360 / Math.SQRT2
  const baseTime = distance * baseMinutesPerUnit

  // Adjust by hyperdrive rating
  return Math.round(baseTime * hyperdriveRating)
}

/**
 * Get the position of a fleet at a specific story time
 *
 * Returns the fleet's position or null if the fleet is "in transit" without a visible position
 */
export function getFleetPositionAtTime(fleet: Fleet, storyTime: number): FleetPosition {
  // Sort movements by start time
  const sortedMovements = [...fleet.movements].sort((a, b) => a.startStoryTime - b.startStoryTime)

  // If no movements, fleet is at default position
  if (sortedMovements.length === 0) {
    return {
      x: fleet.defaultX,
      y: fleet.defaultY,
      status: 'stationed',
    }
  }

  // Check if before first movement
  const firstMovement = sortedMovements[0]
  if (storyTime < firstMovement.startStoryTime) {
    return {
      x: fleet.defaultX,
      y: fleet.defaultY,
      status: 'stationed',
    }
  }

  // Find the relevant movement
  for (let i = 0; i < sortedMovements.length; i++) {
    const movement = sortedMovements[i]
    const nextMovement = sortedMovements[i + 1]

    // Currently in transit for this movement
    if (storyTime >= movement.startStoryTime && storyTime < movement.endStoryTime) {
      // Interpolate position
      const progress = (storyTime - movement.startStoryTime) / (movement.endStoryTime - movement.startStoryTime)
      return {
        x: movement.startX + (movement.endX - movement.startX) * progress,
        y: movement.startY + (movement.endY - movement.startY) * progress,
        status: 'in_transit',
      }
    }

    // After this movement ends
    if (storyTime >= movement.endStoryTime) {
      // If there's a next movement and we haven't reached it yet, fleet is stationed
      if (nextMovement && storyTime < nextMovement.startStoryTime) {
        return {
          x: movement.endX,
          y: movement.endY,
          status: 'stationed',
        }
      }

      // If this is the last movement and we're past it, fleet is at final position
      if (!nextMovement) {
        return {
          x: movement.endX,
          y: movement.endY,
          status: 'stationed',
        }
      }
    }
  }

  // Fallback (shouldn't reach here)
  return {
    x: fleet.defaultX,
    y: fleet.defaultY,
    status: 'stationed',
  }
}

/**
 * Check if a fleet is currently in transit at a given time
 */
export function isFleetInTransit(fleet: Fleet, storyTime: number): boolean {
  return getFleetPositionAtTime(fleet, storyTime).status === 'in_transit'
}

/**
 * Get the currently active movement (if any) for a fleet at a given time
 * Returns the movement where storyTime is between startStoryTime and endStoryTime
 */
export function getActiveMovement(fleet: Fleet, storyTime: number) {
  return fleet.movements.find((m) => storyTime >= m.startStoryTime && storyTime < m.endStoryTime)
}
