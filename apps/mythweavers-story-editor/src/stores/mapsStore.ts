import { createEffect } from 'solid-js'
import { createStore, unwrap } from 'solid-js/store'
import {
  getApiBaseUrl,
  getMyFilesById,
  getMyMapsById,
  getMyMapsByMapIdLandmarks,
  getMyMapsByMapIdPaths,
  getMyMapsByMapIdPawnMovements,
  getMyMapsByMapIdPawns,
} from '../client/config'
import { saveService } from '../services/saveService'
import { ApiLandmark, ApiPath, ApiPawn, apiLandmarkToLandmark, pathToHyperlane, pawnToFleet } from '../types/api'
import { Fleet, FleetMovement, Hyperlane, Landmark, StoryMap } from '../types/core'
import { generateMessageId } from '../utils/id'
import { MapError, describeError } from '../utils/maps/mapDiagnostics'
import { storage } from '../utils/storage'
import { currentStoryStore } from './currentStoryStore'
import { errorStore } from './errorStore'
import { on } from './storeEvents'

// Track if maps have been loaded
let mapsLoaded = false

interface FileMetadataResult {
  file: { path?: string } | null
  error?: MapError
}

/**
 * A map whose `fileId` is null simply never had an image attached, which is a
 * normal state for a freshly created map rather than a failure. It still gets
 * a message, because an unexplained empty canvas is the thing we are trying to
 * stop shipping.
 */
const MISSING_FILE_REFERENCE: FileMetadataResult = {
  file: null,
  error: {
    title: 'This map has no image yet',
    detail: 'No image file is attached to this map. Any landmarks it already has are shown on the grid below.',
  },
}

/**
 * Looks up a map's image metadata, distinguishing "the file is gone" from
 * "the lookup itself failed". The previous `.catch(() => null)` collapsed both
 * into an empty imageData, which then read as "this map has no picture" and
 * left the user with an unexplained black rectangle.
 */
async function fetchFileMetadata(fileId: string): Promise<FileMetadataResult> {
  try {
    const response = await getMyFilesById({ path: { id: fileId } })
    const file = response.data?.file
    return file ? { file } : MISSING_FILE_REFERENCE
  } catch (err) {
    // The SDK is configured with throwOnError, so every non-2xx lands here.
    const failure = err as { response?: { status?: number }; status?: number }
    const status = failure?.response?.status ?? failure?.status

    if (status === 404) {
      console.error(`[mapsStore] Map references file ${fileId}, which the server does not have`)
      return {
        file: null,
        error: {
          title: 'The image this map points to no longer exists',
          detail: [
            `This map references file ${fileId}, but the server has no such file.`,
            'It was most likely deleted, or it belongs to a different account -- the server',
            'reports both the same way so that file IDs cannot be probed.',
            'Edit the map and upload the image again to fix it.',
          ].join(' '),
        },
      }
    }

    console.error('[mapsStore] Failed to look up map image metadata', err)
    return {
      file: null,
      error: {
        title: 'The map image could not be looked up',
        detail: `${describeError(err)}${status ? ` (HTTP ${status})` : ''}. The map itself loaded, but its image record could not be read.`,
      },
    }
  }
}

const [mapsState, setMapsState] = createStore({
  maps: [] as StoryMap[],
  showMaps: false,
  selectedMapId: null as string | null,
  loadingMapId: null as string | null, // ID of map currently being loaded (for loading indicator)
  currentStoryTime: null as number | null, // null means "latest" (end of timeline), otherwise story time in minutes from 0 BBY
})

// Load maps from storage or server
const loadMaps = async (storyId?: string) => {
  try {
    if (storyId && (await isServerStory())) {
      // Maps should be loaded from export data, not here
      // This function is now only used for local stories
      // For server stories, use loadFromExport() instead
      console.warn('[mapsStore] loadMaps called for server story - should use loadFromExport instead')
      return
    }
    // Load from local storage
    const saved = await storage.get<StoryMap[]>('story-maps')
    if (saved) {
      setMapsState('maps', saved)
      // Don't auto-select - wait until user actually opens a map
    }
    mapsLoaded = true
  } catch (error) {
    console.error('Error loading maps:', error)
    mapsLoaded = true
  }
}

// Helper to check if current story is server-based
const isServerStory = async () => {
  return currentStoryStore.storageMode === 'server' && currentStoryStore.id
}

