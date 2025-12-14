# Timeline Refactor Plan

## Overview
Refactor the map timeline system to use global story time instead of message-based indices. This allows events (fleet movements, landmark state changes) to occur at any point in story time, regardless of whether chapters exist at those moments.

## Current State Problems

**Maps.tsx (lines 160-207)**: Timeline currently works with message indices
- `assistantMessages()` - filters messages by index
- Slider range: `0` to `assistantMessages().length - 1`
- `currentMessageId()` - derived from slider position as array index
- `handleTimelineChange()` - updates slider value (integer message index)

**Issues:**
1. Timeline only has positions where messages exist
2. Can't represent time between chapters
3. Can't show fleet movements during transit
4. Events are tied to messages, not actual story time
5. Timeline resolution is coarse (one position per chapter)

## Proposed Solution

### 1. Global Timeline Configuration

Add to Story settings (database and UI):

```typescript
interface Story {
  // ... existing fields
  timelineStartTime?: number;  // Story time in minutes from 0 BBY
  timelineEndTime?: number;    // Story time in minutes from 0 BBY
  timelineGranularity?: 'hour' | 'day'; // Slider increment size (week removed - doesn't divide evenly into 368 days)
}
```

**Defaults:**
- If not set, auto-calculate from earliest/latest chapter storyTime
- Add buffer (e.g., ±7 days) to allow events before/after chapters
- Default granularity: 'hour' (60 minutes per tick)

### 2. Timeline Slider Changes

**Current:**
```typescript
// Message-based
const sliderValue = createSignal(0);
const maxValue = assistantMessages().length - 1;
```

**New:**
```typescript
// Time-based
const currentStoryTime = createSignal<number>(timelineStartTime); // minutes from 0 BBY
const timelineRange = () => ({
  start: story.timelineStartTime || autoCalculatedStart(),
  end: story.timelineEndTime || autoCalculatedEnd(),
  granularity: story.timelineGranularity || 'hour'
});

// Slider converts position to story time
const sliderSteps = () => {
  const range = timelineRange();
  const granularityMinutes = getGranularityMinutes(range.granularity);
  return Math.ceil((range.end - range.start) / granularityMinutes);
};
```

**Granularity conversion:**
```typescript
function getGranularityMinutes(granularity: 'hour' | 'day'): number {
  switch (granularity) {
    case 'hour': return 60;
    case 'day': return 1440; // 24 * 60
  }
}
```

### 3. Finding Active Chapter at Story Time

**New utility function:**
```typescript
function getChapterAtStoryTime(storyTime: number, nodes: Node[]): Node | null {
  // Get chapters sorted by storyTime
  const chaptersWithTime = nodes
    .filter(n => n.type === 'chapter' && n.storyTime !== null && n.storyTime !== undefined)
    .sort((a, b) => a.storyTime! - b.storyTime!);

  // Find the latest chapter that starts at or before this time
  let activeChapter = null;
  for (const chapter of chaptersWithTime) {
    if (chapter.storyTime! <= storyTime) {
      activeChapter = chapter;
    } else {
      break;
    }
  }

  return activeChapter;
}
```

**Edge cases:**
- If `storyTime` is before all chapters: return null (pre-story state)
- If `storyTime` is after all chapters: return last chapter
- If no chapters have storyTime set: return null (graceful degradation)

### 4. Landmark States at Story Time

**Current:** States are tied to specific messages

**New approach:** States accumulate over story time

```typescript
interface LandmarkState {
  // ... existing fields
  storyTime?: number;  // When this state change occurs (minutes from 0 BBY)
  messageId?: string;  // Optional - for backwards compatibility
}
```

**State resolution algorithm:**
```typescript
function getLandmarkStatesAtStoryTime(
  storyTime: number,
  allStates: LandmarkState[]
): Record<string, LandmarkState> {
  // Group states by landmark+field
  const statesByKey = new Map<string, LandmarkState[]>();

  for (const state of allStates) {
    const key = `${state.landmarkId}_${state.field}`;
    if (!statesByKey.has(key)) {
      statesByKey.set(key, []);
    }
    statesByKey.get(key)!.push(state);
  }

  // For each landmark+field, find the most recent state at or before storyTime
  const accumulatedStates: Record<string, LandmarkState> = {};

  for (const [key, states] of statesByKey) {
    // Sort by time (prefer storyTime, fall back to message order)
    const sortedStates = states.sort((a, b) => {
      const timeA = a.storyTime ?? getStoryTimeForMessage(a.messageId);
      const timeB = b.storyTime ?? getStoryTimeForMessage(b.messageId);
      return timeA - timeB;
    });

    // Find latest state at or before current time
    for (const state of sortedStates) {
      const stateTime = state.storyTime ?? getStoryTimeForMessage(state.messageId);
      if (stateTime <= storyTime) {
        if (!state.deleted) {
          accumulatedStates[key] = state;
        } else {
          delete accumulatedStates[key];
        }
      } else {
        break;
      }
    }
  }

  return accumulatedStates;
}

function getStoryTimeForMessage(messageId: string): number {
  // Find the chapter this message belongs to and use its storyTime
  const chapter = findChapterForMessage(messageId);
  return chapter?.storyTime ?? 0;
}
```

