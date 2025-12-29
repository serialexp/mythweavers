import { createStore } from 'solid-js/store'
import { currentStoryStore } from './currentStoryStore'
import { landmarkStatesStore } from './landmarkStatesStore'
import { mapsStore } from './mapsStore'
import type { Fleet, Hyperlane, HyperlaneSegment, Landmark } from '../types/core'
import { getActiveMovement } from '../utils/fleetUtils'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Callbacks that Maps.tsx registers so the store can trigger UI refreshes.
 * These are set once during initialization and cleared on cleanup.
 */
export interface MapEditorCallbacks {
  /** Called after landmark add/update/delete */
  onLandmarksChanged?: () => void
  /** Called after fleet add/update/delete/movement changes */
  onFleetsChanged?: () => void
  /** Called after path add/update/delete */
  onPathsChanged?: () => void
  /** Called to pan/animate the viewport to center on a landmark */
  onFocusLandmark?: (landmark: Landmark) => void
  /** Called after allegiance state is saved (needs PIXI visual refresh) */
  onAllegianceChanged?: (landmark: Landmark) => void
}

// Registered callbacks (set by Maps.tsx)
let callbacks: MapEditorCallbacks = {}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

const validateHyperdriveRating = (value: string): boolean => {
  if (!value.trim()) return false
  const num = Number.parseFloat(value)
  return !Number.isNaN(num) && num >= 0.5 && num <= 2.0
}

const validateSpeedMultiplier = (value: string): boolean => {
  if (!value.trim()) return false
  const num = Number.parseFloat(value)
  return !Number.isNaN(num) && num >= 1.0 && num <= 20.0
}

/**
 * Unified selection state for the map editor.
 * Only one thing can be selected at a time.
 */
export type Selection =
  | { type: 'none' }
  | { type: 'landmark'; id: string }
  | { type: 'pawn'; id: string }
  | { type: 'path'; id: string }
  | { type: 'new-landmark' }
  | { type: 'new-pawn' }

export type CreationMode = 'select' | 'landmark' | 'pawn' | 'path'
export type OverlayMethod = 'voronoi' | 'metaball' | 'blurred' | 'noise'
export type LandmarkSize = 'small' | 'medium' | 'large'
export type LandmarkType = 'system' | 'station' | 'nebula' | 'junction'
export type PawnVariant = 'military' | 'transport' | 'scout'

// =============================================================================
// STORE STATE
// =============================================================================

interface MapEditorState {
  // === SELECTION ===
  selection: Selection
  selectedFleetForMovement: Fleet | null

  // === UI MODE ===
  creationMode: CreationMode
  paintModeEnabled: boolean
  selectedPaintFaction: string | null
  showFactionOverlay: boolean
  overlayMethod: OverlayMethod

  // === EDITING STATE ===
  isEditing: boolean

  // Common edit fields
  editName: string
  editDescription: string
  editColor: string
  editSize: LandmarkSize

  // Landmark-specific (fixed fields)
  editType: LandmarkType

  // Landmark dynamic properties (from schema)
  editProperties: Record<string, unknown>
  propertyErrors: Record<string, string>

  // Pawn-specific
  editDesignation: string
  editSpeed: string // Generic name (was hyperdriveRating)
  speedError: string

  // Path-specific
  editSpeedMultiplier: string
  speedMultiplierError: string

  // Pawn variant
  editVariant: PawnVariant

  // === CREATION STATE ===
  newLandmarkPos: { x: number; y: number }
  newPawnPos: { x: number; y: number }
  isCreatingPath: boolean
  currentPathSegments: HyperlaneSegment[]
  pathPreviewEnd: { x: number; y: number } | null

  // === STATUS FLAGS ===
  isSaving: boolean
  isDeleting: boolean
  isDeletingMovement: boolean
  isFetchingLandmarkInfo: boolean
  isSavingAllegiance: boolean

  // === TIMELINE STATE ===
  pendingStoryTime: number | null // For drag feedback before commit

  // === PREFERENCES (localStorage backed) ===
  lastUsedColor: string
  lastUsedSize: LandmarkSize
  lastUsedType: LandmarkType
  sortAscending: boolean
}

// Load preferences from localStorage with fallbacks
const loadPreference = <T>(key: string, fallback: T): T => {
  const stored = localStorage.getItem(key)
  if (stored === null) return fallback
  return stored as unknown as T
}

