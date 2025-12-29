# Map State Refactor Plan

## Goal

Move map editor state from `Maps.tsx` into a dedicated `mapEditorStore` to:
1. Eliminate prop drilling (currently 50+ props passed to child components)
2. Allow child components to read/modify state directly
3. Simplify `Maps.tsx` to focus on layout and PIXI orchestration
4. Make state management more predictable with a single source of truth

---

## Dynamic Property Schema System

### Backend Architecture

The backend already supports dynamic property definitions per map:

1. **Map.propertySchema** (JSON) - Defines available properties and state fields:
   ```typescript
   interface PropertySchema {
     properties: PropertyDefinition[]  // e.g., population, industry, region
     stateFields: StateFieldDefinition[] // e.g., allegiance (timeline-aware)
   }
   ```

2. **Landmark.properties** (JSON) - Stores actual values as `Record<string, any>`

3. **LandmarkState** - Timeline-based state changes (field + value at storyTime)

### Frontend Current State

- **View mode**: Already dynamic - iterates over `schema.properties` to display values
- **Edit mode**: Still hardcoded with individual signals (`editPopulation`, `editIndustry`, etc.)

### Required Changes for Store

Instead of hardcoded edit fields:
```typescript
// OLD - Hardcoded
editPopulation: string
editIndustry: string
editRegion: string
editSector: string
editPlanetaryBodies: string
```

Use dynamic property storage:
```typescript
// NEW - Dynamic
editProperties: Record<string, any>  // Keyed by property key from schema

// Actions
setEditProperty(key: string, value: any): void
initEditProperties(landmark: Landmark): void  // Populate from landmark.properties
```

The edit form should be dynamically generated from `propertySchema`, matching how view mode already works.

### Schema Location

- Backend: `apps/mythweavers-backend/src/schemas/common.ts` (propertySchemaSchema)
- Frontend types: `apps/mythweavers-story-editor/src/types/core.ts` (PropertySchema, DEFAULT_PROPERTY_SCHEMA)

---

## Current State Analysis

### Files That Need Changes

| File | Current Props | Props That Move to Store |
|------|---------------|-------------------------|
| `Maps.tsx` | Defines all state | Will import from store |
| `LandmarkDetail.tsx` | 56 props | ~45 props eliminated |
| `PawnDetail.tsx` | 38 props | ~30 props eliminated |
| `PathDetail.tsx` | 22 props | ~18 props eliminated |
| `LandmarksList.tsx` | 5 props | ~4 props eliminated |
| `MapToolbar.tsx` | 11 props | All props eliminated |
| `MapTimeline.tsx` | 8 props | ~5 props eliminated |
| `LandmarkPopup.tsx` | 57 props | ~45 props eliminated |

### Hooks That Need Store Access

- `useMapInteractions.ts` - needs selection state, creation mode
- `useLandmarkManager.ts` - needs selection state
- `useFleetManager.ts` - needs selection state, fleet for movement
- `useHyperlaneManager.ts` - needs selection state

---

## New Store Design

### `mapEditorStore.ts`

