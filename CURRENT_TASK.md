# Computed/Cross-Calendar Holidays - PLANNED

## Status: PLANNING

Support for lunisolar holidays like Easter that depend on multiple calendar systems (solar + lunar).

---

## Problem

Holidays like Easter, Jewish holidays, Islamic holidays, and Chinese New Year are computed based on lunar cycles, not fixed dates or simple "nth weekday of month" rules. Easter specifically is "the first Sunday after the first full moon on or after the spring equinox."

For a medieval European story, you need:
- Easter (computed via Computus algorithm)
- Ash Wednesday (46 days before Easter)
- Palm Sunday (7 days before Easter)
- Good Friday (2 days before Easter)
- Ascension Day (39 days after Easter)
- Pentecost (49 days after Easter)
- Various saints' days (mostly fixed, but some are moveable)

## Proposed Architecture

### Key Insight
A lunar calendar is just another calendar running in parallel. The feature needed is **cross-calendar holiday rules** - holidays that reference conditions in other calendars.

### Potential Rule Types

```typescript
// Offset from another computed holiday
{
  type: 'offsetFromHoliday',
  name: 'Pentecost',
  baseHoliday: 'Easter',  // Reference another holiday by name
  offsetDays: 49,
}

// Cross-calendar query
{
  type: 'crossCalendar',
  name: 'Easter',
  when: {
    calendarId: 'ecclesiastical-lunar',
    condition: 'firstDayOnOrAfter',
    subdivision: 'paschal-month',
    day: 14,  // Paschal full moon
  },
  then: {
    cycleId: 'weekday',
    find: 'nextOrSame',
    dayInCycle: 0,  // Sunday
  }
}

// Or: built-in computus for Easter
{
  type: 'computus',
  name: 'Easter',
  variant: 'gregorian' | 'julian',  // Algorithm variant
}
```

### Implementation Considerations

1. **Multiple calendars per story** - Stories could have multiple calendar configs, each tracking different cycles
2. **Lunar cycle as a calendar** - Model moon phases as a cycle subdivision with ~29.5 day period
3. **Holiday dependency graph** - Some holidays depend on others (Easter → Pentecost)
4. **Computus built-in** - Easter is complex enough it might warrant a built-in algorithm rather than general cross-calendar queries

### Simpler Alternative: Computus + Offsets

Instead of full cross-calendar support, implement:
1. Built-in Easter calculation (Computus algorithm - well documented)
2. `offsetFromHoliday` rule type for dependent holidays
3. This covers 90% of medieval Christian calendar needs

---

# Previous Task: Calendar Per-Subdivision Cycles - COMPLETED

## Status: COMPLETED (Dec 27, 2025)

Refactored the calendar system to support multiple parallel cycles (like week cycles, Glimrong cycles, Hapa cycles) per calendar via per-subdivision `isCycle` property.

---

## Summary

Changed from a single top-level `weekCycle` property to a more flexible per-subdivision `isCycle` approach, allowing fantasy calendars to have multiple parallel cycles (e.g., a 7-day week AND a 5-day Glimrong cycle running simultaneously).

## What Changed

### 1. Type Changes (`apps/shared/src/calendars/types.ts`)
- **Removed** top-level `WeekCycle` interface and `weekCycle` from `CalendarConfig`
- **Added** to `CalendarSubdivision`:
  - `isCycle?: boolean` - Marks subdivision as a parallel cycle instead of hierarchical
  - `epochStartsOnUnit?: number` - Which unit (0-indexed) is day 1 of year 0
- **Renamed** holiday rule types:
  - `nthWeekday` → `nthCycleDay`
  - `lastWeekday` → `lastCycleDay`
- **Added** to cycle-based holiday rules:
  - `cycleId: string` - Which cycle subdivision to use
  - `dayInCycle: number` - Position in the cycle (0-indexed)

### 2. Engine Changes (`apps/shared/src/calendars/engine.ts`)
- **Added** `processCycleSubdivision()` - Uses modulo arithmetic to calculate cycle position
- **Renamed** `getWeekday()` → `getCyclePosition(cycleId)` - Returns position in any cycle
- **Updated** holiday matching to use new `cycleId` and `dayInCycle` fields
- Cycle subdivisions skip hierarchical day calculation

### 3. Preset Updates (`apps/shared/src/calendars/presets.ts`)
- GREGORIAN_CALENDAR now has week as a subdivision with `isCycle: true`:
  ```typescript
  {
    id: 'week',
    name: 'Weekday',
    count: 7,
    isCycle: true,
    epochStartsOnUnit: 1, // Monday
    labels: ['Sunday', 'Monday', ...],
  }
  ```