### 5. Fleet Movement System (Future)

**Data model:**
```typescript
interface Fleet {
  id: string;
  storyId: string;
  name: string;
  icon?: string; // SVG icon or emoji
  color?: string; // Hex color for the fleet marker

  // Movement waypoints
  waypoints: FleetWaypoint[];
}

interface FleetWaypoint {
  id: string;
  fleetId: string;
  landmarkId: string; // Which landmark the fleet is at/moving to
  arrivalTime: number; // Story time when fleet arrives (minutes from 0 BBY)
  departureTime?: number; // When fleet leaves (null = stays indefinitely)
  order: number; // Sequence of waypoints
}
```

**Position interpolation:**
```typescript
function getFleetPositionAtStoryTime(
  fleet: Fleet,
  storyTime: number,
  landmarks: Map<string, Landmark>
): { x: number, y: number, status: 'docked' | 'transit' } {
  // Find surrounding waypoints
  const sortedWaypoints = fleet.waypoints.sort((a, b) => a.order - b.order);

  let currentWaypoint = null;
  let nextWaypoint = null;

  for (let i = 0; i < sortedWaypoints.length; i++) {
    const wp = sortedWaypoints[i];

    if (storyTime >= wp.arrivalTime) {
      if (!wp.departureTime || storyTime < wp.departureTime) {
        // Fleet is docked at this waypoint
        const landmark = landmarks.get(wp.landmarkId);
        return {
          x: landmark!.x,
          y: landmark!.y,
          status: 'docked'
        };
      }
      currentWaypoint = wp;
      nextWaypoint = sortedWaypoints[i + 1];
    }
  }

  // Fleet is in transit between currentWaypoint and nextWaypoint
  if (currentWaypoint && nextWaypoint) {
    const fromLandmark = landmarks.get(currentWaypoint.landmarkId)!;
    const toLandmark = landmarks.get(nextWaypoint.landmarkId)!;

    const transitStart = currentWaypoint.departureTime!;
    const transitEnd = nextWaypoint.arrivalTime;
    const progress = (storyTime - transitStart) / (transitEnd - transitStart);

    return {
      x: fromLandmark.x + (toLandmark.x - fromLandmark.x) * progress,
      y: fromLandmark.y + (toLandmark.y - fromLandmark.y) * progress,
      status: 'transit'
    };
  }

  // Fleet hasn't started moving yet or finished all waypoints
  const firstWaypoint = sortedWaypoints[0];
  if (firstWaypoint && storyTime < firstWaypoint.arrivalTime) {
    // Before first waypoint - show at first location but faded?
    const landmark = landmarks.get(firstWaypoint.landmarkId)!;
    return { x: landmark.x, y: landmark.y, status: 'docked' };
  }

  // After all waypoints - stay at last location
  const lastWaypoint = sortedWaypoints[sortedWaypoints.length - 1];
  const landmark = landmarks.get(lastWaypoint.landmarkId)!;
  return { x: landmark.x, y: landmark.y, status: 'docked' };
}
```

### 6. UI Changes

#### MapTimeline Component (new file: src/components/maps/MapTimeline.tsx)