```typescript
// Selection state
type Selection =
  | { type: 'none' }
  | { type: 'landmark'; id: string }
  | { type: 'pawn'; id: string }
  | { type: 'path'; id: string }
  | { type: 'new-landmark' }
  | { type: 'new-pawn' }

interface MapEditorStore {
  // === SELECTION ===
  selection: Selection
  selectedFleetForMovement: Fleet | null

  // Derived (computed from selection + mapsStore)
  selectedLandmark: Landmark | null  // getter
  selectedFleet: Fleet | null        // getter
  selectedHyperlane: Hyperlane | null // getter
  isAddingNew: boolean               // getter
  isAddingFleet: boolean             // getter

  // === UI MODE ===
  creationMode: 'select' | 'landmark' | 'pawn' | 'path'
  paintModeEnabled: boolean
  selectedPaintFaction: string | null
  showFactionOverlay: boolean
  overlayMethod: 'voronoi' | 'metaball' | 'blurred' | 'noise'

  // === EDITING STATE ===
  isEditing: boolean

  // Common edit fields
  editName: string
  editDescription: string
  editColor: string
  editSize: 'small' | 'medium' | 'large'

  // Landmark-specific (fixed fields)
  editType: 'system' | 'station' | 'nebula' | 'junction'

  // Landmark dynamic properties (from schema)
  editProperties: Record<string, any>  // Populated from propertySchema
  propertyErrors: Record<string, string>  // Validation errors per property

  // Pawn-specific
  editDesignation: string
  editSpeed: string  // Renamed from hyperdriveRating - generic term
  speedError: string
  editVariant: 'military' | 'transport' | 'scout'

  // Path-specific
  editSpeedMultiplier: string
  speedMultiplierError: string

  // === CREATION STATE ===
  newLandmarkPos: { x: number; y: number }
  newFleetPos: { x: number; y: number }
  isCreatingHyperlane: boolean
  currentHyperlaneSegments: HyperlaneSegment[]
  hyperlanePreviewEnd: { x: number; y: number } | null

  // === STATUS FLAGS ===
  isSaving: boolean
  isDeleting: boolean
  isDeletingMovement: boolean
  isFetchingLandmarkInfo: boolean
  isSavingAllegiance: boolean

  // === PREFERENCES (localStorage backed) ===
  lastUsedColor: string
  lastUsedSize: 'small' | 'medium' | 'large'
  lastUsedType: 'system' | 'station' | 'nebula' | 'junction'
  sortAscending: boolean
}
```

### Store Actions

```typescript
// Selection actions
selectLandmark(id: string): void
selectPawn(id: string): void
selectPath(id: string): void
startAddingLandmark(): void
startAddingPawn(): void
clearSelection(): void

// Mode actions
setCreationMode(mode: CreationMode): void
setPaintMode(enabled: boolean, faction?: string): void
setOverlayMode(show: boolean, method?: OverlayMethod): void

// Editing actions
startEditing(): void
cancelEditing(): void
setEditField(field: string, value: any): void
setEditProperty(key: string, value: any): void  // For dynamic landmark properties
initEditFromLandmark(landmark: Landmark): void  // Populate edit fields from landmark

// CRUD actions (these call mapsStore internally)
saveLandmark(): Promise<void>
deleteLandmark(): Promise<void>
savePawn(): Promise<void>
deletePawn(): Promise<void>
savePath(): Promise<void>
deletePath(): Promise<void>

// Utility actions
focusOnLandmark(id: string): void
```

---

## Implementation Steps

### Phase 1: Create Store Foundation ✅
- [x] Create `src/stores/mapEditorStore.ts`
- [x] Define Selection type and store interface
- [x] Implement basic selection state and actions
- [x] Add derived getters for selectedLandmark/Fleet/Hyperlane

### Phase 2: Move UI Mode State ✅
- [x] Move `creationMode` to store
- [x] Move `paintModeEnabled`, `selectedPaintFaction` to store
- [x] Move `showFactionOverlay`, `overlayMethod` to store
- [x] Update `MapToolbar.tsx` to use store directly

### Phase 3: Move Editing State ✅
- [x] Move `isEditing` flag to store
- [x] Move common edit fields (`editName`, `editDescription`, `editColor`, `editSize`) to store
- [x] Move landmark-specific fixed fields (`editType`) to store
- [x] **Replace hardcoded property fields with dynamic `editProperties: Record<string, any>`**
- [x] Move pawn-specific fields (`editDesignation`, `editHyperdriveRating`, `editVariant`) to store
- [x] Move path-specific fields (`editSpeedMultiplier`) to store
- [x] Create `setEditField()` and `setEditProperty()` actions
- [x] Create `initEditFromLandmark()` / `initEditFromPawn()` / `initEditFromPath()` actions

