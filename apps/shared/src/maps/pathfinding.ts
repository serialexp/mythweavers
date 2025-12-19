import { DijkstraCalculator } from '@aeolun/dijkstra-calculator'

export interface PathfindingLandmark {
  id: string
  mapId: string
  x: number
  y: number
  name: string
  description?: string
  type?: string
  population?: string
  industry?: string
  planetaryBodies?: string
  region?: string
  sector?: string
  color?: string
  size?: string
}

export interface PathfindingHyperlaneSegment {
  id: string
  hyperlaneId: string
  mapId: string
  order: number
  startX: number
  startY: number
  endX: number
  endY: number
  startLandmarkId?: string | null
  endLandmarkId?: string | null
}

export interface PathfindingHyperlane {
  id: string
  mapId: string
  speedMultiplier: number
  segments: PathfindingHyperlaneSegment[]
}

interface PathNode {
  id: string
  x: number
  y: number
  type: 'junction' | 'start' | 'end'
}

export interface PathSegment {
  startX: number
  startY: number
  endX: number
  endY: number
  travelTime: number
  type: 'normal' | 'hyperlane'
  hyperlaneId?: string
  startLandmarkId?: string | null
  endLandmarkId?: string | null
}

export interface PathfindingResult {
  segments: PathSegment[]
  totalTime: number
  path: string[]
}

const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24
const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY
const DAYS_PER_MONTH = 31.5
const MINUTES_PER_MONTH = DAYS_PER_MONTH * MINUTES_PER_DAY

function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

function calculateTravelTime(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  hyperdriveRating: number,
): number {
  const distance = calculateDistance(startX, startY, endX, endY)
  const baseMinutesPerUnit = (MINUTES_PER_MONTH * 4.5) / Math.SQRT2
  const baseTime = distance * baseMinutesPerUnit
  return Math.round(baseTime * hyperdriveRating)
}

function buildPathfindingGraph(
  landmarks: PathfindingLandmark[],
  hyperlanes: PathfindingHyperlane[],
  hyperdriveRating: number,
): {
  graph: DijkstraCalculator<never>
  nodes: Map<string, PathNode>
  edgeHyperlanes: Map<string, string>
} {
  const graph = new DijkstraCalculator<never>()
  const nodes = new Map<string, PathNode>()
  const edgeHyperlanes = new Map<string, string>()

  const connectedLandmarkIds = new Set<string>()

  for (const hyperlane of hyperlanes) {
    for (const segment of hyperlane.segments) {
      if (segment.startLandmarkId) {
        connectedLandmarkIds.add(segment.startLandmarkId)
      }
      if (segment.endLandmarkId) {
        connectedLandmarkIds.add(segment.endLandmarkId)
      }
    }
  }

  for (const landmark of landmarks) {
    if (landmark.type === 'junction' || connectedLandmarkIds.has(landmark.id)) {
      const nodeId = `landmark_${landmark.id}`
      nodes.set(nodeId, {
        id: nodeId,
        x: landmark.x,
        y: landmark.y,
        type: 'junction',
      })
      graph.addVertex(nodeId)
    }
  }

  for (const hyperlane of hyperlanes) {
    const sortedSegments = [...hyperlane.segments].sort((a, b) => a.order - b.order)

    for (const segment of sortedSegments) {
      if (segment.startLandmarkId && segment.endLandmarkId) {
        const startNodeId = `landmark_${segment.startLandmarkId}`
        const endNodeId = `landmark_${segment.endLandmarkId}`

        const startNode = nodes.get(startNodeId)
        const endNode = nodes.get(endNodeId)

        if (startNode && endNode) {
          const normalTime = calculateTravelTime(
            segment.startX,
            segment.startY,
            segment.endX,
            segment.endY,
            hyperdriveRating,
          )
          const hyperlaneTime = normalTime / hyperlane.speedMultiplier

          graph.addEdge(startNodeId, endNodeId, { weight: hyperlaneTime })
          graph.addEdge(endNodeId, startNodeId, { weight: hyperlaneTime })
          edgeHyperlanes.set(`${startNodeId}|${endNodeId}`, hyperlane.id)
          edgeHyperlanes.set(`${endNodeId}|${startNodeId}`, hyperlane.id)
        }
      }
    }
  }

  return { graph, nodes, edgeHyperlanes }
}

