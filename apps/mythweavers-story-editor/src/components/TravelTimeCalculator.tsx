import { Alert, Button, Card, CardBody, FormField, Modal, Select, Spinner, Stack } from '@mythweavers/ui'
import { Component, For, Show, createEffect, createSignal } from 'solid-js'
import { mapsStore } from '../stores/mapsStore'
import { apiClient } from '../utils/apiClient'
import { type PathSegment, calculateOptimalPath, formatTravelTime } from '../utils/maps/pathfinding'

interface Landmark {
  id: string
  mapId: string
  name: string
  x: number
  y: number
  description?: string
  region?: string
  sector?: string
  type?: string
  population?: string
  industry?: string
  planetaryBodies?: string
  color?: string
  size?: string
}

interface Hyperlane {
  id: string
  mapId: string
  speedMultiplier: number
  segments: {
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
  }[]
}

interface TravelTimeCalculatorProps {
  isOpen: boolean
  onClose: () => void
  storyId: string
}

export const TravelTimeCalculator: Component<TravelTimeCalculatorProps> = (props) => {
  const [selectedMapId, setSelectedMapId] = createSignal<string>('')
  const [landmarks, setLandmarks] = createSignal<Landmark[]>([])
  const [hyperlanes, setHyperlanes] = createSignal<Hyperlane[]>([])
  const [fromLandmarkId, setFromLandmarkId] = createSignal<string>('')
  const [toLandmarkId, setToLandmarkId] = createSignal<string>('')
  const [hyperdriveRating, setHyperdriveRating] = createSignal<number>(1)
  const [result, setResult] = createSignal<{ totalTime: number; segments: PathSegment[] } | null>(null)
  const [isLoading, setIsLoading] = createSignal(false)
  const [error, setError] = createSignal<string>('')

  // Load map data when map is selected
  createEffect(async () => {
    const mapId = selectedMapId()
    if (!mapId) {
      setLandmarks([])
      setHyperlanes([])
      return
    }

    setIsLoading(true)
    setError('')
    try {
      const [landmarksData, hyperlanesData] = await Promise.all([
        apiClient.getMapLandmarks(mapId),
        apiClient.getMapHyperlanes(mapId),
      ])
      setLandmarks(landmarksData)
      setHyperlanes(hyperlanesData)
    } catch (err) {
      setError(`Failed to load map data: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  })

  const handleCalculate = () => {
    const fromId = fromLandmarkId()
    const toId = toLandmarkId()
    const rating = hyperdriveRating()

    if (!fromId || !toId) {
      setError('Please select both start and destination landmarks')
      return
    }

    if (fromId === toId) {
      setError('Start and destination cannot be the same')
      return
    }

    const fromLandmark = landmarks().find((l) => l.id === fromId)
    const toLandmark = landmarks().find((l) => l.id === toId)

    if (!fromLandmark || !toLandmark) {
      setError('Selected landmarks not found')
      return
    }

    setError('')
    const pathResult = calculateOptimalPath(
      fromLandmark.x,
      fromLandmark.y,
      toLandmark.x,
      toLandmark.y,
      landmarks(),
      hyperlanes(),
      rating,
    )

    setResult(pathResult)
  }

  const getLandmarkLabel = (landmarkId: string | null | undefined, x: number, y: number): string => {
    if (landmarkId) {
      const landmark = landmarks().find((l) => l.id === landmarkId)
      if (landmark?.name) {
        return landmark.name
      }
    }

    // Find nearest landmark
    let nearestName: string | undefined
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const landmark of landmarks()) {
      const dx = landmark.x - x
      const dy = landmark.y - y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestName = landmark.name
      }
    }

    return nearestDistance <= 0.01 && nearestName ? nearestName : `${x.toFixed(3)},${y.toFixed(3)}`
  }

  const handleClose = () => {
    setResult(null)
    setError('')
    setFromLandmarkId('')
    setToLandmarkId('')
    setHyperdriveRating(1)
    props.onClose()
  }

  return (
    <Modal open={props.isOpen} onClose={handleClose} title="Travel Time Calculator" size="md">
      <Stack gap="md">
        <FormField label="Map">
          <Select
            value={selectedMapId()}
            onChange={(e) => setSelectedMapId(e.currentTarget.value)}
            placeholder="Select a map..."
            options={mapsStore.maps.map((map) => ({ value: map.id, label: map.name }))}
          />
        </FormField>

        <Show when={selectedMapId() && !isLoading()}>
          <FormField label="From">
            <Select
              value={fromLandmarkId()}
              onChange={(e) => setFromLandmarkId(e.currentTarget.value)}
              placeholder="Select start landmark..."
              options={landmarks().map((landmark) => ({
                value: landmark.id,
                label: landmark.name + (landmark.region ? ` (${landmark.region})` : ''),
              }))}
            />
          </FormField>

          <FormField label="To">
            <Select
              value={toLandmarkId()}
              onChange={(e) => setToLandmarkId(e.currentTarget.value)}
              placeholder="Select destination landmark..."
              options={landmarks().map((landmark) => ({
                value: landmark.id,
                label: landmark.name + (landmark.region ? ` (${landmark.region})` : ''),
              }))}
            />
          </FormField>

          <FormField
            label={
              <>
                Hyperdrive Rating:{' '}
                <span style={{ color: 'var(--primary-color)', 'font-weight': '600' }}>{hyperdriveRating()}</span>
              </>
            }
            hint="Lower is faster (0.1 = very fast, 10 = very slow)"
          >
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={hyperdriveRating()}
              onInput={(e) => setHyperdriveRating(Number.parseFloat(e.currentTarget.value))}
              style={{ width: '100%' }}
            />
          </FormField>

          <Button onClick={handleCalculate} disabled={!fromLandmarkId() || !toLandmarkId()} fullWidth>
            Calculate Route
          </Button>
        </Show>

        <Show when={isLoading()}>
          <div
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              gap: '0.5rem',
              padding: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            <Spinner size="sm" />
            <span>Loading map data...</span>
          </div>
        </Show>

        <Show when={error()}>
          <Alert variant="error">{error()}</Alert>
        </Show>

        <Show when={result()}>
          {(r) => (
            <Stack gap="md" style={{ 'padding-top': '1rem', 'border-top': '1px solid var(--border-color)' }}>
              <Card>
                <CardBody>
                  <strong>Total Travel Time:</strong>{' '}
                  <span style={{ color: 'var(--primary-color)', 'font-weight': '600' }}>
                    {r().totalTime} minutes ({formatTravelTime(r().totalTime)})
                  </span>
                </CardBody>
              </Card>

              <Show when={r().segments.length > 0}>
                <div style={{ 'font-weight': '600', 'font-size': '0.875rem' }}>Route Segments:</div>
                <Stack gap="sm">
                  <For each={r().segments}>
                    {(segment, index) => {
                      const typeLabel =
                        segment.type === 'hyperlane'
                          ? `Hyperlane${segment.hyperlaneId ? ` (${segment.hyperlaneId.substring(0, 8)}...)` : ''}`
                          : 'Normal space'
                      const from = getLandmarkLabel(segment.startLandmarkId, segment.startX, segment.startY)
                      const to = getLandmarkLabel(segment.endLandmarkId, segment.endX, segment.endY)

                      return (
                        <div
                          style={{
                            display: 'flex',
                            gap: '0.5rem',
                            padding: '0.5rem',
                            background: 'var(--bg-tertiary)',
                            'border-radius': 'var(--radius-sm)',
                            'font-size': '0.875rem',
                          }}
                        >
                          <div style={{ 'font-weight': '600', color: 'var(--text-secondary)', 'min-width': '1.5rem' }}>
                            {index() + 1}.
                          </div>
                          <div style={{ flex: '1' }}>
                            <div style={{ 'font-weight': '500' }}>{typeLabel}</div>
                            <div style={{ color: 'var(--text-secondary)', 'margin-bottom': '0.25rem' }}>
                              {from} → {to}
                            </div>
                            <div style={{ color: 'var(--primary-color)', 'font-size': '0.8125rem' }}>
                              {segment.travelTime} minutes ({formatTravelTime(segment.travelTime)})
                            </div>
                          </div>
                        </div>
                      )
                    }}
                  </For>
                </Stack>
              </Show>

              <Show when={r().segments.length === 0}>
                <div
                  style={{
                    padding: '1rem',
                    'text-align': 'center',
                    color: 'var(--text-secondary)',
                    'font-style': 'italic',
                    'font-size': '0.875rem',
                  }}
                >
                  No segments found (start and end are at the same location).
                </div>
              </Show>
            </Stack>
          )}
        </Show>
      </Stack>
    </Modal>
  )
}