### Phase 3.5: Dynamic Property Edit Form ✅
- [x] Update LandmarkDetail edit mode to generate form from `propertySchema`
- [x] Remove hardcoded population/industry/region/sector/planetaryBodies inputs
- [x] Create reusable `PropertyField` component that renders based on property type
- [x] Handle validation based on property type (text, number, enum, color, boolean)

### Phase 4: Move Status Flags ✅
- [x] Move `isSaving`, `isDeleting`, `isDeletingMovement` to store
- [x] Move `isFetchingLandmarkInfo`, `isSavingAllegiance` to store

### Phase 5: Move CRUD Actions ✅
- [x] Added callback registration system to `mapEditorStore`
  - `registerCallbacks(callbacks)` - Maps.tsx registers refresh callbacks on init
  - `unregisterCallbacks()` - Called on cleanup
  - Callbacks: `onLandmarksChanged`, `onFleetsChanged`, `onPathsChanged`
- [x] Move `saveLandmark`, `deleteLandmark` logic to store actions
- [x] Move `savePawn`, `deletePawn`, `deleteActiveMovement` to store
- [x] Move `savePath`, `deletePath`, `quickSaveSpeedMultiplier` to store
- [x] Detail components now call store CRUD directly (no props needed)
  - LandmarkDetail: props reduced from 12 to 10
  - PawnDetail: props reduced from 8 to 4
  - PathDetail: props reduced from 5 to 2
- [x] Removed old CRUD functions from Maps.tsx
- [ ] `saveAllegiance` remains in Maps.tsx (complex dependencies on landmarkStatesStore)

### Phase 6: Update Detail Components ✅
- [x] Refactor `LandmarkDetail.tsx` to use store
  - Props reduced from 38 to 12
  - Uses `mapEditorStore` for all editing state
  - Calls `initEditFromLandmark()` when Edit clicked
  - Removed unused `startEditing`/`cancelEditing` from Maps.tsx
- [x] Refactor `PawnDetail.tsx` to use store
  - Props reduced from 38 to 8
  - Uses `mapEditorStore` for all editing state
  - Calls `initEditFromPawn()` when Edit clicked
  - Removed unused `startEditingFleet`/`cancelEditingFleet` from Maps.tsx
- [x] Refactor `PathDetail.tsx` to use store
  - Props reduced from 22 to 5
  - Uses `mapEditorStore` for all editing state
  - Gets landmarks from `mapsStore` directly
  - Calls `initEditFromPath()` when Edit clicked
  - Removed unused `startEditingHyperlane`/`cancelEditingHyperlane` from Maps.tsx

### Phase 7: Update List/Toolbar Components ✅
- [x] Refactor `LandmarksList.tsx` to use store
  - Now reads landmarks from `mapsStore` directly
  - Uses `mapEditorStore.sortAscending` and `toggleSortOrder()` for sorting
  - Uses `mapEditorStore.selectedLandmark` for selection highlighting
  - Uses `mapEditorStore.focusOnLandmark()` for selection and viewport pan
  - Added `onFocusLandmark` callback to `MapEditorCallbacks` interface
  - Props reduced from 5 to 0
- [x] Refactor `MapToolbar.tsx` to use store (already complete from Phase 2)
  - Only prop is optional `onModeChange` callback
  - Reads/writes all state via `mapEditorStore`
- [x] Refactor `MapTimeline.tsx` to use store
  - Imports from 5 stores: `calendarStore`, `currentStoryStore`, `landmarkStatesStore`, `mapEditorStore`, `mapsStore`, `nodeStore`
  - Added `pendingStoryTime` to `mapEditorStore` for drag feedback
  - Computes `storyTimesWithStates` and `fleetMovementTimes` internally
  - Handles all timeline callbacks internally (drag, commit, step, reset)
  - `LandmarkDetail` now handles `jumpToStoryTime` internally
  - Props reduced from 10 to 0
  - Removed unused from Maps.tsx: `pendingStoryTime`, `storyTimesWithStates`, `fleetMovementTimes`, `handleTimelineDrag`, `handleTimelineCommit`, `stepTimeline`