function findNearestLandmark(
  x: number,
  y: number,
  landmarks: PathfindingLandmark[],
  snapThreshold = 0.0025,
): PathfindingLandmark | null {
  let nearestLandmark: PathfindingLandmark | null = null
  let nearestDistance = snapThreshold

  for (const landmark of landmarks) {
    const distance = calculateDistance(x, y, landmark.x, landmark.y)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestLandmark = landmark
    }
  }

  return nearestLandmark
}

function findNearestJunctions(x: number, y: number, nodes: Map<string, PathNode>, count = 3): PathNode[] {
  const entries = Array.from(nodes.values()).map((node) => ({
    node,
    distance: calculateDistance(x, y, node.x, node.y),
  }))

  entries.sort((a, b) => a.distance - b.distance)

  return entries.slice(0, count).map((item) => item.node)
}

export function calculateOptimalPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  landmarks: PathfindingLandmark[],
  hyperlanes: PathfindingHyperlane[],
  hyperdriveRating: number,
): PathfindingResult {
  const snappedStart = findNearestLandmark(startX, startY, landmarks)
  if (snappedStart) {
    startX = snappedStart.x
    startY = snappedStart.y
  }
  const snappedEnd = findNearestLandmark(endX, endY, landmarks)
  if (snappedEnd) {
    endX = snappedEnd.x
    endY = snappedEnd.y
  }

  const { graph, nodes, edgeHyperlanes } = buildPathfindingGraph(landmarks, hyperlanes, hyperdriveRating)

  const directTime = calculateTravelTime(startX, startY, endX, endY, hyperdriveRating)

  if (nodes.size === 0) {
    return {
      segments: [
        {
          startX,
          startY,
          endX,
          endY,
          travelTime: directTime,
          type: 'normal',
          startLandmarkId: snappedStart?.id ?? undefined,
          endLandmarkId: snappedEnd?.id ?? undefined,
        },
      ],
      totalTime: directTime,
      path: [],
    }
  }

  const startJunctions = findNearestJunctions(startX, startY, nodes, 3)
  const endJunctions = findNearestJunctions(endX, endY, nodes, 3)

  let bestPath: PathfindingResult | null = null
  let bestTime = directTime

  for (const startJunction of startJunctions) {
    const timeToStart = calculateTravelTime(startX, startY, startJunction.x, startJunction.y, hyperdriveRating)

    for (const endJunction of endJunctions) {
      const timeFromEnd = calculateTravelTime(endJunction.x, endJunction.y, endX, endY, hyperdriveRating)

      if (startJunction.id === endJunction.id) {
        const totalTime = timeToStart + timeFromEnd
        if (totalTime < bestTime) {
          bestTime = totalTime
          bestPath = {
            segments: [
              {
                startX,
                startY,
                endX: startJunction.x,
                endY: startJunction.y,
                travelTime: timeToStart,
                type: 'normal',
                startLandmarkId: snappedStart?.id ?? undefined,
                endLandmarkId: startJunction.id.replace('landmark_', ''),
              },
              {
                startX: endJunction.x,
                startY: endJunction.y,
                endX,
                endY,
                travelTime: timeFromEnd,
                type: 'normal',
                startLandmarkId: endJunction.id.replace('landmark_', ''),
                endLandmarkId: snappedEnd?.id ?? undefined,
              },
            ],
            totalTime,
            path: [startJunction.id],
          }
        }
        continue
      }

      try {
        const result = graph.calculateShortestPath(startJunction.id, endJunction.id)

        if (result?.finalPath && result.finalPath.length > 0) {
          const hyperlaneTime = result.pathProperties.priority
          const totalTime = timeToStart + hyperlaneTime + timeFromEnd

          if (totalTime < bestTime) {
            bestTime = totalTime
            const segments: PathSegment[] = [
              {
                startX,
                startY,
                endX: startJunction.x,
                endY: startJunction.y,
                travelTime: timeToStart,
                type: 'normal',
                startLandmarkId: snappedStart?.id ?? undefined,
                endLandmarkId: startJunction.id.replace('landmark_', ''),
              },
            ]

            for (let i = 0; i < result.finalPath.length - 1; i++) {
              const currentId = result.finalPath[i]
              const nextId = result.finalPath[i + 1]
              const currentNode = nodes.get(currentId)
              const nextNode = nodes.get(nextId)
              if (!currentNode || !nextNode) {
                continue
              }

              let travelTime = calculateTravelTime(
                currentNode.x,
                currentNode.y,
                nextNode.x,
                nextNode.y,
                hyperdriveRating,
              )
              let segmentType: PathSegment['type'] = 'normal'
              let hyperlaneId: string | undefined

              const mappedHyperlane = edgeHyperlanes.get(`${currentId}|${nextId}`)
              if (mappedHyperlane) {
                segmentType = 'hyperlane'
                hyperlaneId = mappedHyperlane
                const hyperlaneDetails = hyperlanes.find((lane) => lane.id === mappedHyperlane)
                if (hyperlaneDetails) {
                  travelTime /= hyperlaneDetails.speedMultiplier
                }
              }

              segments.push({
                startX: currentNode.x,
                startY: currentNode.y,
                endX: nextNode.x,
                endY: nextNode.y,
                travelTime: Math.round(travelTime),
                type: segmentType,
                hyperlaneId,
                startLandmarkId: currentId.startsWith('landmark_') ? currentId.replace('landmark_', '') : undefined,
                endLandmarkId: nextId.startsWith('landmark_') ? nextId.replace('landmark_', '') : undefined,
              })
            }

            segments.push({
              startX: endJunction.x,
              startY: endJunction.y,
              endX,
              endY,
              travelTime: timeFromEnd,
              type: 'normal',
              startLandmarkId: endJunction.id.replace('landmark_', ''),
              endLandmarkId: snappedEnd?.id ?? undefined,
            })

            bestPath = {
              segments,
              totalTime,
              path: [...result.finalPath],
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to calculate path between ${startJunction.id} and ${endJunction.id}:`, error)
      }
    }
  }

  if (bestPath) {
    return bestPath
  }

  return {
    segments: [
      {
        startX,
        startY,
        endX,
        endY,
        travelTime: directTime,
        type: 'normal',
        startLandmarkId: snappedStart?.id ?? undefined,
        endLandmarkId: snappedEnd?.id ?? undefined,
      },
    ],
    totalTime: directTime,
    path: [],
  }
}

export function formatTravelTime(minutes: number): string {
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes} minutes`
  }

  const hours = Math.floor(minutes / MINUTES_PER_HOUR)
  const remainingMinutes = minutes % MINUTES_PER_HOUR

  if (hours < HOURS_PER_DAY) {
    if (remainingMinutes === 0) {
      return `${hours} hours`
    }
    return `${hours} hours ${remainingMinutes} minutes`
  }

  const days = Math.floor(hours / HOURS_PER_DAY)
  const remainingHours = hours % HOURS_PER_DAY

  if (days < DAYS_PER_MONTH) {
    const parts = [`${days} day${days === 1 ? '' : 's'}`]
    if (remainingHours > 0) {
      parts.push(`${remainingHours} hour${remainingHours === 1 ? '' : 's'}`)
    }
    if (remainingMinutes > 0) {
      parts.push(`${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`)
    }
    return parts.join(' ')
  }

  const months = Math.floor(days / DAYS_PER_MONTH)
  const remainingDays = Math.round(days % DAYS_PER_MONTH)

  const parts = [`${months} month${months === 1 ? '' : 's'}`]
  if (remainingDays > 0) {
    parts.push(`${remainingDays} day${remainingDays === 1 ? '' : 's'}`)
  }
  return parts.join(' ')
}