const [state, setState] = createStore<MapEditorState>({
  // Selection
  selection: { type: 'none' },
  selectedFleetForMovement: null,

  // UI Mode
  creationMode: 'select',
  paintModeEnabled: false,
  selectedPaintFaction: null,
  showFactionOverlay: false,
  overlayMethod: 'voronoi',

  // Editing
  isEditing: false,
  editName: '',
  editDescription: '',
  editColor: '#3498db',
  editSize: 'medium',
  editType: 'system',
  editProperties: {},
  propertyErrors: {},
  editDesignation: '',
  editSpeed: '1.0',
  speedError: '',
  editSpeedMultiplier: '10.0',
  speedMultiplierError: '',
  editVariant: 'military',

  // Creation
  newLandmarkPos: { x: 0, y: 0 },
  newPawnPos: { x: 0, y: 0 },
  isCreatingPath: false,
  currentPathSegments: [],
  pathPreviewEnd: null,

  // Status
  isSaving: false,
  isDeleting: false,
  isDeletingMovement: false,
  isFetchingLandmarkInfo: false,
  isSavingAllegiance: false,

  // Timeline
  pendingStoryTime: null,

  // Preferences (loaded from localStorage)
  lastUsedColor: loadPreference('lastLandmarkColor', '#3498db'),
  lastUsedSize: loadPreference('lastLandmarkSize', 'medium') as LandmarkSize,
  lastUsedType: loadPreference('lastLandmarkType', 'system') as LandmarkType,
  sortAscending: true,
})

// =============================================================================
// STORE EXPORT
// =============================================================================