### Phase 8: Update Hooks ✅
- [x] Update `useMapInteractions.ts` to use store
  - Removed props: `isEditing`, `isAddingNew`, `mapSelected`, `lastUsedType`, `creationMode`, `paintModeEnabled`, `selectedPaintFaction`
  - Now imports from `mapEditorStore` and `mapsStore` directly
  - Kept: PIXI objects, `isShiftHeld` (keyboard), callbacks
  - Props reduced from 16 to 5
- [x] Update `useLandmarkManager.ts` to use store
  - Removed props: `shouldStopPropagation`, `interactive`
  - Now computes interactivity from `mapEditorStore.creationMode`
  - Kept: PIXI objects, `evaluateBorderColor`, `onLandmarkClick`
  - Props reduced from 9 to 7
- [x] Update `useFleetManager.ts` to use store
  - Removed props: `currentStoryTime`, `selectedFleetId`
  - Now computes from `mapsStore.currentStoryTime`, `mapEditorStore.pendingStoryTime`, `mapEditorStore.selectedFleetForMovement`
  - Kept: PIXI objects, `onFleetClick`
  - Props reduced from 7 to 5
- [x] Update `useHyperlaneManager.ts` to use store
  - Removed props: `shouldStopPropagation`, `interactive`
  - Now computes interactivity from `mapEditorStore.creationMode`
  - Kept: PIXI objects, `onHyperlaneClick`
  - Props reduced from 7 to 5
- Maps.tsx cleanup:
  - Removed unused `isEditing` accessor (only `setIsEditing` is still used)

### Phase 9: Cleanup Maps.tsx ✅
- [x] Moved allegiance memos to LandmarkDetail (selectedAllegiance, allegianceAtThisStoryTime, allegianceSourceStoryTime)
- [x] LandmarkDetail now computes allegiance state from landmarkStatesStore directly
- [x] LandmarkDetail now computes currentStoryTime from stores (props reduced from 6 to 4)
- [x] PawnDetail now computes currentStoryTime from stores (props reduced from 4 to 3)
- [x] Removed allegiance props and currentStoryTime props from Maps.tsx usage
- [x] Maps.tsx: 2017 → 1975 lines (-42 lines)

### Phase 10: Delete Unused Code ✅
- [x] Remove `LandmarkPopup.tsx` if fully replaced by `LandmarkDetail.tsx`
  - Deleted `src/components/LandmarkPopup.tsx`
  - Deleted `src/components/LandmarkPopup.css.ts`
  - Deleted `src/components/maps/LandmarkPopup.tsx`
- [x] Remove any other dead code
  - Deleted `src/components/maps/MapControls.tsx` (unused component)
  - Deleted `src/components/maps/types.ts` (unused types)
  - Deleted 5 `.backup` files throughout the codebase
- [x] Update imports throughout (no orphaned imports found)

### Phase 11: Verify Migration Script for Dynamic Properties ✅
- [x] Check `apps/mythweavers-backend/scripts/migrate/from-story.ts`
- [x] Ensure old fixed fields (population, industry, region, sector, planetaryBodies) are properly migrated to `properties` object
  - Lines 932-938: Converts fixed columns to `properties` JSON object
  - Lines 879-902: Defines `starWarsPropertySchema` with all legacy fields
  - Line 919: Stores `propertySchema` on the map
  - Line 952: Stores `properties` on each landmark
- [x] Test migration - Already tested and working
- [x] Verify data appears correctly in the dynamic property form - Working

**Context**: The migration script already handles the conversion correctly.

### Phase 12: Move saveAllegiance to Store ✅
- [x] Add `onAllegianceChanged?: (landmark: Landmark) => void` callback to `MapEditorCallbacks`
- [x] Add `saveAllegiance(value: string | null)` action to `mapEditorStore`
  - Imports `landmarkStatesStore` and `currentStoryStore` directly
  - Computes `currentStoryTime` from `pendingStoryTime` and `mapsStore.currentStoryTime`
  - Calls `landmarkStatesStore.setLandmarkState()` and `loadAccumulatedStates()`
  - Triggers `callbacks.onAllegianceChanged?.(landmark)` for PIXI refresh
