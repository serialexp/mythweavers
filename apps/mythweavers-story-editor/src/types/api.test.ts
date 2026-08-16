import { describe, expect, it } from 'vitest'
import { ApiPawn, ApiPawnMovement, hyperlaneSegmentToSegmentBody, pawnToFleet } from './api'
import { HyperlaneSegment } from './core'

const pawn = (id: string): ApiPawn => ({
  id,
  mapId: 'map-1',
  name: 'Falcon',
  description: null,
  designation: null,
  speed: 2,
  defaultX: 0.5,
  defaultY: 0.5,
  color: null,
  size: null,
})

const movement = (id: string, pawnId: string): ApiPawnMovement => ({
  id,
  storyId: 'story-1',
  mapId: 'map-1',
  pawnId,
  startStoryTime: 0,
  endStoryTime: 120,
  startX: 0.1,
  startY: 0.2,
  endX: 0.8,
  endY: 0.9,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('pawnToFleet', () => {
  it('keeps only the movements belonging to the pawn', () => {
    // Movements are fetched for the whole map in one request, so each pawn has to
    // pick its own out of the shared list.
    const fleet = pawnToFleet(pawn('pawn-1'), [
      movement('m1', 'pawn-1'),
      movement('m2', 'pawn-2'),
      movement('m3', 'pawn-1'),
    ])

    expect(fleet.movements.map((m) => m.id)).toEqual(['m1', 'm3'])
  })

  it('maps the API pawnId onto the local fleetId', () => {
    const fleet = pawnToFleet(pawn('pawn-1'), [movement('m1', 'pawn-1')])

    expect(fleet.movements[0].fleetId).toBe('pawn-1')
  })

  it('yields no movements when none are passed', () => {
    expect(pawnToFleet(pawn('pawn-1')).movements).toEqual([])
  })
})

describe('hyperlaneSegmentToSegmentBody', () => {
  const segment: HyperlaneSegment = {
    id: 'segment-1',
    // Blank on a segment the map editor just built: the lane that owns it is being
    // created in the same action.
    hyperlaneId: '',
    mapId: 'map-1',
    order: 2,
    startX: 0.1,
    startY: 0.2,
    endX: 0.3,
    endY: 0.4,
    startLandmarkId: 'landmark-1',
    endLandmarkId: null,
  }

  it('sends the geometry and the ID, and no path reference', () => {
    const body = hyperlaneSegmentToSegmentBody(segment)

    expect(body).toEqual({
      id: 'segment-1',
      order: 2,
      startX: 0.1,
      startY: 0.2,
      endX: 0.3,
      endY: 0.4,
      startLandmarkId: 'landmark-1',
      endLandmarkId: null,
    })
    expect('pathId' in body).toBe(false)
  })

  it('normalises a missing landmark reference to null', () => {
    const body = hyperlaneSegmentToSegmentBody({ ...segment, startLandmarkId: undefined })

    expect(body.startLandmarkId).toBeNull()
  })
})