// Save all maps and landmarks (called during global save)
const saveAllMapsToServer = async () => {
  if (!currentStoryStore.isInitialized || currentStoryStore.storageMode !== 'server') {
    return
  }

  const storyId = currentStoryStore.id

  // Save all maps
  for (const map of mapsState.maps) {
    saveService.updateMap(storyId, map.id, map, false)
  }
}

// Auto-save maps to storage
createEffect(() => {
  const maps = mapsState.maps
  // Only save if maps have been loaded from storage first
  if (mapsLoaded) {
    // Run async save without blocking
    // Unwrap the proxy objects before saving
    const plainMaps = unwrap(maps)
    storage.set('story-maps', plainMaps).catch((error) => {
      console.error('Error saving maps to storage:', error)
    })
  }
})

export const mapsStore = {
  // Getters
  get maps() {
    return mapsState.maps
  },
  get showMaps() {
    return mapsState.showMaps
  },
  get selectedMapId() {
    return mapsState.selectedMapId
  },
  get selectedMap() {
    return mapsState.maps.find((map) => map.id === mapsState.selectedMapId)
  },
  get currentStoryTime() {
    return mapsState.currentStoryTime
  },
  get loadingMapId() {
    return mapsState.loadingMapId
  },

  // Actions
  setMaps: (maps: StoryMap[]) => setMapsState('maps', maps),

  addMap: async (name: string, imageData: string, borderColor?: string) => {
    const newMap: StoryMap = {
      id: generateMessageId(),
      name,
      imageData,
      borderColor,
      landmarks: [],
      fleets: [],
      hyperlanes: [],
    }

    // Get current story ID
    const storyId = currentStoryStore.id

    // Save to server if server story
    if (currentStoryStore.storageMode === 'server' && storyId) {
      try {
        // Queue the map creation
        saveService.createMap(storyId, newMap)
      } catch (error: any) {
        console.error('Failed to save map to server:', error)
        errorStore.addError(error.message || 'Failed to save map to server')
      }
    }

    setMapsState('maps', (prev) => [...prev, newMap])
    setMapsState('selectedMapId', newMap.id)
    return newMap
  },

  updateMap: async (id: string, updates: Partial<StoryMap>) => {
    setMapsState('maps', (map) => map.id === id, updates)

    // Save to server if server story
    const storyId = currentStoryStore.id

    if (currentStoryStore.storageMode === 'server' && storyId) {
      try {
        const map = mapsState.maps.find((m) => m.id === id)
        if (map) {
          saveService.updateMap(
            storyId,
            id,
            {
              ...map,
              ...updates,
            },
            false,
          )
        }
      } catch (error: any) {
        console.error('Failed to update map on server:', error)
        errorStore.addError(error.message || 'Failed to update map on server')
      }
    }
  },

  deleteMap: async (id: string) => {
    // Delete from server if server story
    const storyId = currentStoryStore.id

    if (currentStoryStore.storageMode === 'server' && storyId) {
      try {
        saveService.deleteMap(storyId, id)
      } catch (error: any) {
        console.error('Failed to delete map from server:', error)
        errorStore.addError(error.message || 'Failed to delete map from server')
      }
    }

    setMapsState('maps', (prev) => prev.filter((map) => map.id !== id))
    // Select next available map
    if (mapsState.selectedMapId === id) {
      const remainingMaps = mapsState.maps.filter((map) => map.id !== id)
      setMapsState('selectedMapId', remainingMaps.length > 0 ? remainingMaps[0].id : null)
    }
  },

  selectMap: async (id: string) => {
    setMapsState('selectedMapId', id)
    setMapsState('loadingMapId', id)
    try {
      // Lazy-load map details when selected
      await mapsStore.ensureMapDetails(id)
    } finally {
      setMapsState('loadingMapId', null)
    }
  },

  // Landmark actions
  addLandmark: (mapId: string, landmark: Omit<Landmark, 'id' | 'mapId'>) => {
    const newLandmark: Landmark = {
      ...landmark,
      id: generateMessageId(),
      mapId,
    }
    // Update state immediately for responsive UI
    setMapsState(
      'maps',
      (map) => map.id === mapId,
      'landmarks',
      (prev) => [...prev, newLandmark],
    )

    // Save only the landmark to server if server story
    const storyId = currentStoryStore.id

    if (currentStoryStore.storageMode === 'server' && storyId) {
      try {
        saveService.createLandmark(storyId, mapId, newLandmark)
      } catch (error: any) {
        console.error('Failed to save landmark to server:', error)
        errorStore.addError(error.message || 'Failed to save landmark to server')
      }
    }

    return newLandmark
  },

  updateLandmark: (mapId: string, landmarkId: string, updates: Partial<Landmark>) => {
    const mapIndex = mapsState.maps.findIndex((map) => map.id === mapId)
    if (mapIndex !== -1) {
      const landmarkIndex = mapsState.maps[mapIndex].landmarks.findIndex((l) => l.id === landmarkId)
      if (landmarkIndex !== -1) {
        // Update state immediately for responsive UI
        setMapsState('maps', mapIndex, 'landmarks', landmarkIndex, updates)

        // Save only the landmark to server if server story
        const storyId = currentStoryStore.id

        if (currentStoryStore.storageMode === 'server' && storyId) {
          try {
            const landmark = mapsState.maps[mapIndex].landmarks[landmarkIndex]
            if (landmark) {
              saveService.updateLandmark(storyId, mapId, landmarkId, { ...landmark, ...updates }, false)
            }
          } catch (error: any) {
            console.error('Failed to update landmark on server:', error)
            errorStore.addError(error.message || 'Failed to update landmark on server')
          }
        }
      }
    }
  },

  deleteLandmark: (mapId: string, landmarkId: string) => {
    const mapIndex = mapsState.maps.findIndex((map) => map.id === mapId)
    if (mapIndex !== -1) {
      // Update state immediately for responsive UI
      setMapsState('maps', mapIndex, 'landmarks', (prev) => prev.filter((landmark) => landmark.id !== landmarkId))

      // Delete only the landmark from server if server story
      const storyId = currentStoryStore.id

      if (currentStoryStore.storageMode === 'server' && storyId) {
        try {
          saveService.deleteLandmark(storyId, mapId, landmarkId)
        } catch (error: any) {
          console.error('Failed to delete landmark from server:', error)
          errorStore.addError(error.message || 'Failed to delete landmark from server')
        }
      }
    }
  },

  setShowMaps: (show: boolean) => setMapsState('showMaps', show),

  toggleMaps: () => setMapsState('showMaps', !mapsState.showMaps),

  setCurrentStoryTime: (time: number) => setMapsState('currentStoryTime', time),

  resetStoryTime: () => setMapsState('currentStoryTime', null),

  clearMaps: () => {
    setMapsState('maps', [])
    setMapsState('selectedMapId', null)
  },

  // Initialize maps for a story
  initializeMaps: async (storyId?: string) => {
    await loadMaps(storyId)
  },

  // Load basic map metadata from export data (server stories only)
  loadFromExport: async (
    maps: Array<{ id: string; name: string; fileId: string | null; borderColor: string; propertySchema?: any; landmarkCount?: number }>,
  ) => {
    // Load only basic metadata - detailed data (landmarks, fleets, etc) will be lazy-loaded when map is opened
    const basicMaps: StoryMap[] = maps.map((map) => ({
      id: map.id,
      name: map.name,
      imageData: '', // Will be loaded lazily
      borderColor: map.borderColor,
      propertySchema: map.propertySchema,
      landmarkCount: map.landmarkCount,
      landmarks: [], // Will be loaded lazily
      fleets: [], // Will be loaded lazily
      hyperlanes: [], // Will be loaded lazily
    }))

    setMapsState('maps', basicMaps)
    // Don't auto-select or load details - wait until user actually opens a map
  },

  // Lazy-load detailed map data (landmarks, fleets, hyperlanes, image) when needed
  ensureMapDetails: async (mapId: string) => {
    const map = mapsState.maps.find((m) => m.id === mapId)
    if (!map) {
      throw new Error(`Map ${mapId} not found`)
    }

    // Check if we already have the image loaded (the key required piece)
    // Landmarks/fleets/hyperlanes might legitimately be empty arrays
    if (map.imageData) {
      // Already loaded
      return
    }

    // Lazy-load detailed data from server
    if (currentStoryStore.storageMode === 'server') {
      try {
        console.log(`[mapsStore] Lazy-loading details for map ${mapId}`)

        // Get map to retrieve fileId
        const mapResponse = await getMyMapsById({ path: { id: mapId } })
        const fileId = mapResponse.data?.map?.fileId

        // Load image, landmarks, pawns (fleets), their movements, and paths
        // (hyperlanes) in parallel
        const [fileResult, landmarksData, pawnsData, movementsData, pathsData] = await Promise.all([
          fileId ? fetchFileMetadata(fileId) : Promise.resolve(MISSING_FILE_REFERENCE),
          getMyMapsByMapIdLandmarks({ path: { mapId } })
            .then((r) => r.data?.landmarks || [])
            .catch(() => []),
          getMyMapsByMapIdPawns({ path: { mapId } })
            .then((r) => r.data?.pawns || [])
            .catch(() => []),
          getMyMapsByMapIdPawnMovements({ path: { mapId } })
            .then((r) => r.data?.movements || [])
            .catch(() => []),
          getMyMapsByMapIdPaths({ path: { mapId }, query: { includeSegments: 'true' } } as any)
            .then((r) => r.data?.paths || [])
            .catch(() => []),
        ])

        // Fetch image with credentials and create blob URL
        let imageData = ''
        let imageError = fileResult.error
        const filePath = fileResult.file?.path
        if (filePath) {
          try {
            const imageUrl = `${getApiBaseUrl()}${filePath}`
            const response = await fetch(imageUrl, { credentials: 'include' })
            if (response.ok) {
              const blob = await response.blob()
              imageData = URL.createObjectURL(blob)
            } else {
              console.error(`[mapsStore] Failed to fetch image: ${response.status}`)
              imageError = {
                title: 'The map image could not be downloaded',
                detail: [
                  `The file record exists, but the server returned ${response.status} for its contents.`,
                  'This usually means the file was uploaded in a different environment, so the bytes',
                  'live somewhere this server cannot reach.',
                ].join(' '),
              }
            }
          } catch (err) {
            console.error('[mapsStore] Error fetching image:', err)
            imageError = {
              title: 'The map image could not be downloaded',
              detail: `${describeError(err)}. The request for the image never completed.`,
            }
          }
        }

        // Update the map with detailed data
        // Convert API types to local types using mappers
        setMapsState('maps', (m) => m.id === mapId, {
          imageData,
          // Cleared explicitly on success: the store is long-lived, so leaving a
          // stale error behind would outlive the problem it described.
          imageError: imageData ? undefined : imageError,
          detailsLoaded: true,
          landmarks: (landmarksData || []).map((l: ApiLandmark) => apiLandmarkToLandmark(l)),
          fleets: (pawnsData || []).map((p: ApiPawn) => pawnToFleet(p, movementsData || [])),
          hyperlanes: (pathsData || []).map((p: ApiPath) => pathToHyperlane(p)), // Segments loaded separately if needed
        })
      } catch (error) {
        console.error(`[mapsStore] Failed to load details for map ${mapId}:`, error)
        throw error
      }
    }
  },

  // Save all maps to server (for global save)
  saveAllMaps: saveAllMapsToServer,

  // Fleet actions
  addFleet: (mapId: string, fleet: Omit<Fleet, 'id' | 'mapId' | 'movements'>) => {
    const newFleet: Fleet = {
      ...fleet,
      id: generateMessageId(),
      mapId,
      movements: [],
    }
    // Update state immediately for responsive UI
    setMapsState(
      'maps',
      (map) => map.id === mapId,
      'fleets',
      (prev) => [...(prev || []), newFleet],
    )

    // Save only the fleet to server if server story
    const storyId = currentStoryStore.id

    if (currentStoryStore.storageMode === 'server' && storyId) {
      try {
        saveService.createFleet(storyId, mapId, newFleet)
      } catch (error: any) {
        console.error('Failed to save fleet to server:', error)
        errorStore.addError(error.message || 'Failed to save fleet to server')
      }
    }

    return newFleet
  },

  updateFleet: (mapId: string, fleetId: string, updates: Partial<Fleet>) => {
    const mapIndex = mapsState.maps.findIndex((map) => map.id === mapId)
    if (mapIndex !== -1) {
      const fleetIndex = mapsState.maps[mapIndex].fleets?.findIndex((f) => f.id === fleetId) ?? -1
      if (fleetIndex !== -1) {
        // Update state immediately for responsive UI
        setMapsState('maps', mapIndex, 'fleets', fleetIndex, updates)

        // Save only the fleet to server if server story
        const storyId = currentStoryStore.id

        if (currentStoryStore.storageMode === 'server' && storyId) {
          try {
            const fleet = mapsState.maps[mapIndex].fleets?.[fleetIndex]
            if (fleet) {
              saveService.updateFleet(storyId, mapId, fleetId, { ...fleet, ...updates }, false)
            }
          } catch (error: any) {
            console.error('Failed to update fleet on server:', error)
            errorStore.addError(error.message || 'Failed to update fleet on server')
          }
        }
      }
    }
  },

  deleteFleet: (mapId: string, fleetId: string) => {
    const mapIndex = mapsState.maps.findIndex((map) => map.id === mapId)
    if (mapIndex !== -1) {
      // Update state immediately for responsive UI
      setMapsState('maps', mapIndex, 'fleets', (prev) => (prev || []).filter((fleet) => fleet.id !== fleetId))

      // Delete only the fleet from server if server story
      const storyId = currentStoryStore.id

      if (currentStoryStore.storageMode === 'server' && storyId) {
        try {
          saveService.deleteFleet(storyId, mapId, fleetId)
        } catch (error: any) {
          console.error('Failed to delete fleet from server:', error)
          errorStore.addError(error.message || 'Failed to delete fleet from server')
        }
      }
    }
  },

  // Fleet movement actions
  addFleetMovement: (mapId: string, fleetId: string, movement: Omit<FleetMovement, 'id' | 'mapId' | 'fleetId'>) => {
    const newMovement: FleetMovement = {
      ...movement,
      id: generateMessageId(),
      mapId,
      fleetId,
    }

    const mapIndex = mapsState.maps.findIndex((map) => map.id === mapId)
    if (mapIndex !== -1) {
      const fleetIndex = mapsState.maps[mapIndex].fleets?.findIndex((f) => f.id === fleetId) ?? -1
      if (fleetIndex !== -1) {
        // Update state immediately for responsive UI
        setMapsState('maps', mapIndex, 'fleets', fleetIndex, 'movements', (prev) => [...(prev || []), newMovement])

        // Save only the movement to server if server story
        const storyId = currentStoryStore.id

        if (currentStoryStore.storageMode === 'server' && storyId) {
          try {
            saveService.createFleetMovement(storyId, mapId, fleetId, newMovement)
          } catch (error: any) {
            console.error('Failed to save fleet movement to server:', error)
            errorStore.addError(error.message || 'Failed to save fleet movement to server')
          }
        }
      }
    }

    return newMovement
  },

  updateFleetMovement: (mapId: string, fleetId: string, movementId: string, updates: Partial<FleetMovement>) => {
    const mapIndex = mapsState.maps.findIndex((map) => map.id === mapId)
    if (mapIndex !== -1) {
      const fleetIndex = mapsState.maps[mapIndex].fleets?.findIndex((f) => f.id === fleetId) ?? -1
      if (fleetIndex !== -1) {
        const movementIndex =
          mapsState.maps[mapIndex].fleets?.[fleetIndex].movements?.findIndex((m) => m.id === movementId) ?? -1
        if (movementIndex !== -1) {
          // Update state immediately for responsive UI
          setMapsState('maps', mapIndex, 'fleets', fleetIndex, 'movements', movementIndex, updates)

          // Save only the movement to server if server story
          const storyId = currentStoryStore.id

          if (currentStoryStore.storageMode === 'server' && storyId) {
            try {
              const movement = mapsState.maps[mapIndex].fleets?.[fleetIndex].movements?.[movementIndex]
              if (movement) {
                saveService.updateFleetMovement(storyId, mapId, fleetId, movementId, { ...movement, ...updates }, false)
              }
            } catch (error: any) {
              console.error('Failed to update fleet movement on server:', error)
              errorStore.addError(error.message || 'Failed to update fleet movement on server')
            }
          }
        }
      }
    }
  },

  deleteFleetMovement: (mapId: string, fleetId: string, movementId: string) => {
    const mapIndex = mapsState.maps.findIndex((map) => map.id === mapId)
    if (mapIndex !== -1) {
      const fleetIndex = mapsState.maps[mapIndex].fleets?.findIndex((f) => f.id === fleetId) ?? -1
      if (fleetIndex !== -1) {
        // Update state immediately for responsive UI
        setMapsState('maps', mapIndex, 'fleets', fleetIndex, 'movements', (prev) =>
          (prev || []).filter((m) => m.id !== movementId),
        )

        // Delete only the movement from server if server story
        const storyId = currentStoryStore.id

        if (currentStoryStore.storageMode === 'server' && storyId) {
          try {
            saveService.deleteFleetMovement(storyId, mapId, fleetId, movementId)
          } catch (error: any) {
            console.error('Failed to delete fleet movement from server:', error)
            errorStore.addError(error.message || 'Failed to delete fleet movement from server')
          }
        }
      }
    }
  },

  // Hyperlane actions
  addHyperlane: (mapId: string, hyperlane: Omit<Hyperlane, 'id' | 'mapId'>) => {
    const id = generateMessageId()
    // The map editor builds segments before the lane that owns them exists, so it
    // leaves `hyperlaneId` blank. Filling it in here keeps the freshly created shape
    // identical to the one that comes back from the server on the next load.
    const newHyperlane: Hyperlane = {
      ...hyperlane,
      id,
      mapId,
      segments: (hyperlane.segments ?? []).map((segment) => ({ ...segment, hyperlaneId: id, mapId })),
    }
    // Update state immediately for responsive UI
    setMapsState(
      'maps',
      (map) => map.id === mapId,
      'hyperlanes',
      (prev) => [...(prev || []), newHyperlane],
    )

    // Save to server if server story
    const storyId = currentStoryStore.id

    if (currentStoryStore.storageMode === 'server' && storyId) {
      try {
        saveService.createHyperlane(storyId, mapId, newHyperlane)
      } catch (error: any) {
        console.error('Failed to save hyperlane to server:', error)
        errorStore.addError(error.message || 'Failed to save hyperlane to server')
      }
    }

    return newHyperlane
  },

  updateHyperlane: (mapId: string, hyperlaneId: string, updates: Partial<Hyperlane>) => {
    const mapIndex = mapsState.maps.findIndex((map) => map.id === mapId)
    if (mapIndex !== -1) {
      const hyperlaneIndex = mapsState.maps[mapIndex].hyperlanes?.findIndex((h) => h.id === hyperlaneId) ?? -1
      if (hyperlaneIndex !== -1) {
        // Update state immediately for responsive UI
        setMapsState('maps', mapIndex, 'hyperlanes', hyperlaneIndex, updates)

        // Save to server if server story
        const storyId = currentStoryStore.id

        if (currentStoryStore.storageMode === 'server' && storyId) {
          try {
            const hyperlane = mapsState.maps[mapIndex].hyperlanes?.[hyperlaneIndex]
            if (hyperlane) {
              saveService.updateHyperlane(storyId, mapId, hyperlaneId, { ...hyperlane, ...updates }, false)
            }
          } catch (error: any) {
            console.error('Failed to update hyperlane on server:', error)
            errorStore.addError(error.message || 'Failed to update hyperlane on server')
          }
        }
      }
    }
  },

  deleteHyperlane: (mapId: string, hyperlaneId: string) => {
    const mapIndex = mapsState.maps.findIndex((map) => map.id === mapId)
    if (mapIndex !== -1) {
      // Update state immediately for responsive UI
      setMapsState('maps', mapIndex, 'hyperlanes', (prev) =>
        (prev || []).filter((hyperlane) => hyperlane.id !== hyperlaneId),
      )

      // Delete from server if server story
      const storyId = currentStoryStore.id

      if (currentStoryStore.storageMode === 'server' && storyId) {
        try {
          saveService.deleteHyperlane(storyId, mapId, hyperlaneId)
        } catch (error: any) {
          console.error('Failed to delete hyperlane from server:', error)
          errorStore.addError(error.message || 'Failed to delete hyperlane from server')
        }
      }
    }
  },
}

// Subscribe to story lifecycle events
on('story:new', () => {
  mapsStore.clearMaps()
})

on('story:loaded', ({ storyId, storageMode }) => {
  mapsStore.initializeMaps(storageMode === 'server' ? storyId : undefined)
})