- [x] Register `onAllegianceChanged` callback in Maps.tsx
  - Calls `landmarkManager.updateLandmark(landmark, true)`
  - Updates voronoi overlay if enabled
  - Triggers `renderPixi()`
- [x] Update `LandmarkDetail.tsx` to call `mapEditorStore.saveAllegiance()` directly
  - Removed `onSaveAllegiance` prop (props reduced from 5 to 4)
- [x] Remove old `saveAllegiance` function and `setIsSavingAllegiance` wrapper from Maps.tsx

---

## Migration Strategy

1. **Incremental approach**: Move state in phases, keeping old props as fallbacks initially
2. **Test each phase**: Verify functionality after each phase before proceeding
3. **Keep backwards compatibility temporarily**: Wrapper functions in Maps.tsx can delegate to store

---

## Files to Create

- `src/stores/mapEditorStore.ts` - Main store file

## Files to Modify

- `src/components/Maps.tsx` - Remove state, import store
- `src/components/maps/LandmarkDetail.tsx` - Use store directly
- `src/components/maps/PawnDetail.tsx` - Use store directly
- `src/components/maps/PathDetail.tsx` - Use store directly
- `src/components/maps/LandmarksList.tsx` - Use store directly
- `src/components/maps/MapToolbar.tsx` - Use store directly
- `src/components/maps/MapTimeline.tsx` - Partial store usage
- `src/hooks/maps/useMapInteractions.ts` - Import store
- `src/hooks/maps/useLandmarkManager.ts` - Import store
- `src/hooks/maps/useFleetManager.ts` - Import store
- `src/hooks/maps/useHyperlaneManager.ts` - Import store

## Files Deleted

- `src/components/LandmarkPopup.tsx` - Superseded by LandmarkDetail ✅
- `src/components/LandmarkPopup.css.ts` - Superseded ✅
- `src/components/maps/LandmarkPopup.tsx` - Superseded by LandmarkDetail ✅
- `src/components/maps/MapControls.tsx` - Unused ✅
- `src/components/maps/types.ts` - Unused ✅

---

## Benefits After Refactor

1. **Reduced prop drilling**: Child components import store directly
2. **Simpler interfaces**: Components have minimal or no props
3. **Centralized state**: Single source of truth for map editor state
4. **Easier debugging**: All state changes go through store actions
5. **Better maintainability**: Adding new features doesn't require threading props
6. **Testability**: Store can be tested independently

---

## Current Progress

- [x] Started unifying selection state with `Selection` type in Maps.tsx
- [x] Created wrapper functions for backwards compatibility
- [x] Created `mapEditorStore.ts` with full Phase 1 implementation:
  - Selection type and state
  - UI mode state (creationMode, paintMode, overlays)
  - Editing state (all edit fields + dynamic properties)
  - Creation state (positions, path segments)
  - Status flags (isSaving, isDeleting, etc.)
  - Preferences (lastUsed*, sortAscending)
  - All getters and actions
- [x] Phase 2: Refactored Maps.tsx and MapToolbar.tsx to use store for UI mode state:
  - MapToolbar now reads/writes directly from mapEditorStore (no props)
  - Maps.tsx uses mapEditorStore for creationMode, paintMode, overlays, selectedFleetForMovement
- [x] Phase 3 & 4: Moved editing state and status flags to store:
  - Created accessor wrappers in Maps.tsx that delegate to mapEditorStore
  - Wrappers handle SolidJS Setter<T> function form for backwards compatibility
  - Detail components still receive props (will use store directly in Phase 6)
- [x] Phase 3.5: Dynamic property edit form:
  - Created PropertyField component that renders form fields based on property type
  - Updated LandmarkDetail to use dynamic form generation from propertySchema
  - saveLandmark now uses mapEditorStore.editProperties directly
  - Removed hardcoded population/industry/region/sector/planetaryBodies fields