export const mapEditorStore = {
  // ---------------------------------------------------------------------------
  // GETTERS - Selection
  // ---------------------------------------------------------------------------
  get selection(): Selection {
    return state.selection
  },

  get selectedFleetForMovement(): Fleet | null {
    return state.selectedFleetForMovement
  },

  /**
   * Get the currently selected landmark from mapsStore.
   * Returns null if nothing or a non-landmark is selected.
   */
  get selectedLandmark(): Landmark | null {
    const sel = state.selection
    if (sel.type !== 'landmark') return null
    return mapsStore.selectedMap?.landmarks.find((lm) => lm.id === sel.id) || null
  },

  /**
   * Get the currently selected pawn (fleet) from mapsStore.
   * Returns null if nothing or a non-pawn is selected.
   */
  get selectedPawn(): Fleet | null {
    const sel = state.selection
    if (sel.type !== 'pawn') return null
    return mapsStore.selectedMap?.fleets?.find((f) => f.id === sel.id) || null
  },

  /**
   * Get the currently selected path (hyperlane) from mapsStore.
   * Returns null if nothing or a non-path is selected.
   */
  get selectedPath(): Hyperlane | null {
    const sel = state.selection
    if (sel.type !== 'path') return null
    return mapsStore.selectedMap?.hyperlanes?.find((h) => h.id === sel.id) || null
  },

  get isAddingLandmark(): boolean {
    return state.selection.type === 'new-landmark'
  },

  get isAddingPawn(): boolean {
    return state.selection.type === 'new-pawn'
  },

  // ---------------------------------------------------------------------------
  // GETTERS - UI Mode
  // ---------------------------------------------------------------------------
  get creationMode(): CreationMode {
    return state.creationMode
  },

  get paintModeEnabled(): boolean {
    return state.paintModeEnabled
  },

  get selectedPaintFaction(): string | null {
    return state.selectedPaintFaction
  },

  get showFactionOverlay(): boolean {
    return state.showFactionOverlay
  },

  get overlayMethod(): OverlayMethod {
    return state.overlayMethod
  },

  // ---------------------------------------------------------------------------
  // GETTERS - Editing State
  // ---------------------------------------------------------------------------
  get isEditing(): boolean {
    return state.isEditing
  },

  get editName(): string {
    return state.editName
  },

  get editDescription(): string {
    return state.editDescription
  },

  get editColor(): string {
    return state.editColor
  },

  get editSize(): LandmarkSize {
    return state.editSize
  },

  get editType(): LandmarkType {
    return state.editType
  },

  get editProperties(): Record<string, unknown> {
    return state.editProperties
  },

  get propertyErrors(): Record<string, string> {
    return state.propertyErrors
  },

  get editDesignation(): string {
    return state.editDesignation
  },

  get editSpeed(): string {
    return state.editSpeed
  },

  get speedError(): string {
    return state.speedError
  },

  get editSpeedMultiplier(): string {
    return state.editSpeedMultiplier
  },

  get speedMultiplierError(): string {
    return state.speedMultiplierError
  },

  get editVariant(): PawnVariant {
    return state.editVariant
  },

  // ---------------------------------------------------------------------------
  // GETTERS - Creation State
  // ---------------------------------------------------------------------------
  get newLandmarkPos(): { x: number; y: number } {
    return state.newLandmarkPos
  },

  get newPawnPos(): { x: number; y: number } {
    return state.newPawnPos
  },

  get isCreatingPath(): boolean {
    return state.isCreatingPath
  },

  get currentPathSegments(): HyperlaneSegment[] {
    return state.currentPathSegments
  },

  get pathPreviewEnd(): { x: number; y: number } | null {
    return state.pathPreviewEnd
  },

  // ---------------------------------------------------------------------------
  // GETTERS - Status Flags
  // ---------------------------------------------------------------------------
  get isSaving(): boolean {
    return state.isSaving
  },

  get isDeleting(): boolean {
    return state.isDeleting
  },

  get isDeletingMovement(): boolean {
    return state.isDeletingMovement
  },

  get isFetchingLandmarkInfo(): boolean {
    return state.isFetchingLandmarkInfo
  },

  get isSavingAllegiance(): boolean {
    return state.isSavingAllegiance
  },

  // ---------------------------------------------------------------------------
  // GETTERS - Timeline
  // ---------------------------------------------------------------------------
  get pendingStoryTime(): number | null {
    return state.pendingStoryTime
  },

  // ---------------------------------------------------------------------------
  // GETTERS - Preferences
  // ---------------------------------------------------------------------------
  get lastUsedColor(): string {
    return state.lastUsedColor
  },

  get lastUsedSize(): LandmarkSize {
    return state.lastUsedSize
  },

  get lastUsedType(): LandmarkType {
    return state.lastUsedType
  },

  get sortAscending(): boolean {
    return state.sortAscending
  },

  // ---------------------------------------------------------------------------
  // ACTIONS - Selection
  // ---------------------------------------------------------------------------

  /**
   * Select a landmark by ID.
   */
  selectLandmark(id: string): void {
    setState('selection', { type: 'landmark', id })
  },

  /**
   * Select a pawn by ID.
   */
  selectPawn(id: string): void {
    setState('selection', { type: 'pawn', id })
  },

  /**
   * Select a path by ID.
   */
  selectPath(id: string): void {
    setState('selection', { type: 'path', id })
  },

  /**
   * Start adding a new landmark.
   */
  startAddingLandmark(): void {
    setState('selection', { type: 'new-landmark' })
  },

  /**
   * Start adding a new pawn.
   */
  startAddingPawn(): void {
    setState('selection', { type: 'new-pawn' })
  },

  /**
   * Clear the current selection.
   */
  clearSelection(): void {
    setState('selection', { type: 'none' })
  },

  /**
   * Set the fleet to use for movement commands.
   */
  setSelectedFleetForMovement(fleet: Fleet | null): void {
    setState('selectedFleetForMovement', fleet)
  },

  /**
   * Focus on a landmark: select it and pan the viewport to center on it.
   * Used by LandmarksList when clicking on a landmark entry.
   */
  focusOnLandmark(landmark: Landmark): void {
    // Ignore when in paint mode
    if (state.paintModeEnabled) return

    // Select the landmark
    setState('selection', { type: 'landmark', id: landmark.id })
    setState('isEditing', false)

    // Call the registered callback for viewport animation
    callbacks.onFocusLandmark?.(landmark)
  },

  // ---------------------------------------------------------------------------
  // ACTIONS - UI Mode
  // ---------------------------------------------------------------------------

  setCreationMode(mode: CreationMode): void {
    setState('creationMode', mode)
  },

  setPaintModeEnabled(enabled: boolean): void {
    setState('paintModeEnabled', enabled)
  },

  setSelectedPaintFaction(faction: string | null): void {
    setState('selectedPaintFaction', faction)
  },

  setShowFactionOverlay(show: boolean): void {
    setState('showFactionOverlay', show)
  },

  setOverlayMethod(method: OverlayMethod): void {
    setState('overlayMethod', method)
  },

  // ---------------------------------------------------------------------------
  // ACTIONS - Editing State
  // ---------------------------------------------------------------------------

  /**
   * Start editing the currently selected item.
   * Populates edit fields from the selected landmark/pawn/path.
   */
  startEditing(): void {
    setState('isEditing', true)
  },

  /**
   * Cancel editing without saving changes.
   */
  cancelEditing(): void {
    setState('isEditing', false)
    // Clear any validation errors
    setState('propertyErrors', {})
    setState('speedError', '')
    setState('speedMultiplierError', '')
  },

  /**
   * Set a common edit field value.
   */
  setEditName(value: string): void {
    setState('editName', value)
  },

  setEditDescription(value: string): void {
    setState('editDescription', value)
  },

  setEditColor(value: string): void {
    setState('editColor', value)
  },

  setEditSize(value: LandmarkSize): void {
    setState('editSize', value)
  },

  setEditType(value: LandmarkType): void {
    setState('editType', value)
  },

  /**
   * Set a dynamic property value (for landmarks).
   */
  setEditProperty(key: string, value: unknown): void {
    setState('editProperties', key, value)
  },

  /**
   * Set a property validation error.
   */
  setPropertyError(key: string, error: string): void {
    setState('propertyErrors', key, error)
  },

  /**
   * Clear a property validation error.
   */
  clearPropertyError(key: string): void {
    setState('propertyErrors', key, '')
  },

  setEditDesignation(value: string): void {
    setState('editDesignation', value)
  },

  setEditSpeed(value: string): void {
    setState('editSpeed', value)
  },

  setSpeedError(error: string): void {
    setState('speedError', error)
  },

  setEditSpeedMultiplier(value: string): void {
    setState('editSpeedMultiplier', value)
  },

  setSpeedMultiplierError(error: string): void {
    setState('speedMultiplierError', error)
  },

  setEditVariant(value: PawnVariant): void {
    setState('editVariant', value)
  },

  /**
   * Initialize edit fields from a landmark.
   * Call this when selecting a landmark to edit.
   */
  initEditFromLandmark(landmark: Landmark): void {
    setState('editName', landmark.name)
    setState('editDescription', landmark.description || '')
    setState('editColor', landmark.color || '#3498db')
    setState('editSize', landmark.size || 'medium')
    setState('editType', (landmark.type as LandmarkType) || 'system')
    setState('editProperties', { ...landmark.properties })
    setState('propertyErrors', {})
  },

  /**
   * Initialize edit fields from a pawn (fleet).
   * Call this when selecting a pawn to edit.
   */
  initEditFromPawn(pawn: Fleet): void {
    setState('editName', pawn.name)
    setState('editDescription', pawn.description || '')
    setState('editDesignation', pawn.designation || '')
    setState('editSpeed', String(pawn.hyperdriveRating))
    setState('editColor', pawn.color || '#3498db')
    setState('editSize', pawn.size || 'medium')
    setState('editVariant', pawn.variant || 'military')
    setState('speedError', '')
  },

  /**
   * Initialize edit fields from a path (hyperlane).
   * Call this when selecting a path to edit.
   */
  initEditFromPath(path: Hyperlane): void {
    setState('editSpeedMultiplier', String(path.speedMultiplier))
    setState('speedMultiplierError', '')
  },

  /**
   * Initialize edit fields for a new landmark.
   * Uses last used preferences.
   */
  initEditForNewLandmark(): void {
    setState('editName', '')
    setState('editDescription', '')
    setState('editColor', state.lastUsedColor)
    setState('editSize', state.lastUsedSize)
    setState('editType', state.lastUsedType)
    setState('editProperties', {})
    setState('propertyErrors', {})
    setState('isEditing', true)
  },

  /**
   * Initialize edit fields for a new pawn.
   */
  initEditForNewPawn(): void {
    setState('editName', '')
    setState('editDescription', '')
    setState('editDesignation', '')
    setState('editSpeed', '1.0')
    setState('editColor', state.lastUsedColor)
    setState('editSize', 'medium')
    setState('editVariant', 'military')
    setState('speedError', '')
    setState('isEditing', true)
  },

  // ---------------------------------------------------------------------------
  // ACTIONS - Creation State
  // ---------------------------------------------------------------------------

  setNewLandmarkPos(pos: { x: number; y: number }): void {
    setState('newLandmarkPos', pos)
  },

  setNewPawnPos(pos: { x: number; y: number }): void {
    setState('newPawnPos', pos)
  },

  setIsCreatingPath(creating: boolean): void {
    setState('isCreatingPath', creating)
  },

  setCurrentPathSegments(segments: HyperlaneSegment[]): void {
    setState('currentPathSegments', segments)
  },

  addPathSegment(segment: HyperlaneSegment): void {
    setState('currentPathSegments', (prev) => [...prev, segment])
  },

  clearPathSegments(): void {
    setState('currentPathSegments', [])
  },

  setPathPreviewEnd(pos: { x: number; y: number } | null): void {
    setState('pathPreviewEnd', pos)
  },

  // ---------------------------------------------------------------------------
  // ACTIONS - Status Flags
  // ---------------------------------------------------------------------------

  setIsSaving(saving: boolean): void {
    setState('isSaving', saving)
  },

  setIsDeleting(deleting: boolean): void {
    setState('isDeleting', deleting)
  },

  setIsDeletingMovement(deleting: boolean): void {
    setState('isDeletingMovement', deleting)
  },

  setIsFetchingLandmarkInfo(fetching: boolean): void {
    setState('isFetchingLandmarkInfo', fetching)
  },

  setIsSavingAllegiance(saving: boolean): void {
    setState('isSavingAllegiance', saving)
  },

  // ---------------------------------------------------------------------------
  // ACTIONS - Timeline
  // ---------------------------------------------------------------------------

  setPendingStoryTime(time: number | null): void {
    setState('pendingStoryTime', time)
  },

  // ---------------------------------------------------------------------------
  // ACTIONS - Preferences
  // ---------------------------------------------------------------------------

  setLastUsedColor(color: string): void {
    setState('lastUsedColor', color)
    localStorage.setItem('lastLandmarkColor', color)
  },

  setLastUsedSize(size: LandmarkSize): void {
    setState('lastUsedSize', size)
    localStorage.setItem('lastLandmarkSize', size)
  },

  setLastUsedType(type: LandmarkType): void {
    setState('lastUsedType', type)
    localStorage.setItem('lastLandmarkType', type)
  },

  setSortAscending(ascending: boolean): void {
    setState('sortAscending', ascending)
  },

  toggleSortOrder(): void {
    setState('sortAscending', (prev) => !prev)
  },

  // ---------------------------------------------------------------------------
  // ACTIONS - Compound Operations
  // ---------------------------------------------------------------------------

  /**
   * Complete editing and clear the editing state.
   * Does NOT handle saving - that should be done before calling this.
   */
  finishEditing(): void {
    setState('isEditing', false)
    setState('propertyErrors', {})
    setState('speedError', '')
    setState('speedMultiplierError', '')
  },

  /**
   * Reset all creation state (path segments, preview, etc.)
   */
  resetCreationState(): void {
    setState('isCreatingPath', false)
    setState('currentPathSegments', [])
    setState('pathPreviewEnd', null)
    setState('newLandmarkPos', { x: 0, y: 0 })
    setState('newPawnPos', { x: 0, y: 0 })
  },

  /**
   * Full reset of the editor state.
   * Call this when switching maps or closing the map view.
   */
  reset(): void {
    setState('selection', { type: 'none' })
    setState('selectedFleetForMovement', null)
    setState('creationMode', 'select')
    setState('isEditing', false)
    setState('isCreatingPath', false)
    setState('currentPathSegments', [])
    setState('pathPreviewEnd', null)
    setState('isSaving', false)
    setState('isDeleting', false)
    setState('isDeletingMovement', false)
    setState('isFetchingLandmarkInfo', false)
    setState('isSavingAllegiance', false)
    setState('pendingStoryTime', null)
  },

  // ---------------------------------------------------------------------------
  // CALLBACK REGISTRATION
  // ---------------------------------------------------------------------------

  /**
   * Register callbacks for UI refresh operations.
   * Called by Maps.tsx when the PIXI map is initialized.
   */
  registerCallbacks(newCallbacks: MapEditorCallbacks): void {
    callbacks = newCallbacks
  },

  /**
   * Unregister callbacks.
   * Called by Maps.tsx on cleanup.
   */
  unregisterCallbacks(): void {
    callbacks = {}
  },

  // ---------------------------------------------------------------------------
  // CRUD ACTIONS - Landmarks
  // ---------------------------------------------------------------------------

  /**
   * Save landmark (new or edit).
   * Uses current edit state from the store.
   */
  saveLandmark(): void {
    const name = state.editName.trim()
    const description = state.editDescription.trim()

    if (!name || state.isSaving) return

    setState('isSaving', true)

    // Build properties object, filtering out empty values
    const buildProperties = (): Record<string, unknown> => {
      const result: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(state.editProperties)) {
        if (value !== undefined && value !== null && value !== '') {
          result[key] = value
        }
      }
      return result
    }

    try {
      const map = mapsStore.selectedMap
      if (!map) return

      if (state.selection.type === 'new-landmark') {
        // Remember settings for next time
        setState('lastUsedColor', state.editColor)
        setState('lastUsedSize', state.editSize)
        setState('lastUsedType', state.editType)
        localStorage.setItem('lastLandmarkColor', state.editColor)
        localStorage.setItem('lastLandmarkSize', state.editSize)
        localStorage.setItem('lastLandmarkType', state.editType)

        // Add new landmark
        mapsStore.addLandmark(map.id, {
          x: state.newLandmarkPos.x,
          y: state.newLandmarkPos.y,
          name,
          description,
          type: state.editType,
          color: state.editColor,
          size: state.editSize,
          properties: buildProperties(),
        })
      } else if (state.selection.type === 'landmark') {
        // Update existing landmark
        mapsStore.updateLandmark(map.id, state.selection.id, {
          name,
          description,
          type: state.editType,
          color: state.editColor,
          size: state.editSize,
          properties: buildProperties(),
        })
      }

      // Trigger UI refresh
      callbacks.onLandmarksChanged?.()

      // Clear editing state
      setState('isEditing', false)
      setState('selection', { type: 'none' })
    } finally {
      setTimeout(() => setState('isSaving', false), 200)
    }
  },

  /**
   * Delete the currently selected landmark.
   */
  deleteLandmark(): void {
    const map = mapsStore.selectedMap
    if (state.selection.type !== 'landmark' || !map || state.isDeleting) return

    setState('isDeleting', true)

    try {
      mapsStore.deleteLandmark(map.id, state.selection.id)
      setState('selection', { type: 'none' })

      // Trigger UI refresh
      callbacks.onLandmarksChanged?.()
    } finally {
      setTimeout(() => setState('isDeleting', false), 200)
    }
  },

  // ---------------------------------------------------------------------------
  // CRUD ACTIONS - Pawns (Fleets)
  // ---------------------------------------------------------------------------

  /**
   * Save pawn (new or edit).
   * Uses current edit state from the store.
   */
  savePawn(): void {
    const name = state.editName.trim()
    const description = state.editDescription.trim()
    const designation = state.editDesignation.trim()

    if (!name || state.isSaving) return

    // Validate hyperdrive rating
    if (!validateHyperdriveRating(state.editSpeed)) {
      setState('speedError', 'Must be between 0.5 and 2.0')
      return
    }

    setState('isSaving', true)

    try {
      const map = mapsStore.selectedMap
      if (!map) return

      if (state.selection.type === 'new-pawn') {
        // Add new pawn
        mapsStore.addFleet(map.id, {
          defaultX: state.newPawnPos.x,
          defaultY: state.newPawnPos.y,
          name,
          description,
          designation: designation || undefined,
          hyperdriveRating: Number.parseFloat(state.editSpeed),
          color: state.editColor,
          size: state.editSize,
          variant: state.editVariant,
        })
      } else if (state.selection.type === 'pawn') {
        // Update existing pawn
        mapsStore.updateFleet(map.id, state.selection.id, {
          name,
          description,
          designation: designation || undefined,
          hyperdriveRating: Number.parseFloat(state.editSpeed),
          color: state.editColor,
          size: state.editSize,
          variant: state.editVariant,
        })
      }

      // Trigger UI refresh
      callbacks.onFleetsChanged?.()

      // Clear editing state
      setState('isEditing', false)
      setState('selection', { type: 'none' })
    } finally {
      setTimeout(() => setState('isSaving', false), 200)
    }
  },

  /**
   * Delete the currently selected pawn.
   */
  deletePawn(): void {
    const map = mapsStore.selectedMap
    if (state.selection.type !== 'pawn' || !map || state.isDeleting) return

    setState('isDeleting', true)

    try {
      mapsStore.deleteFleet(map.id, state.selection.id)
      setState('selection', { type: 'none' })

      // Trigger UI refresh
      callbacks.onFleetsChanged?.()
    } finally {
      setTimeout(() => setState('isDeleting', false), 200)
    }
  },

  /**
   * Delete the active movement for the selected pawn.
   * @param currentStoryTime - The current story time (needed to find active movement)
   */
  deleteActiveMovement(currentStoryTime: number): void {
    const map = mapsStore.selectedMap
    const sel = state.selection
    if (sel.type !== 'pawn' || !map || state.isDeletingMovement) return

    const pawn = map.fleets?.find((f) => f.id === sel.id)
    if (!pawn) return

    const activeMovement = getActiveMovement(pawn, currentStoryTime)
    if (!activeMovement) return

    setState('isDeletingMovement', true)

    try {
      mapsStore.deleteFleetMovement(map.id, pawn.id, activeMovement.id)

      // Trigger UI refresh
      callbacks.onFleetsChanged?.()
    } finally {
      setTimeout(() => setState('isDeletingMovement', false), 200)
    }
  },

  // ---------------------------------------------------------------------------
  // CRUD ACTIONS - Paths (Hyperlanes)
  // ---------------------------------------------------------------------------

  /**
   * Save path edits (speed multiplier).
   * Note: Path creation is handled separately via saveHyperlane in Maps.tsx.
   */
  savePath(): void {
    const map = mapsStore.selectedMap
    if (state.selection.type !== 'path' || !map || state.isSaving) return

    // Validate speed multiplier
    if (!validateSpeedMultiplier(state.editSpeedMultiplier)) {
      setState('speedMultiplierError', 'Must be between 1.0 and 20.0')
      return
    }

    setState('isSaving', true)

    try {
      mapsStore.updateHyperlane(map.id, state.selection.id, {
        speedMultiplier: Number.parseFloat(state.editSpeedMultiplier),
      })

      // Trigger UI refresh
      callbacks.onPathsChanged?.()

      setState('isEditing', false)
    } finally {
      setTimeout(() => setState('isSaving', false), 200)
    }
  },

  /**
   * Quick save speed multiplier without entering edit mode.
   */
  quickSaveSpeedMultiplier(value: string): void {
    const map = mapsStore.selectedMap
    if (state.selection.type !== 'path' || !map || state.isSaving) return

    if (!validateSpeedMultiplier(value)) return

    setState('isSaving', true)

    try {
      mapsStore.updateHyperlane(map.id, state.selection.id, {
        speedMultiplier: Number.parseFloat(value),
      })

      // Trigger UI refresh
      callbacks.onPathsChanged?.()
    } finally {
      setTimeout(() => setState('isSaving', false), 200)
    }
  },

  /**
   * Delete the currently selected path.
   */
  deletePath(): void {
    const map = mapsStore.selectedMap
    if (state.selection.type !== 'path' || !map || state.isDeleting) return

    setState('isDeleting', true)

    try {
      mapsStore.deleteHyperlane(map.id, state.selection.id)
      setState('selection', { type: 'none' })

      // Trigger UI refresh
      callbacks.onPathsChanged?.()
    } finally {
      setTimeout(() => setState('isDeleting', false), 200)
    }
  },

  // ---------------------------------------------------------------------------
  // ALLEGIANCE ACTIONS
  // ---------------------------------------------------------------------------

  /**
   * Save allegiance state for the currently selected landmark.
   * @param value - The new allegiance value, or null to clear
   */
  async saveAllegiance(value: string | null): Promise<void> {
    const landmark = this.selectedLandmark
    const map = mapsStore.selectedMap
    const storyId = currentStoryStore.id

    // Compute current story time from stores (same logic as Maps.tsx)
    const pendingTime = state.pendingStoryTime
    const storedTime = mapsStore.currentStoryTime
    const storyTime = pendingTime ?? storedTime

    if (!landmark || !map || storyTime === null || !storyId) return

    setState('isSavingAllegiance', true)
    try {
      // Persist the state change
      await landmarkStatesStore.setLandmarkState(storyId, map.id, landmark.id, storyTime, 'allegiance', value)

      // Reload accumulated states
      await landmarkStatesStore.loadAccumulatedStates(storyId, storyTime)

      // Trigger visual refresh via callback
      callbacks.onAllegianceChanged?.(landmark)
    } catch (error) {
      console.error('Failed to save allegiance:', error)
    } finally {
      setState('isSavingAllegiance', false)
    }
  },
}
