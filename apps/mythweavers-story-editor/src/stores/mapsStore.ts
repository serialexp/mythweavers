import { createStore, unwrap } from 'solid-js/store'
import { createEffect, batch } from 'solid-js'
import { StoryMap, Landmark, Fleet, FleetMovement, Hyperlane } from '../types/core'
import { storage } from '../utils/storage'
import { generateMessageId } from '../utils/id'
import { saveService } from '../services/saveService'
import { apiClient } from '../utils/apiClient' // Still needed for getMaps
import { errorStore } from './errorStore'
import { currentStoryStore } from './currentStoryStore'
import { getMyMapsById, getMyMapsByMapIdLandmarks, getMyMapsByMapIdPawns, getMyMapsByMapIdPaths, getMyFilesById, getApiBaseUrl } from '../client/config'

// Track if maps have been loaded
let mapsLoaded = false

const [mapsState, setMapsState] = createStore({
  maps: [] as StoryMap[],
  showMaps: false,
  selectedMapId: null as string | null,
  currentStoryTime: null as number | null // null means "latest" (end of timeline), otherwise story time in minutes from 0 BBY
})

// Load maps from storage or server
const loadMaps = async (storyId?: string) => {
  try {
    if (storyId && await isServerStory()) {
      // Maps should be loaded from export data, not here
      // This function is now only used for local stories
      // For server stories, use loadFromExport() instead
      console.warn('[mapsStore] loadMaps called for server story - should use loadFromExport instead')
      return

      // Load map metadata from server
      const serverMaps = await apiClient.getMaps(storyId)

      // Load detailed data for each map in parallel
      const maps = await Promise.all(
        serverMaps.map(async (mapMetadata) => {
          // Load image, landmarks, hyperlanes, and fleets in parallel for this map
          const [imageResult, landmarks, hyperlanes, fleets] = await Promise.all([
            apiClient.getMapImage(mapMetadata.id).catch(() => ({ imageData: null })),
            apiClient.getMapLandmarks(mapMetadata.id).catch(() => []),
            apiClient.getMapHyperlanes(mapMetadata.id).catch(() => []),
            apiClient.getMapFleets(mapMetadata.id).catch(() => [])
          ])

          return {
            id: mapMetadata.id,
            name: mapMetadata.name,
            imageData: imageResult.imageData || '',
            borderColor: mapMetadata.borderColor,
            landmarks: landmarks,
            fleets: fleets,
            hyperlanes: hyperlanes
          }
        })
      )

      batch(() => {
        setMapsState('maps', maps)
        // Select first map if available
        if (maps.length > 0 && !mapsState.selectedMapId) {
          setMapsState('selectedMapId', maps[0].id)
        }
      })
    } else {
      // Load from local storage
      const saved = await storage.get<StoryMap[]>('story-maps')
      if (saved) {
        batch(() => {
          setMapsState('maps', saved)
          // Select first map if available
          if (saved.length > 0 && !mapsState.selectedMapId) {
            setMapsState('selectedMapId', saved[0].id)
          }
        })
      }
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
    storage.set('story-maps', plainMaps).catch(error => {
      console.error('Error saving maps to storage:', error)
    })
  }
})