- [x] Phase 5: CRUD actions moved to mapEditorStore:
  - Added callback registration system for UI refresh
  - Maps.tsx registers callbacks on PIXI init, unregisters on cleanup
  - saveLandmark, deleteLandmark, savePawn, deletePawn, deleteActiveMovement, savePath, deletePath, quickSaveSpeedMultiplier all in store
  - saveAllegiance remains in Maps.tsx (complex dependencies)
- [x] Phase 6: All detail components now use store directly:
  - LandmarkDetail: props reduced from 38 to 10
  - PawnDetail: props reduced from 38 to 4
  - PathDetail: props reduced from 22 to 2
  - Detail components call store CRUD actions directly
  - Removed old CRUD functions and accessor wrappers from Maps.tsx
- [x] Phase 7: All list/toolbar components now use store directly:
  - LandmarksList: props reduced from 5 to 0, uses stores for everything
  - MapToolbar: already done in Phase 2
  - MapTimeline: props reduced from 10 to 0
    - Added `pendingStoryTime` to mapEditorStore
    - Added `onFocusLandmark` callback for viewport panning
    - Removed unused timeline handlers and memos from Maps.tsx
  - LandmarkDetail: removed `onJumpToStoryTime` prop, handles internally
- [x] Phase 8: All hooks now use store directly:
  - useMapInteractions: props reduced from 16 to 5
  - useLandmarkManager: props reduced from 9 to 7
  - useFleetManager: props reduced from 7 to 5
  - useHyperlaneManager: props reduced from 7 to 5
  - All hooks now import from mapEditorStore/mapsStore for UI state
  - Callbacks that need Maps.tsx context (click handlers, border color) still passed as props
- [x] Phase 9: Maps.tsx and child component cleanup:
  - LandmarkDetail: moved allegiance memos internally, computes currentStoryTime from stores
  - PawnDetail: computes currentStoryTime from stores
  - Maps.tsx reduced from 2017 to 1975 lines (-42 lines)
  - Remaining props are callbacks that need Maps.tsx context or PIXI access
- [x] Phase 10: Complete (deleted all unused files)
- [x] Phase 11: Complete (migration script already handles dynamic properties)
- [x] Phase 12: Complete (saveAllegiance moved to store with callback pattern)
  - Maps.tsx reduced from 1975 to 1949 lines (-26 lines)
  - LandmarkDetail props reduced from 5 to 4

**🎉 MAP STATE REFACTOR COMPLETE!**
- **Total Maps.tsx reduction**: 2017 → 1949 lines (-68 lines, -3.4%)

---

## Notes

- The existing `mapsStore` handles map *data* (landmarks, fleets, hyperlanes)
- The new `mapEditorStore` handles *UI state* (selection, editing, modes)
- These stores will work together: mapEditorStore reads from mapsStore for selected objects

### Dynamic Properties Key Insight

The backend already supports dynamic property schemas per map. The frontend view mode already renders properties dynamically from the schema, but edit mode still uses hardcoded fields. The store refactor should:

1. Use `editProperties: Record<string, any>` instead of individual `editPopulation`, `editIndustry`, etc.
2. Generate edit form fields dynamically from `map.propertySchema`
3. This makes the system fully generic - any map can define its own custom properties

This prevents duplicate work - we refactor once with the dynamic approach rather than hardcoding and then refactoring again later.

### Terminology Cleanup

The **backend is already using generic terms**:
- `Pawn` model with `speed` field (not Fleet/hyperdriveRating)
- `Path` model (not Hyperlane)
- `PawnMovement`, `PathSegment`

The **frontend still has Star Wars terminology** in places:

| Frontend Term | Should Be | Backend Already Uses |
|---------------|-----------|---------------------|
| `Fleet` type | `Pawn` | `Pawn` |
| `hyperdriveRating` | `speed` | `speed` |
| `Hyperlane` type | `Path` | `Path` |
| `FleetMovement` | `PawnMovement` | `PawnMovement` |

As part of this refactor, align frontend types with backend naming.