### 4. UI Updates (`apps/mythweavers-story-editor/src/components/CalendarEditor.tsx`)
- **Removed** separate "Week Cycle" section
- **Added** Mode toggle (Hierarchical/Cycle) to each subdivision
- When Cycle mode enabled:
  - Days per Unit section hidden (cycles don't need it)
  - Nested subdivisions hidden (cycles can't nest)
  - Epoch Starts On selector shown (when labels exist)
- Holiday rule forms updated with:
  - Cycle selector dropdown
  - Day in Cycle dropdown (uses labels from selected cycle)

### 5. Tests (`apps/shared/src/calendars/engine.test.ts`)
- 33 tests all passing
- Added multi-cycle calendar fixture for testing multiple parallel cycles
- Tests verify correct cycle position calculation across year boundaries

---

## Example Usage

```typescript
const calendar: CalendarConfig = {
  // ... basic config ...

  subdivisions: [
    // Hierarchical subdivision
    { id: 'month', count: 12, daysPerUnit: [...], labels: [...] },

    // Parallel cycle 1: Standard week
    {
      id: 'week',
      count: 7,
      isCycle: true,
      epochStartsOnUnit: 1,  // Monday
      labels: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },

    // Parallel cycle 2: Fantasy Glimrong cycle
    {
      id: 'glimrong',
      count: 5,
      isCycle: true,
      epochStartsOnUnit: 2,
      labels: ['Glow', 'Spark', 'Flame', 'Ember', 'Ash'],
    },
  ],

  holidays: [
    { type: 'fixed', name: 'Christmas', subdivisionId: 'month', unit: 12, day: 25 },
    { type: 'nthCycleDay', name: 'Thanksgiving', n: 4, cycleId: 'week', dayInCycle: 4, subdivisionId: 'month', unit: 11 },
    { type: 'lastCycleDay', name: 'Ash Festival', cycleId: 'glimrong', dayInCycle: 4, subdivisionId: 'month', unit: 6 },
  ],
}
```

---

## Breaking Changes

1. **weekCycle removed**: Calendars with top-level `weekCycle` must convert to subdivision with `isCycle: true`
2. **Holiday types renamed**: `nthWeekday` → `nthCycleDay`, `lastWeekday` → `lastCycleDay`
3. **Holiday fields changed**: `weekday` → `dayInCycle`, added `cycleId`

---

# Previous Task: Calendar Holiday Rules - COMPLETED

## Status: COMPLETED (Dec 27, 2025)

Added rule-based holiday definitions to the calendar system with full EJS template support.

---

# Previous Task: Soft Delete for Story Nodes

## Status: COMPLETE (Dec 27, 2025)

Implemented soft-delete for story nodes (Book, Arc, Chapter, Scene) with recovery capability.

---

## Completed Work

### 1. Schema Changes
- Added `deleted: Boolean @default(false)` and `deletedAt: DateTime?` to Book, Arc, Chapter, Scene
- Created migration `20251227094911_add_soft_delete_to_nodes`
- Added indexes on `deleted` field for efficient queries

### 2. Backend DELETE Endpoints Updated
All DELETE endpoints now soft-delete by default with optional `?permanent=true` query param:
- `DELETE /my/scenes/:id` - soft deletes scene + messages
- `DELETE /my/chapters/:id` - soft deletes chapter + scenes + messages
- `DELETE /my/arcs/:id` - soft deletes arc + chapters + scenes + messages
- `DELETE /my/books/:id` - soft deletes book + arcs + chapters + scenes + messages

### 3. Backend List/Get Endpoints
All list/get endpoints now filter out `deleted: true` items by default.

### 4. Backend Recovery Endpoints (stories.ts)
- `GET /my/stories/:id/deleted-nodes` - lists all deleted nodes (books, arcs, chapters, scenes)
- `POST /my/stories/:id/deleted-scenes/:sceneId/restore` - restores scene + messages
- `POST /my/stories/:id/deleted-chapters/:chapterId/restore` - restores chapter + scenes + messages
- `POST /my/stories/:id/deleted-arcs/:arcId/restore` - restores arc + chapters + scenes + messages
- `POST /my/stories/:id/deleted-books/:bookId/restore` - restores book + all descendants

### 5. Frontend API Functions (config.ts)
- `getDeletedNodes(storyId)` - fetches deleted nodes
- `restoreDeletedNode(storyId, nodeType, nodeId)` - restores a node

### 6. Frontend Modal Component
- Created `DeletedNodesModal.tsx` and `DeletedNodesModal.css.ts`
- Shows deleted nodes with type badges and restore buttons

---

## Additional Fixes During Implementation

### Fixed: Node deletion not sending API requests
- `deleteMyScenesById` was being dynamically imported from wrong file (`config.ts` instead of SDK)
- Fixed by adding proper import from `api-client/sdk.gen.ts`

### Fixed: Node data not passed to delete handler
- `nodeStore.deleteNode()` was passing `{}` instead of node data
- Node was deleted from local state BEFORE saving, so type info was lost
- Fixed by capturing node data before calling `deleteNodeNoSave()`

---

## Files Modified

### Backend
- `prisma/schema.prisma` - added deleted/deletedAt to Book, Arc, Chapter, Scene
- `src/routes/my/scenes.ts` - soft delete + filtering
- `src/routes/my/chapters.ts` - soft delete + filtering
- `src/routes/my/arcs.ts` - soft delete + filtering
- `src/routes/my/books.ts` - soft delete + filtering
- `src/routes/my/stories.ts` - deleted-nodes list + restore endpoints, export schema fix

### Frontend
- `src/client/config.ts` - getDeletedNodes, restoreDeletedNode functions
- `src/components/DeletedNodesModal.tsx` - new modal component
- `src/components/DeletedNodesModal.css.ts` - new styles
- `src/services/saveService.ts` - fixed scene delete import, added permanent flag support
- `src/stores/nodeStore.ts` - fixed deleteNode to pass node data, added permanent param
- `src/components/StoryNavigation.tsx` - shift-click for permanent delete
- `src/components/NodeHeader.tsx` - shift-click for permanent delete
- `src/components/Settings.tsx` - added DeletedNodesModal button and component

---

# Previous Task: Map Editor State Refactor

## Status: Phase 5 & 6 COMPLETED (Dec 22, 2025)

Refactoring the map editor to move state from `Maps.tsx` into a dedicated `mapEditorStore`. See `MAP_STATE_REFACTOR_PLAN.md` for full details.