export const mapsStore = {
  // Getters
  get maps() { return mapsState.maps },
  get showMaps() { return mapsState.showMaps },
  get selectedMapId() { return mapsState.selectedMapId },
  get selectedMap() { 
    return mapsState.maps.find(map => map.id === mapsState.selectedMapId)
  },
  get currentStoryTime() { return mapsState.currentStoryTime },

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
      hyperlanes: []
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

    setMapsState('maps', prev => [...prev, newMap])
    setMapsState('selectedMapId', newMap.id)
    return newMap
  },
  
  updateMap: async (id: string, updates: Partial<StoryMap>) => {
    setMapsState('maps', map => map.id === id, updates)

    // Save to server if server story
    const storyId = currentStoryStore.id

    if (currentStoryStore.storageMode === 'server' && storyId) {
      try {
        const map = mapsState.maps.find(m => m.id === id)
        if (map) {
          saveService.updateMap(storyId, id, {
            ...map,
            ...updates
          }, false)
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

    setMapsState('maps', prev => prev.filter(map => map.id !== id))
    // Select next available map
    if (mapsState.selectedMapId === id) {
      const remainingMaps = mapsState.maps.filter(map => map.id !== id)
      setMapsState('selectedMapId', remainingMaps.length > 0 ? remainingMaps[0].id : null)
    }
  },

  selectMap: async (id: string) => {
    setMapsState('selectedMapId', id)
    // Lazy-load map details when selected
    await mapsStore.ensureMapDetails(id)
  },

  // Landmark actions
  addLandmark: (mapId: string, landmark: Omit<Landmark, 'id' | 'mapId'>) => {
    const newLandmark: Landmark = {
      ...landmark,
      id: generateMessageId(),
      mapId
    }
    // Update state immediately for responsive UI
    setMapsState('maps', map => map.id === mapId, 'landmarks', prev => [...prev, newLandmark])

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
    const mapIndex = mapsState.maps.findIndex(map => map.id === mapId)
    if (mapIndex !== -1) {
      const landmarkIndex = mapsState.maps[mapIndex].landmarks.findIndex(l => l.id === landmarkId)
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
    const mapIndex = mapsState.maps.findIndex(map => map.id === mapId)
    if (mapIndex !== -1) {
      // Update state immediately for responsive UI
      setMapsState('maps', mapIndex, 'landmarks', prev =>
        prev.filter(landmark => landmark.id !== landmarkId)
      )

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
  loadFromExport: async (maps: Array<{ id: string; name: string; fileId: string | null; borderColor: string }>) => {
    // Load only basic metadata - detailed data (landmarks, fleets, etc) will be lazy-loaded when map is opened
    const basicMaps: StoryMap[] = maps.map(map => ({
      id: map.id,
      name: map.name,
      imageData: '', // Will be loaded lazily
      borderColor: map.borderColor,
      landmarks: [], // Will be loaded lazily
      fleets: [], // Will be loaded lazily
      hyperlanes: [], // Will be loaded lazily
    }))

    batch(() => {
      setMapsState('maps', basicMaps)
      // Select first map if available
      if (basicMaps.length > 0 && !mapsState.selectedMapId) {
        setMapsState('selectedMapId', basicMaps[0].id)
      }
    })

    // Ensure details for the first map are loaded
    if (basicMaps.length > 0) {
      await mapsStore.ensureMapDetails(basicMaps[0].id)
    }
  },

  // Lazy-load detailed map data (landmarks, fleets, hyperlanes, image) when needed
  ensureMapDetails: async (mapId: string) => {
    const map = mapsState.maps.find(m => m.id === mapId)
    if (!map) {
      throw new Error(`Map ${mapId} not found`)
    }

    // Check if we already have detailed data
    const hasDetails = (map.landmarks && map.landmarks.length > 0) ||
                       (map.fleets && map.fleets.length > 0) ||
                       (map.hyperlanes && map.hyperlanes.length > 0) ||
                       map.imageData

    if (hasDetails) {
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

        // Load image, landmarks, pawns (fleets), and paths (hyperlanes) in parallel
        const [fileMetadata, landmarksData, pawnsData, pathsData] = await Promise.all([
          fileId ? getMyFilesById({ path: { id: fileId } }).then(r => r.data?.file).catch(() => null) : Promise.resolve(null),
          getMyMapsByMapIdLandmarks({ path: { mapId } }).then(r => r.data?.landmarks || []).catch(() => []),
          getMyMapsByMapIdPawns({ path: { mapId } }).then(r => r.data?.pawns || []).catch(() => []),
          getMyMapsByMapIdPaths({ path: { mapId } }).then(r => r.data?.paths || []).catch(() => [])
        ])

        // Construct full image URL from file path
        const imageData = fileMetadata?.path
          ? `${getApiBaseUrl()}${fileMetadata.path}`
          : ''

        // Update the map with detailed data
        setMapsState('maps', m => m.id === mapId, {
          imageData: imageData || '',
          landmarks: landmarksData || [],
          fleets: pawnsData || [], // pawns = fleets in new schema
          hyperlanes: pathsData || [], // paths = hyperlanes in new schema
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
      movements: []
    }
    // Update state immediately for responsive UI
    setMapsState('maps', map => map.id === mapId, 'fleets', prev => [...(prev || []), newFleet])

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
    const mapIndex = mapsState.maps.findIndex(map => map.id === mapId)
    if (mapIndex !== -1) {
      const fleetIndex = mapsState.maps[mapIndex].fleets?.findIndex(f => f.id === fleetId) ?? -1
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
    const mapIndex = mapsState.maps.findIndex(map => map.id === mapId)
    if (mapIndex !== -1) {
      // Update state immediately for responsive UI
      setMapsState('maps', mapIndex, 'fleets', prev =>
        (prev || []).filter(fleet => fleet.id !== fleetId)
      )

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
      fleetId
    }

    const mapIndex = mapsState.maps.findIndex(map => map.id === mapId)
    if (mapIndex !== -1) {
      const fleetIndex = mapsState.maps[mapIndex].fleets?.findIndex(f => f.id === fleetId) ?? -1
      if (fleetIndex !== -1) {
        // Update state immediately for responsive UI
        setMapsState('maps', mapIndex, 'fleets', fleetIndex, 'movements', prev => [...(prev || []), newMovement])

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
    const mapIndex = mapsState.maps.findIndex(map => map.id === mapId)
    if (mapIndex !== -1) {
      const fleetIndex = mapsState.maps[mapIndex].fleets?.findIndex(f => f.id === fleetId) ?? -1
      if (fleetIndex !== -1) {
        const movementIndex = mapsState.maps[mapIndex].fleets?.[fleetIndex].movements?.findIndex(m => m.id === movementId) ?? -1
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
    const mapIndex = mapsState.maps.findIndex(map => map.id === mapId)
    if (mapIndex !== -1) {
      const fleetIndex = mapsState.maps[mapIndex].fleets?.findIndex(f => f.id === fleetId) ?? -1
      if (fleetIndex !== -1) {
        // Update state immediately for responsive UI
        setMapsState('maps', mapIndex, 'fleets', fleetIndex, 'movements', prev =>
          (prev || []).filter(m => m.id !== movementId)
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
    const newHyperlane: Hyperlane = {
      ...hyperlane,
      id: generateMessageId(),
      mapId
    }
    // Update state immediately for responsive UI
    setMapsState('maps', map => map.id === mapId, 'hyperlanes', prev => [...(prev || []), newHyperlane])

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
    const mapIndex = mapsState.maps.findIndex(map => map.id === mapId)
    if (mapIndex !== -1) {
      const hyperlaneIndex = mapsState.maps[mapIndex].hyperlanes?.findIndex(h => h.id === hyperlaneId) ?? -1
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
    const mapIndex = mapsState.maps.findIndex(map => map.id === mapId)
    if (mapIndex !== -1) {
      // Update state immediately for responsive UI
      setMapsState('maps', mapIndex, 'hyperlanes', prev =>
        (prev || []).filter(hyperlane => hyperlane.id !== hyperlaneId)
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
  }
}