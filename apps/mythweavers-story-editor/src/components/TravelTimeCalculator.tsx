import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import { apiClient } from '../utils/apiClient';
import { calculateOptimalPath, formatTravelTime, type PathSegment } from '../utils/maps/pathfinding';
import { mapsStore } from '../stores/mapsStore';
import { BsX } from 'solid-icons/bs';
import styles from './TravelTimeCalculator.module.css';

interface Landmark {
  id: string;
  mapId: string;
  name: string;
  x: number;
  y: number;
  description?: string;
  region?: string;
  sector?: string;
  type?: string;
  population?: string;
  industry?: string;
  planetaryBodies?: string;
  color?: string;
  size?: string;
}

interface Hyperlane {
  id: string;
  mapId: string;
  speedMultiplier: number;
  segments: {
    id: string;
    hyperlaneId: string;
    mapId: string;
    order: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    startLandmarkId?: string | null;
    endLandmarkId?: string | null;
  }[];
}

interface TravelTimeCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  storyId: string;
}

export const TravelTimeCalculator: Component<TravelTimeCalculatorProps> = (props) => {
  const [selectedMapId, setSelectedMapId] = createSignal<string>('');
  const [landmarks, setLandmarks] = createSignal<Landmark[]>([]);
  const [hyperlanes, setHyperlanes] = createSignal<Hyperlane[]>([]);
  const [fromLandmarkId, setFromLandmarkId] = createSignal<string>('');
  const [toLandmarkId, setToLandmarkId] = createSignal<string>('');
  const [hyperdriveRating, setHyperdriveRating] = createSignal<number>(1);
  const [result, setResult] = createSignal<{ totalTime: number; segments: PathSegment[] } | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string>('');

  // Load map data when map is selected
  createEffect(async () => {
    const mapId = selectedMapId();
    if (!mapId) {
      setLandmarks([]);
      setHyperlanes([]);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const [landmarksData, hyperlanesData] = await Promise.all([
        apiClient.getMapLandmarks(mapId),
        apiClient.getMapHyperlanes(mapId),
      ]);
      setLandmarks(landmarksData);
      setHyperlanes(hyperlanesData);
    } catch (err) {
      setError(`Failed to load map data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  });

  const handleCalculate = () => {
    const fromId = fromLandmarkId();
    const toId = toLandmarkId();
    const rating = hyperdriveRating();

    if (!fromId || !toId) {
      setError('Please select both start and destination landmarks');
      return;
    }

    if (fromId === toId) {
      setError('Start and destination cannot be the same');
      return;
    }

    const fromLandmark = landmarks().find(l => l.id === fromId);
    const toLandmark = landmarks().find(l => l.id === toId);

    if (!fromLandmark || !toLandmark) {
      setError('Selected landmarks not found');
      return;
    }

    setError('');
    const pathResult = calculateOptimalPath(
      fromLandmark.x,
      fromLandmark.y,
      toLandmark.x,
      toLandmark.y,
      landmarks(),
      hyperlanes(),
      rating
    );

    setResult(pathResult);
  };

  const getLandmarkLabel = (landmarkId: string | null | undefined, x: number, y: number): string => {
    if (landmarkId) {
      const landmark = landmarks().find(l => l.id === landmarkId);
      if (landmark?.name) {
        return landmark.name;
      }
    }

    // Find nearest landmark
    let nearestName: string | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const landmark of landmarks()) {
      const dx = landmark.x - x;
      const dy = landmark.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestName = landmark.name;
      }
    }

    return nearestDistance <= 0.01 && nearestName
      ? nearestName
      : `${x.toFixed(3)},${y.toFixed(3)}`;
  };

  const handleClose = () => {
    setResult(null);
    setError('');
    setFromLandmarkId('');
    setToLandmarkId('');
    setHyperdriveRating(1);
    props.onClose();
  };

  return (
    <Show when={props.isOpen}>
      <div class={styles.overlay} onClick={handleClose}>
        <div class={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div class={styles.header}>
            <h2>Travel Time Calculator</h2>
            <button class={styles.closeButton} onClick={handleClose} title="Close">
              <BsX size={24} />
            </button>
          </div>

          <div class={styles.content}>
            <div class={styles.formGroup}>
              <label>Map:</label>
              <select
                value={selectedMapId()}
                onChange={(e) => setSelectedMapId(e.currentTarget.value)}
                class={styles.select}
              >
                <option value="">Select a map...</option>
                <For each={mapsStore.maps}>
                  {(map) => <option value={map.id}>{map.name}</option>}
                </For>
              </select>
            </div>

            <Show when={selectedMapId() && !isLoading()}>
              <div class={styles.formGroup}>
                <label>From:</label>
                <select
                  value={fromLandmarkId()}
                  onChange={(e) => setFromLandmarkId(e.currentTarget.value)}
                  class={styles.select}
                >
                  <option value="">Select start landmark...</option>
                  <For each={landmarks()}>
                    {(landmark) => (
                      <option value={landmark.id}>
                        {landmark.name}
                        {landmark.region ? ` (${landmark.region})` : ''}
                      </option>
                    )}
                  </For>
                </select>
              </div>

              <div class={styles.formGroup}>
                <label>To:</label>
                <select
                  value={toLandmarkId()}
                  onChange={(e) => setToLandmarkId(e.currentTarget.value)}
                  class={styles.select}
                >
                  <option value="">Select destination landmark...</option>
                  <For each={landmarks()}>
                    {(landmark) => (
                      <option value={landmark.id}>
                        {landmark.name}
                        {landmark.region ? ` (${landmark.region})` : ''}
                      </option>
                    )}
                  </For>
                </select>
              </div>

              <div class={styles.formGroup}>
                <label>
                  Hyperdrive Rating:
                  <span class={styles.ratingValue}>{hyperdriveRating()}</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={hyperdriveRating()}
                  onInput={(e) => setHyperdriveRating(parseFloat(e.currentTarget.value))}
                  class={styles.slider}
                />
                <div class={styles.ratingHint}>
                  Lower is faster (0.1 = very fast, 10 = very slow)
                </div>
              </div>

              <button
                onClick={handleCalculate}
                disabled={!fromLandmarkId() || !toLandmarkId()}
                class={styles.calculateButton}
              >
                Calculate Route
              </button>
            </Show>

            <Show when={isLoading()}>
              <div class={styles.loading}>Loading map data...</div>
            </Show>

            <Show when={error()}>
              <div class={styles.error}>{error()}</div>
            </Show>

            <Show when={result()}>
              {(r) => (
                <div class={styles.results}>
                  <div class={styles.totalTime}>
                    <strong>Total Travel Time:</strong>{' '}
                    <span class={styles.timeValue}>
                      {r().totalTime} minutes ({formatTravelTime(r().totalTime)})
                    </span>
                  </div>

                  <Show when={r().segments.length > 0}>
                    <div class={styles.segmentsHeader}>Route Segments:</div>
                    <div class={styles.segments}>
                      <For each={r().segments}>
                        {(segment, index) => {
                          const typeLabel = segment.type === 'hyperlane'
                            ? `Hyperlane${segment.hyperlaneId ? ` (${segment.hyperlaneId.substring(0, 8)}...)` : ''}`
                            : 'Normal space';
                          const from = getLandmarkLabel(segment.startLandmarkId, segment.startX, segment.startY);
                          const to = getLandmarkLabel(segment.endLandmarkId, segment.endX, segment.endY);

                          return (
                            <div class={styles.segment}>
                              <div class={styles.segmentNumber}>{index() + 1}.</div>
                              <div class={styles.segmentDetails}>
                                <div class={styles.segmentType}>{typeLabel}</div>
                                <div class={styles.segmentRoute}>
                                  {from} → {to}
                                </div>
                                <div class={styles.segmentTime}>
                                  {segment.travelTime} minutes ({formatTravelTime(segment.travelTime)})
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </Show>

                  <Show when={r().segments.length === 0}>
                    <div class={styles.noSegments}>
                      No segments found (start and end are at the same location).
                    </div>
                  </Show>
                </div>
              )}
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};