```typescript
interface MapTimelineProps {
  storyId: string;
  currentStoryTime: Accessor<number>;
  onTimeChange: (newTime: number) => void;
}

export const MapTimeline: Component<MapTimelineProps> = (props) => {
  const timeline = createMemo(() => {
    const story = /* get from store */;
    return {
      start: story.timelineStartTime ?? autoCalculatedStart(),
      end: story.timelineEndTime ?? autoCalculatedEnd(),
      granularity: story.timelineGranularity ?? 'hour'
    };
  });

  const sliderSteps = createMemo(() => {
    const t = timeline();
    const granularityMinutes = getGranularityMinutes(t.granularity);
    return Math.ceil((t.end - t.start) / granularityMinutes);
  });

  const sliderPosition = createMemo(() => {
    const t = timeline();
    const granularityMinutes = getGranularityMinutes(t.granularity);
    return Math.floor((props.currentStoryTime() - t.start) / granularityMinutes);
  });

  const handleSliderChange = (position: number) => {
    const t = timeline();
    const granularityMinutes = getGranularityMinutes(t.granularity);
    const newStoryTime = t.start + (position * granularityMinutes);
    props.onTimeChange(newStoryTime);
  };

  return (
    <div class={styles.timeline}>
      <div class={styles.timeDisplay}>
        {formatStoryTime(props.currentStoryTime(), true)}
      </div>
      <input
        type="range"
        min={0}
        max={sliderSteps()}
        value={sliderPosition()}
        onInput={(e) => handleSliderChange(parseInt(e.currentTarget.value))}
      />
      <div class={styles.timelineMarkers}>
        {/* Chapter markers at their storyTime positions */}
        <For each={getChaptersWithTime()}>
          {(chapter) => (
            <ChapterMarker
              chapter={chapter}
              position={getMarkerPosition(chapter.storyTime!)}
              onClick={() => props.onTimeChange(chapter.storyTime!)}
            />
          )}
        </For>
      </div>
    </div>
  );
};
```

#### Story Settings Dialog

Add timeline configuration section:
- Start Time: StoryTimePicker
- End Time: StoryTimePicker
- Granularity: Select (Hour/Day)
- Auto-calculate button: Sets start/end based on chapters ±7 days

### 7. Migration Strategy

**Phase 1: Add storyTime to existing data** ✅ DONE
- Added storyTime to Node schema
- Created StoryTimePicker component
- Integrated into NodeHeader

**Phase 2: Migrate landmark states** (NEXT)
1. Add storyTime field to LandmarkState model
2. Backfill storyTime from messages:
   ```sql
   UPDATE LandmarkState
   SET storyTime = (
     SELECT Node.storyTime
     FROM Node
     WHERE Node.id IN (
       SELECT Message.nodeId
       FROM Message
       WHERE Message.id = LandmarkState.messageId
     )
   )
   ```
3. Keep messageId for backwards compatibility

**Phase 3: Refactor Maps.tsx**
1. Extract MapTimeline component
2. Replace message-based signals with time-based signals
3. Update state accumulation logic
4. Test with existing stories

**Phase 4: Add global timeline settings**
1. Add fields to Story model
2. Add UI in Settings dialog
3. Implement auto-calculation

**Phase 5: Fleet system** (FUTURE)
1. Add Fleet/FleetWaypoint models
2. Create fleet editor UI
3. Implement position interpolation
4. Render fleets on map

### 8. Testing Considerations

**Edge cases to test:**
1. Story with no chapters having storyTime set
2. Timeline position before first chapter
3. Timeline position after last chapter
4. Landmark state changes between chapters
5. Multiple state changes for same landmark
6. Deleted states at various times
7. Fleet in transit at timeline position
8. Fleet docked at landmark

**Backwards compatibility:**
- Stories without timeline settings should still work (use auto-calculation)
- Landmark states without storyTime should fall back to message order
- Timeline should gracefully handle missing data

### 9. Implementation Checklist

- [ ] Add Story.timelineStartTime, timelineEndTime, timelineGranularity to schema
- [ ] Add LandmarkState.storyTime to schema
- [ ] Create migration to backfill storyTime from messages
- [ ] Create MapTimeline component
- [ ] Extract timeline logic from Maps.tsx into MapTimeline
- [ ] Update getLandmarkStatesAtStoryTime to use story time
- [ ] Add timeline settings to Story settings dialog
- [ ] Add auto-calculate timeline range utility
- [ ] Add chapter markers to timeline UI
- [ ] Test with existing stories
- [ ] Document new timeline system

### 10. Future Enhancements

- **Fleet system** - movable elements with waypoints
- **Event markers** - non-chapter events on timeline (battles, treaties, etc.)
- **Multi-map support** - different maps active at different times
- **Timeline zoom** - ability to zoom in/out on timeline for detail vs overview
- **Playback mode** - animate through timeline automatically
- **Timeline scrubbing** - smooth dragging instead of discrete steps
- **State previews** - show upcoming state changes as you scrub timeline
