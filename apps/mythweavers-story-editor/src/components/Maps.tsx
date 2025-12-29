import { ListDetailPanel, type ListDetailPanelRef } from '@mythweavers/ui'
import * as PIXI from 'pixi.js'
import { BsArrowLeft, BsCheck, BsPencil, BsPlus, BsTrash, BsX } from 'solid-icons/bs'
import { Component, Show, batch, createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js'
import { useFleetManager } from '../hooks/maps/useFleetManager'
import { useHyperlaneManager } from '../hooks/maps/useHyperlaneManager'
import { useLandmarkManager } from '../hooks/maps/useLandmarkManager'
import { useMapInteractions } from '../hooks/maps/useMapInteractions'
import { useMapLoader } from '../hooks/maps/useMapLoader'
import { usePathfinding } from '../hooks/maps/usePathfinding'
import { usePixiMap } from '../hooks/maps/usePixiMap'
import { currentStoryStore } from '../stores/currentStoryStore'
import { landmarkStatesStore } from '../stores/landmarkStatesStore'
import { mapEditorStore } from '../stores/mapEditorStore'
import { mapsStore } from '../stores/mapsStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { scriptDataStore } from '../stores/scriptDataStore'
import type { Fleet, Hyperlane, HyperlaneSegment, Landmark, StoryMap } from '../types/core'
import { generateMessageId } from '../utils/id'
import { searchLandmarkInfo } from '../utils/landmarkSearch'
import { ColoredLandmark, parseColorToHex } from '../utils/maps/colorUtils'
import { LandmarkSprite } from '../utils/maps/landmarkRenderer'
import {
  AnimationHandle,
  cancelAnimation,
  drawBlurredVoronoi,
  drawDistanceField,
  drawStandardVoronoi,
} from '../utils/maps/voronoiRenderer'
import { evaluateTemplate } from '../utils/scriptEngine'
import { getChapterAtStoryTime, getTimelineRange } from '../utils/timelineUtils'
import * as styles from './Maps.css'
import { EJSCodeEditor } from './EJSCodeEditor'
import { MapToolbar } from './maps/MapToolbar'
import { PawnDetail } from './maps/PawnDetail'
import { PathDetail } from './maps/PathDetail'
import { LandmarkDetail } from './maps/LandmarkDetail'
import { LandmarksList } from './maps/LandmarksList'
import { MapTimeline } from './maps/MapTimeline'
import { createFleetMovementsFromPath } from './maps/fleetMovementHandler'

export const Maps: Component = () => {
  const [canvasContainer, setCanvasContainer] = createSignal<HTMLDivElement | undefined>(undefined)
  let popupElement: HTMLDivElement | undefined
  let panelRef: ListDetailPanelRef | undefined

  // Use the PIXI map hook
  const pixiMap = usePixiMap(canvasContainer)
  const { app, viewport, containers, initialize, isReady, render: renderPixi } = pixiMap

  // Use the map loader hook
  const mapLoader = useMapLoader()
  const { mapSprite, loadMap: loadMapImage } = mapLoader

  const [newMapName, setNewMapName] = createSignal('')
  const [newMapBorderColor, setNewMapBorderColor] = createSignal('')
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null)
  const [selectedFileName, setSelectedFileName] = createSignal('')
  const [editingMapBorderColor, setEditingMapBorderColor] = createSignal(false)
  const [editMapBorderColorValue, setEditMapBorderColorValue] = createSignal('')
  // Unified selection state
  type Selection =
    | { type: 'none' }
    | { type: 'landmark'; id: string }
    | { type: 'pawn'; id: string }
    | { type: 'path'; id: string }
    | { type: 'new-landmark' }
    | { type: 'new-pawn' }

  const [selection, setSelection] = createSignal<Selection>({ type: 'none' })

  // Helper memos to get the actual selected objects from stores
  const selectedLandmark = createMemo(() => {
    const sel = selection()
    if (sel.type !== 'landmark') return null
    return mapsStore.selectedMap?.landmarks.find((lm) => lm.id === sel.id) || null
  })

  const selectedFleet = createMemo(() => {
    const sel = selection()
    if (sel.type !== 'pawn') return null
    return mapsStore.selectedMap?.fleets?.find((f) => f.id === sel.id) || null
  })

  const selectedHyperlane = createMemo(() => {
    const sel = selection()
    if (sel.type !== 'path') return null
    return mapsStore.selectedMap?.hyperlanes?.find((h) => h.id === sel.id) || null
  })

  const isAddingNew = createMemo(() => selection().type === 'new-landmark')
  const isAddingFleet = createMemo(() => selection().type === 'new-pawn')

  // Wrapper functions for selection updates (for backwards compatibility during refactor)
  const setSelectedLandmark = (lm: Landmark | null) => {
    if (lm) {
      setSelection({ type: 'landmark', id: lm.id })
    } else if (selection().type === 'landmark') {
      setSelection({ type: 'none' })
    }
  }

  const setSelectedFleet = (fleet: Fleet | null) => {
    if (fleet) {
      setSelection({ type: 'pawn', id: fleet.id })
    } else if (selection().type === 'pawn') {
      setSelection({ type: 'none' })
    }
  }

  const setSelectedHyperlane = (hyperlane: Hyperlane | null) => {
    if (hyperlane) {
      setSelection({ type: 'path', id: hyperlane.id })
    } else if (selection().type === 'path') {
      setSelection({ type: 'none' })
    }
  }

  const setIsAddingNew = (adding: boolean) => {
    if (adding) {
      setSelection({ type: 'new-landmark' })
    } else if (selection().type === 'new-landmark') {
      setSelection({ type: 'none' })
    }
  }

  const setIsAddingFleet = (adding: boolean) => {
    if (adding) {
      setSelection({ type: 'new-pawn' })
    } else if (selection().type === 'new-pawn') {
      setSelection({ type: 'none' })
    }
  }

  // Helper to clear all selection
  const clearSelection = () => setSelection({ type: 'none' })

  const [popupPosition, setPopupPosition] = createSignal({ x: 0, y: 0 })

  // Local UI state (not in store)
  const [isShiftHeld, setIsShiftHeld] = createSignal(false)
  const [distanceFieldAnimation, setDistanceFieldAnimation] = createSignal<AnimationHandle | null>(null)
  const [isRendering, setIsRendering] = createSignal(false)

  // Quick color picks
  const quickColors = [
    { name: 'Red', hex: '#e74c3c' },
    { name: 'Yellow', hex: '#f1c40f' },
    { name: 'Purple', hex: '#9b59b6' },
    { name: 'Orange', hex: '#e67e22' },
    { name: 'Light Blue', hex: '#74c8eb' },
    { name: 'Pink', hex: '#ff69b4' },
    { name: 'Blue', hex: '#3498db' },
    { name: 'White', hex: '#ffffff' },
  ]

  // Hyperlane creation status text
  const hyperlaneCreationStatus = createMemo(() => {
    if (!mapEditorStore.isCreatingPath) {
      return 'Idle'
    }
    const segmentCount = mapEditorStore.currentPathSegments.length
    return `Creating - ${segmentCount} segment${segmentCount === 1 ? '' : 's'}`
  })

  // Timeline range and current story time
  const timelineRange = createMemo(() => getTimelineRange(currentStoryStore, nodeStore.nodesArray))

  const currentStoryTime = createMemo(() => {
    const pending = mapEditorStore.pendingStoryTime
    if (pending !== null) return pending

    const stored = mapsStore.currentStoryTime
    if (stored !== null) return stored

    // Default to end of timeline
    const range = timelineRange()
    return range.end
  })

  // Get chapter at the current story time (for script data)
  const activeChapter = createMemo(() => {
    const storyTime = currentStoryTime()
    return getChapterAtStoryTime(storyTime, nodeStore.nodesArray)
  })

  // Get message ID at current timeline position (only used for script data evaluation)
  // This finds the last message in the active chapter
  const currentMessageIdForScripts = createMemo(() => {
    const chapter = activeChapter()
    if (!chapter) return null

    // Get messages for this chapter
    const messages = messagesStore.messages
      .filter((m) => m.sceneId === chapter.id && m.role === 'assistant' && !m.isQuery)
      .sort((a, b) => a.order - b.order)

    // Return last message
    return messages.length > 0 ? messages[messages.length - 1].id : null
  })

  // Cache script execution data via scriptDataStore so we don't re-run scripts
  // for every landmark render (expensive with hundreds of landmarks)
  const scriptDataAtTimeline = createMemo(() => {
    const messageId = currentMessageIdForScripts()
    if (!messageId) {
      return {}
    }

    const cached = scriptDataStore.getCumulativeDataAtMessage(messageId)
    return cached ? cached : {}
  })

  // Helper to keep existing call sites simple
  const getScriptDataAtTimeline = () => scriptDataAtTimeline()

  // Evaluate border color for a landmark
  const evaluateLandmarkBorderColor = (landmarkName: string): string => {
    const map = mapsStore.selectedMap
    if (!map?.borderColor) return ''

    const scriptData = getScriptDataAtTimeline()

    // Get the allegiance for this landmark
    const landmark = map.landmarks.find((l) => l.name === landmarkName)
    const allegiance = landmark ? landmarkStatesStore.getLandmarkState(map.id, landmark.id, 'allegiance') : null

    // Build a systems object from all landmark states
    const systems: Record<string, string> = {}
    for (const l of map.landmarks) {
      const state = landmarkStatesStore.getLandmarkState(map.id, l.id, 'allegiance')
      if (state) {
        systems[l.name] = state
      }
    }

    const dataWithContext = {
      ...scriptData,
      currentSystemName: landmarkName,
      currentAllegiance: allegiance,
      systems, // Now populated from landmark states instead of scripts
    }

    try {
      const result = evaluateTemplate(map.borderColor, dataWithContext)
      return result.trim()
    } catch (error) {
      console.error('Error evaluating border color:', error)
      return ''
    }
  }

  // Use the landmark manager hook
  // Note: Hook now reads shouldStopPropagation and interactive from mapEditorStore directly
  const landmarkManager = useLandmarkManager({
    app,
    viewport,
    containers,
    mapSprite,
    canvasContainer,
    evaluateBorderColor: evaluateLandmarkBorderColor,
    onLandmarkClick: (lm, _screenPos, button) => {
      // Only handle left clicks in select mode
      if (button !== 0) return
      if (mapEditorStore.creationMode !== 'select') return
      if (mapEditorStore.paintModeEnabled) return

      // Select the landmark
      setSelection({ type: 'landmark', id: lm.id })
      mapEditorStore.cancelEditing()
    },
  })

  // Use the fleet manager hook
  // Note: Hook now reads currentStoryTime and selectedFleetId from stores directly
  const fleetManager = useFleetManager({
    viewport,
    containers,
    mapSprite,
    canvasContainer,
    onFleetClick: (fleet, _screenPos, button) => {
      // Only handle left clicks in select mode
      if (button !== 0) return
      if (mapEditorStore.creationMode !== 'select') return

      // Select the pawn
      mapEditorStore.setSelectedFleetForMovement(fleet)
      setSelection({ type: 'pawn', id: fleet.id })
      mapEditorStore.cancelEditing()
    },
  })

  // Use the hyperlane manager hook
  // Note: Hook now reads shouldStopPropagation and interactive from mapEditorStore directly
  const hyperlaneManager = useHyperlaneManager({
    viewport,
    containers,
    mapSprite,
    canvasContainer,
    onHyperlaneClick: (hyperlane, _screenPos) => {
      // Only handle hyperlane clicks in select mode
      if (mapEditorStore.creationMode !== 'select') {
        return
      }

      // Select the path
      setSelection({ type: 'path', id: hyperlane.id })
      mapEditorStore.cancelEditing()
    },
  })

  // Use the pathfinding hook
  const pathfinding = usePathfinding({
    containers,
    mapSprite,
    currentStoryTime,
    landmarks: () => mapsStore.selectedMap?.landmarks || [],
    hyperlanes: () => mapsStore.selectedMap?.hyperlanes || [],
  })

  // Helper function to generate next junction name
  const getNextJunctionName = () => {
    const map = mapsStore.selectedMap
    if (!map) return 'Junction 1'

    // Count existing junctions
    const junctionCount = map.landmarks.filter((l) => l.type === 'junction').length
    return `Junction ${junctionCount + 1}`
  }

  // Helper function to check if clicking near a landmark and return it if so
  const findNearbyLandmark = (position: { x: number; y: number; normalizedX: number; normalizedY: number }) => {
    const map = mapsStore.selectedMap
    if (!map) return null

    const snapRadius = 30 // pixels
    const sprite = mapSprite()
    const vp = viewport()
    if (!sprite || !vp) return null

    for (const landmark of map.landmarks) {
      const landmarkWorldX = landmark.x * sprite.width
      const landmarkWorldY = landmark.y * sprite.height
      const landmarkScreen = vp.toScreen(landmarkWorldX, landmarkWorldY)

      const dx = position.x - landmarkScreen.x
      const dy = position.y - landmarkScreen.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance <= snapRadius) {
        return landmark
      }
    }
    return null
  }

  // Handle right-click in hyperlane mode
  const handleHyperlaneRightClick = (position: { x: number; y: number; normalizedX: number; normalizedY: number }) => {
    const map = mapsStore.selectedMap
    if (!map) return

    const nearbyLandmark = findNearbyLandmark(position)

    // Determine the click position (snap to landmark if nearby)
    const clickX = nearbyLandmark ? nearbyLandmark.x : position.normalizedX
    const clickY = nearbyLandmark ? nearbyLandmark.y : position.normalizedY

    if (!mapEditorStore.isCreatingPath) {
      // Start a new hyperlane
      console.log('Starting new hyperlane at', clickX, clickY)

      // If not snapping to a landmark, create a junction
      let startLandmarkId: string | null = null
      if (!nearbyLandmark) {
        const junction = mapsStore.addLandmark(map.id, {
          x: clickX,
          y: clickY,
          name: getNextJunctionName(),
          description: '',
          type: 'junction',
          color: '#ffffff',
          size: 'small',
          properties: {},
        })
        startLandmarkId = junction.id
        updateLandmarks()
      } else {
        startLandmarkId = nearbyLandmark.id
        console.log(`Snapped to landmark: ${nearbyLandmark.name || 'junction'}`)
      }

      // Initialize the first segment (just the start point, no end yet)
      // Use batch() to update all three signals atomically
      batch(() => {
        mapEditorStore.setCurrentPathSegments([
          {
            id: generateMessageId(),
            hyperlaneId: '', // Will be set when saving
            mapId: map.id,
            order: 0,
            startX: clickX,
            startY: clickY,
            endX: clickX, // Will be updated on next click
            endY: clickY,
            startLandmarkId,
            endLandmarkId: null,
          },
        ])
        mapEditorStore.setIsCreatingPath(true)
        mapEditorStore.setPathPreviewEnd({ x: clickX, y: clickY })
      })

      // Show initial preview (will update on mouse move)
      hyperlaneManager.showPreviewSegment(clickX, clickY, clickX, clickY)
    } else {
      // Continue or end the hyperlane
      const segments = mapEditorStore.currentPathSegments
      if (segments.length === 0) return

      const lastSegment = segments[segments.length - 1]

      // If clicking on a landmark or junction, end the hyperlane
      if (nearbyLandmark) {
        console.log(`Ending hyperlane at landmark: ${nearbyLandmark.name || 'junction'}`)

        // Update the last segment's end point
        const updatedSegments = [...segments]
        updatedSegments[updatedSegments.length - 1] = {
          ...lastSegment,
          endX: clickX,
          endY: clickY,
          endLandmarkId: nearbyLandmark.id,
        }

        // Save the hyperlane
        saveHyperlane(updatedSegments)

        // Reset state atomically
        batch(() => {
          mapEditorStore.setIsCreatingPath(false)
          mapEditorStore.setCurrentPathSegments([])
          mapEditorStore.setPathPreviewEnd(null)
        })
        hyperlaneManager.hidePreviewSegment()
        return
      }

      // Clicking in empty space - add a junction and continue
      console.log('Adding segment to hyperlane at', clickX, clickY)

      // Create a junction at the click position
      const junction = mapsStore.addLandmark(map.id, {
        x: clickX,
        y: clickY,
        name: getNextJunctionName(),
        description: '',
        type: 'junction',
        color: '#ffffff',
        size: 'small',
        properties: {},
      })
      updateLandmarks()

      // Update the last segment's end point
      const updatedSegments = [...segments]
      updatedSegments[updatedSegments.length - 1] = {
        ...lastSegment,
        endX: clickX,
        endY: clickY,
        endLandmarkId: junction.id,
      }

      // Add a new segment starting from this junction
      updatedSegments.push({
        id: generateMessageId(),
        hyperlaneId: '', // Will be set when saving
        mapId: map.id,
        order: segments.length,
        startX: clickX,
        startY: clickY,
        endX: clickX, // Will be updated on next click
        endY: clickY,
        startLandmarkId: junction.id,
        endLandmarkId: null,
      })

      // Use batch() to update signals atomically
      batch(() => {
        mapEditorStore.setCurrentPathSegments(updatedSegments)
        mapEditorStore.setPathPreviewEnd({ x: clickX, y: clickY })
      })

      // Show initial preview from new junction (will update on mouse move)
      hyperlaneManager.showPreviewSegment(clickX, clickY, clickX, clickY)
    }
  }

  // Save the completed hyperlane
  const saveHyperlane = (segments: HyperlaneSegment[]) => {
    const map = mapsStore.selectedMap
    if (!map) return

    console.log(`Saving hyperlane with ${segments.length} segment(s)`)

    mapsStore.addHyperlane(map.id, {
      speedMultiplier: 10.0, // Default 10x speed
      segments,
    })

    // Refresh hyperlanes to show the new one
    if (map.hyperlanes) {
      hyperlaneManager.refreshAllHyperlanes(map.hyperlanes)
    }
  }

  // Use the map interactions hook
  // Note: Hook now reads isEditing, isAddingNew, mapSelected, lastUsedType,
  // creationMode, paintModeEnabled, selectedPaintFaction from stores directly
  const mapInteractions = useMapInteractions({
    viewport,
    containers,
    mapSprite,
    canvasContainer,
    isShiftHeld,
    onPaintClick: (screenX, screenY, faction) => applyAllegianceToBrush(screenX, screenY, faction),
    onMapClick: (position) => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      const mode = mapEditorStore.creationMode

      // In select mode, clicking empty map clears all selections
      if (mode === 'select') {
        clearSelection()
        mapEditorStore.cancelEditing()
        return
      }

      // Deselect fleet for movement if clicking on empty map (not in pawn creation mode)
      if (mode !== 'pawn' && mapEditorStore.selectedFleetForMovement) {
        mapEditorStore.setSelectedFleetForMovement(null)
        // Refresh fleets to remove selection indicator
        const map = mapsStore.selectedMap
        if (map?.fleets) {
          fleetManager.refreshAllFleets(map.fleets)
          fleetManager.drawAllFleetPaths(map.fleets)
        }
      }

      // Clear hyperlane selection when clicking on empty space in path mode
      if (mode === 'path' && selectedHyperlane()) {
        setSelectedHyperlane(null)
        mapEditorStore.cancelEditing()
        // Refresh hyperlanes to remove selection highlight
        const map = mapsStore.selectedMap
        if (map?.hyperlanes) {
          hyperlaneManager.refreshAllHyperlanes(map.hyperlanes)
        }
      }

      if (mode === 'pawn') {
        // Pawn creation mode
        if (isAddingFleet()) {
          // If already adding a fleet, reposition or close
          const sprite = mapSprite()
          const vp = viewport()

          if (sprite && vp) {
            const currentWorldX = mapEditorStore.newPawnPos.x * sprite.width
            const currentWorldY = mapEditorStore.newPawnPos.y * sprite.height
            const currentScreen = vp.toScreen(currentWorldX, currentWorldY)

            const dx = position.x - currentScreen.x
            const dy = position.y - currentScreen.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance > 30) {
              setIsAddingFleet(false)
              mapEditorStore.cancelEditing()
              setSelectedFleet(null)
              return
            }
          }

          // Reposition
          mapEditorStore.setNewPawnPos({ x: position.normalizedX, y: position.normalizedY })
          const actualHeight = popupElement?.offsetHeight
          setPopupPosition(calculateSafePopupPosition(position.x, position.y, isTouchDevice, actualHeight))
          return
        }

        // Start adding a new fleet
        mapEditorStore.setNewPawnPos({ x: position.normalizedX, y: position.normalizedY })
        mapEditorStore.initEditForNewPawn()
        mapEditorStore.setEditColor('#00ff00') // Use green for fleets
        setIsAddingFleet(true)
        setSelectedFleet(null)
        setSelectedLandmark(null)

        // Position popup
        if (isTouchDevice) {
          setPopupPosition(calculateSafePopupPosition(position.x, position.y, true))
        } else {
          setPopupPosition(calculateSafePopupPosition(position.x + 80, position.y - 12, false))
        }
      } else if (mode === 'landmark') {
        // Landmark creation mode
        if (isAddingNew()) {
          const sprite = mapSprite()
          const vp = viewport()

          if (sprite && vp) {
            const currentWorldX = mapEditorStore.newLandmarkPos.x * sprite.width
            const currentWorldY = mapEditorStore.newLandmarkPos.y * sprite.height
            const currentScreen = vp.toScreen(currentWorldX, currentWorldY)

            const dx = position.x - currentScreen.x
            const dy = position.y - currentScreen.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance > 30) {
              setIsAddingNew(false)
              mapEditorStore.cancelEditing()
              setSelectedLandmark(null)
              mapInteractions.hidePreview()
              return
            }
          }

          mapEditorStore.setNewLandmarkPos({ x: position.normalizedX, y: position.normalizedY })
          mapInteractions.updatePreview(
            { x: position.normalizedX, y: position.normalizedY },
            mapEditorStore.editColor,
            mapEditorStore.editSize,
            mapEditorStore.editType,
            'landmark',
          )
          const actualHeight = popupElement?.offsetHeight
          const isMobile = isTouchDevice
          setPopupPosition(calculateSafePopupPosition(position.x, position.y, isMobile, actualHeight))
          return
        }

        // Start adding a new landmark
        mapEditorStore.setNewLandmarkPos({ x: position.normalizedX, y: position.normalizedY })
        mapEditorStore.initEditForNewLandmark()
        setIsAddingNew(true)
        setSelectedLandmark(null)
        setSelectedFleet(null)

        // Show preview sprite
        mapInteractions.updatePreview(
          { x: position.normalizedX, y: position.normalizedY },
          mapEditorStore.lastUsedColor,
          mapEditorStore.lastUsedSize,
          mapEditorStore.lastUsedType,
          'landmark',
        )

        // Position popup
        const markerRadius = 12
        if (isTouchDevice) {
          setPopupPosition(calculateSafePopupPosition(position.x, position.y, true))
        } else {
          setPopupPosition(calculateSafePopupPosition(position.x + markerRadius + 80, position.y - markerRadius, false))
        }
      }
    },
    onMapRightClick: (position) => {
      const map = mapsStore.selectedMap
      if (!map) return

      // Check if in hyperlane mode
      if (mapEditorStore.creationMode === 'path') {
        handleHyperlaneRightClick(position)
        return
      }

      // Check if a fleet is selected for movement
      const fleet = mapEditorStore.selectedFleetForMovement
      if (!fleet) {
        console.log('No fleet selected for movement')
        return
      }

      // Check for landmark snapping - if clicking near a landmark, snap to its center
      let targetX = position.normalizedX
      let targetY = position.normalizedY
      const snapRadius = 30 // pixels

      for (const landmark of map.landmarks) {
        const sprite = mapSprite()
        const vp = viewport()
        if (!sprite || !vp) continue

        const landmarkWorldX = landmark.x * sprite.width
        const landmarkWorldY = landmark.y * sprite.height
        const landmarkScreen = vp.toScreen(landmarkWorldX, landmarkWorldY)

        const dx = position.x - landmarkScreen.x
        const dy = position.y - landmarkScreen.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance <= snapRadius) {
          // Snap to landmark center
          targetX = landmark.x
          targetY = landmark.y
          console.log(`Snapped to landmark: ${landmark.name}`)
          break
        }
      }

      // Use pathfinding to create optimal fleet movements
      // (validates shift-hold chaining and overlapping movements internally)
      createFleetMovementsFromPath({
        fleet,
        targetX,
        targetY,
        currentStoryTime: currentStoryTime(),
        isShiftHeld: isShiftHeld(),
        map,
        currentStoryStore,
        mapsStore,
      })

      // Refresh fleets to show the new path
      if (map.fleets && map.fleets.length > 0) {
        fleetManager.refreshAllFleets(map.fleets)
        fleetManager.drawAllFleetPaths(map.fleets)
      }
    },
  })

  // Get landmarks with colors for overlay
  const getLandmarksWithColors = (): ColoredLandmark[] => {
    const sprite = mapSprite()
    if (!sprite || !mapsStore.selectedMap) return []

    const landmarksWithColors: ColoredLandmark[] = []

    mapsStore.selectedMap.landmarks.forEach((landmark) => {
      const borderColor = evaluateLandmarkBorderColor(landmark.name)
      if (borderColor && borderColor !== '') {
        const hexColor = parseColorToHex(borderColor)
        landmarksWithColors.push({
          x: landmark.x * sprite.width,
          y: landmark.y * sprite.height,
          color: hexColor,
          name: landmark.name,
        })
      }
    })

    return landmarksWithColors
  }

  // Wrapper functions for voronoi rendering (use imported utilities)
  const renderStandardVoronoi = (landmarksWithColors: ColoredLandmark[]) => {
    const voronoiContainer = containers().voronoi
    const sprite = mapSprite()
    if (!voronoiContainer || !sprite) return

    drawStandardVoronoi(voronoiContainer, landmarksWithColors, sprite.width, sprite.height)
  }

  const renderDistanceField = (landmarksWithColors: ColoredLandmark[]) => {
    const voronoiContainer = containers().voronoi
    const sprite = mapSprite()
    if (!voronoiContainer || !sprite) return

    // Cancel any existing animation
    cancelAnimation(distanceFieldAnimation())

    // Start new rendering and store the handle
    const handle = drawDistanceField(voronoiContainer, landmarksWithColors, sprite.width, sprite.height)
    setDistanceFieldAnimation(handle)
  }

  const renderBlurredVoronoi = (landmarksWithColors: ColoredLandmark[]) => {
    const voronoiContainer = containers().voronoi
    const sprite = mapSprite()
    if (!voronoiContainer || !sprite) return

    drawBlurredVoronoi(voronoiContainer, landmarksWithColors, sprite.width, sprite.height)
  }

  // Update overlay based on selected method
  const updateVoronoiOverlay = () => {
    const voronoiContainer = containers().voronoi
    if (!voronoiContainer || !mapSprite || !mapsStore.selectedMap) return

    // Cancel any progressive rendering in progress
    cancelAnimation(distanceFieldAnimation())
    setDistanceFieldAnimation(null)

    // Clear existing overlay and filters
    voronoiContainer.removeChildren()
    voronoiContainer.filters = []

    // Only draw if overlay is enabled
    if (!mapEditorStore.showFactionOverlay) return

    const landmarksWithColors = getLandmarksWithColors()

    // Need at least 1 point for metaballs, 2 for Voronoi
    if (landmarksWithColors.length === 0) return

    switch (mapEditorStore.overlayMethod) {
      case 'voronoi':
        if (landmarksWithColors.length >= 2) {
          renderStandardVoronoi(landmarksWithColors)
        }
        break
      case 'metaball':
        renderDistanceField(landmarksWithColors)
        break
      case 'blurred':
        if (landmarksWithColors.length >= 2) {
          renderBlurredVoronoi(landmarksWithColors)
        }
        break
      case 'noise':
        // TODO: Implement noise-distorted Voronoi
        if (landmarksWithColors.length >= 2) {
          renderStandardVoronoi(landmarksWithColors)
        }
        break
    }
  }

  // Plain function to render all landmarks and fleets (no reactivity)
  const renderAllLandmarks = () => {
    const map = mapsStore.selectedMap
    const sprite = mapSprite()

    if (!map || !sprite) return

    landmarkManager.refreshAllLandmarks(map.landmarks)

    // Also render fleets if they exist
    if (map.fleets && map.fleets.length > 0) {
      fleetManager.refreshAllFleets(map.fleets)
      fleetManager.drawAllFleetPaths(map.fleets)
    }

    // Render hyperlanes if they exist
    if (map.hyperlanes && map.hyperlanes.length > 0) {
      hyperlaneManager.refreshAllHyperlanes(map.hyperlanes)
    }

    updateVoronoiOverlay()

    // Trigger PIXI render after scene updates
    renderPixi()
  }

  // Plain function to update landmarks incrementally (no reactivity)
  const updateLandmarks = () => {
    const map = mapsStore.selectedMap
    const sprite = mapSprite()
    const landmarkContainer = containers().landmark

    if (!map || !sprite || !landmarkContainer) return

    const existingSprites = landmarkContainer.children as LandmarkSprite[]
    const existingLandmarksMap = new Map<string, LandmarkSprite>()

    for (const existingSprite of existingSprites) {
      if (existingSprite.landmarkData) {
        existingLandmarksMap.set(existingSprite.landmarkData.id, existingSprite)
      }
    }

    // Track which landmarks we've seen
    const seenLandmarkIds = new Set<string>()

    // Update or add landmarks
    for (const landmark of map.landmarks) {
      seenLandmarkIds.add(landmark.id)
      landmarkManager.updateLandmark(landmark)
    }

    // Remove landmarks that no longer exist
    for (const id of existingLandmarksMap.keys()) {
      if (!seenLandmarkIds.has(id)) {
        landmarkManager.removeLandmark(id)
      }
    }

    updateVoronoiOverlay()

    // Trigger PIXI render after scene updates
    renderPixi()
  }

  // Wrapper to load map using the hook
  const loadMap = async (imageData: string) => {
    const vp = viewport()
    if (!vp) return

    await loadMapImage(
      imageData,
      vp,
      containers(),
      () => {
        // Load landmarks after map is loaded
        renderAllLandmarks()
      },
      () => {
        // Setup interactions after map is loaded
        mapInteractions.setupInteractions()
      },
    )

    // Trigger render after map is loaded
    renderPixi()
  }

  // Measure popup and update position when it's rendered or content changes (for fleets/hyperlanes)
  createEffect(() => {
    const vp = viewport()
    const sprite = mapSprite()
    const fleet = selectedFleet()
    const hyperlane = selectedHyperlane()

    // Only handle fleet and hyperlane popups (landmarks use inline detail now)
    if (popupElement && (fleet || hyperlane || isAddingFleet()) && vp && sprite) {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      const actualHeight = popupElement.offsetHeight

      let worldX: number
      let worldY: number
      if (isAddingFleet()) {
        const pos = mapEditorStore.newLandmarkPos
        worldX = pos.x * sprite.width
        worldY = pos.y * sprite.height
      } else if (fleet) {
        worldX = fleet.defaultX * sprite.width
        worldY = fleet.defaultY * sprite.height
      } else if (hyperlane && hyperlane.segments.length > 0) {
        const seg = hyperlane.segments[0]
        worldX = seg.startX * sprite.width
        worldY = seg.startY * sprite.height
      } else {
        return
      }

      const screenPos = vp.toScreen(worldX, worldY)
      const baseX = screenPos.x + (canvasContainer()?.offsetLeft || 0)
      const baseY = screenPos.y + (canvasContainer()?.offsetTop || 0)
      const newPosition = calculateSafePopupPosition(baseX, baseY, isTouchDevice, actualHeight)

      const currentPos = popupPosition()
      if (Math.abs(newPosition.x - currentPos.x) > 1 || Math.abs(newPosition.y - currentPos.y) > 1) {
        setPopupPosition(newPosition)
      }
    }
  })

  // Show placement indicator when adding new landmark
  createEffect(() => {
    if (isAddingNew()) {
      mapInteractions.updatePreview(mapEditorStore.newLandmarkPos, mapEditorStore.editColor, mapEditorStore.editSize, mapEditorStore.editType)
    } else {
      mapInteractions.hidePreview()
    }
  })

  // Handle file selection
  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (file?.type.startsWith('image/')) {
      setSelectedFile(file)
      setSelectedFileName(file.name)
    }
  }

  // Add new map
  const handleAddMap = async () => {
    const name = newMapName().trim()
    const borderColor = newMapBorderColor().trim()
    const file = selectedFile()

    if (!name || !file) return

    // Convert file to base64
    const reader = new FileReader()
    reader.onload = async (e) => {
      const imageData = e.target?.result as string
      await mapsStore.addMap(name, imageData, borderColor || undefined)
      setNewMapName('')
      setNewMapBorderColor('')
      setSelectedFile(null)
      setSelectedFileName('')
    }
    reader.readAsDataURL(file)
  }

  // Handle map selection from ListDetailPanel
  const handleMapSelectionChange = (id: string | null) => {
    if (id && id !== 'new') {
      mapsStore.selectMap(id)
    }
  }

  // Handle delete map
  const handleDeleteMap = async () => {
    if (mapsStore.selectedMapId) {
      if (confirm('Are you sure you want to delete this map?')) {
        await mapsStore.deleteMap(mapsStore.selectedMapId)
        panelRef?.clearSelection()
      }
    }
  }

  // Handle save border color
  const handleSaveBorderColor = async () => {
    if (mapsStore.selectedMapId) {
      await mapsStore.updateMap(mapsStore.selectedMapId, {
        borderColor: editMapBorderColorValue() || undefined,
      })
      setEditingMapBorderColor(false)
    }
  }

  // Start editing border color
  const startEditingBorderColor = () => {
    if (mapsStore.selectedMap) {
      setEditMapBorderColorValue(mapsStore.selectedMap.borderColor || '')
      setEditingMapBorderColor(true)
    }
  }

  // Calculate safe popup position that stays within viewport
  const calculateSafePopupPosition = (x: number, y: number, preferVertical = false, actualHeight?: number) => {
    const popupWidth = 280 // Fixed width from CSS
    const popupHeight = actualHeight || 400 // Use actual height if available, else max from CSS
    const padding = 10 // Minimum distance from viewport edges

    // Get viewport dimensions
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let finalX = x
    let finalY = y

    if (preferVertical) {
      // Mobile: Always stick to top of viewport

      // Center horizontally on the point
      finalX = x - popupWidth / 2

      // Always position at top
      finalY = padding

      // Ensure X stays within bounds (centered but adjusted if needed)
      if (finalX < padding) {
        finalX = padding
      } else if (finalX + popupWidth + padding > viewportWidth) {
        finalX = viewportWidth - popupWidth - padding
      }
    } else {
      // Desktop: Prioritize horizontal positioning (left/right)

      // Calculate initial position (offset to the right)
      finalX = x + 80
      finalY = y - 10

      // Adjust X position if popup would go off right edge
      if (finalX + popupWidth + padding > viewportWidth) {
        // Try positioning to the left of the point instead
        finalX = x - popupWidth - 20
        // If still off screen, just position at right edge
        if (finalX < padding) {
          finalX = viewportWidth - popupWidth - padding
        }
      }

      // Ensure X doesn't go off left edge
      if (finalX < padding) {
        finalX = padding
      }

      // Adjust Y position if popup would go off bottom edge
      if (finalY + popupHeight + padding > viewportHeight) {
        // Try positioning above the point instead
        finalY = y - popupHeight - 20
        // If still off screen, just position at bottom edge
        if (finalY < padding) {
          finalY = viewportHeight - popupHeight - padding
        }
      }

      // Ensure Y doesn't go off top edge
      if (finalY < padding) {
        finalY = padding
      }
    }

    return { x: finalX, y: finalY }
  }

  // Handle mode change from toolbar
  const handleModeChange = (mode: 'select' | 'landmark' | 'pawn' | 'path') => {
    // Clear all mode-specific state when switching modes
    if (mode !== 'landmark') {
      setIsAddingNew(false)
      setSelectedLandmark(null)
      mapInteractions.hidePreview()
    }
    if (mode !== 'pawn') {
      setIsAddingFleet(false)
      setSelectedFleet(null)
    }
    if (mode !== 'path') {
      mapEditorStore.setIsCreatingPath(false)
      mapEditorStore.setCurrentPathSegments([])
      mapEditorStore.setPathPreviewEnd(null)
      hyperlaneManager.hidePreviewSegment()
    }
  }

  // Batch apply allegiance to all landmarks within brush radius
  const applyAllegianceToBrush = async (screenX: number, screenY: number, faction: string | null) => {
    const map = mapsStore.selectedMap
    const storyTime = currentStoryTime()
    const storyId = currentStoryStore.id
    const sprite = mapSprite()
    const vp = viewport()

    if (!map || storyTime === null || !storyId || !sprite || !vp) return

    // Find all landmarks within 100px screen radius
    const affectedLandmarks: Landmark[] = []
    const brushRadiusPx = 100

    for (const landmark of map.landmarks) {
      // Convert landmark position to screen coordinates
      const worldX = landmark.x * sprite.width
      const worldY = landmark.y * sprite.height
      const landmarkScreen = vp.toScreen(worldX, worldY)

      // Calculate distance
      const dx = landmarkScreen.x - screenX
      const dy = landmarkScreen.y - screenY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance <= brushRadiusPx) {
        affectedLandmarks.push(landmark)
      }
    }

    if (affectedLandmarks.length === 0) return

    // Batch update all affected landmarks
    for (const landmark of affectedLandmarks) {
      await landmarkStatesStore.setLandmarkState(storyId, map.id, landmark.id, storyTime, 'allegiance', faction)
    }

    // Reload accumulated states
    await landmarkStatesStore.loadAccumulatedStates(storyId, storyTime)

    // Update all affected landmark sprites
    for (const landmark of affectedLandmarks) {
      landmarkManager.updateLandmark(landmark, true)
    }

    // Update voronoi overlay once after all landmarks (if enabled)
    if (mapEditorStore.showFactionOverlay) {
      updateVoronoiOverlay()
    }

    // Trigger render after updates
    renderPixi()
  }

  // Fetch landmark info from web search
  const fetchLandmarkInfo = async () => {
    const name = mapEditorStore.editName.trim()
    const type = mapEditorStore.editType
    if (!name || mapEditorStore.isFetchingLandmarkInfo) return

    // Only proceed if fields are empty
    const getProperty = (key: string) => (mapEditorStore.editProperties[key] as string) || ''
    const hasExistingInfo = getProperty('population') || getProperty('industry') || mapEditorStore.editDescription || getProperty('planetaryBodies')
    if (hasExistingInfo && !confirm('This will overwrite existing information. Continue?')) {
      return
    }

    mapEditorStore.setIsFetchingLandmarkInfo(true)

    try {
      const info = await searchLandmarkInfo(name, type)

      // Only update empty fields by default, unless user confirmed overwrite
      if (!getProperty('population') || hasExistingInfo) {
        mapEditorStore.setEditProperty('population', info.population || getProperty('population'))
      }
      if (!getProperty('industry') || hasExistingInfo) {
        mapEditorStore.setEditProperty('industry', info.industry || getProperty('industry'))
      }
      if (!mapEditorStore.editDescription || hasExistingInfo) {
        mapEditorStore.setEditDescription(info.description || mapEditorStore.editDescription)
      }
      if (!getProperty('planetaryBodies') || hasExistingInfo) {
        mapEditorStore.setEditProperty('planetaryBodies', info.planetaryBodies || getProperty('planetaryBodies'))
      }

      console.log('Fetched landmark info:', info)
    } catch (error) {
      console.error('Failed to fetch landmark info:', error)
      alert('Failed to fetch landmark information. Please check your Anthropic API key and try again.')
    } finally {
      mapEditorStore.setIsFetchingLandmarkInfo(false)
    }
  }

  // Initialize Pixi when canvas container is available and map is selected
  createEffect(
    on(
      () => [app(), mapsStore.selectedMap, canvasContainer()] as const,
      ([pixiApp, map, container]) => {
        if (container && map && !pixiApp) {
          initialize()
        }
      },
    ),
  )

  // Register callbacks with mapEditorStore when PIXI is ready
  createEffect(() => {
    if (isReady()) {
      mapEditorStore.registerCallbacks({
        onLandmarksChanged: () => {
          updateLandmarks()
        },
        onFleetsChanged: () => {
          const map = mapsStore.selectedMap
          if (map?.fleets) {
            fleetManager.refreshAllFleets(map.fleets)
            fleetManager.drawAllFleetPaths(map.fleets)
          }
        },
        onPathsChanged: () => {
          const map = mapsStore.selectedMap
          if (map?.hyperlanes) {
            hyperlaneManager.refreshAllHyperlanes(map.hyperlanes)
          }
        },
        onFocusLandmark: (landmark) => {
          // Handle viewport animation when focusing on a landmark
          const vp = viewport()
          const sprite = mapSprite()
          if (!vp || !sprite) return

          // Calculate world position from normalized coordinates
          const worldX = landmark.x * sprite.width
          const worldY = landmark.y * sprite.height

          // Move to the landmark position with animation
          const vpAny = vp as any
          if (vpAny.animate) {
            vpAny.animate({
              position: { x: worldX, y: worldY },
              scale: Math.max(1, vp.scale.x),
              time: 500,
              ease: 'easeInOutSine',
            })
          } else {
            vpAny.moveCenter(worldX, worldY)
          }

          // Update popup position
          const screenPos = vp.toScreen(worldX, worldY)
          const baseX = screenPos.x + (canvasContainer()?.offsetLeft || 0)
          const baseY = screenPos.y + (canvasContainer()?.offsetTop || 0)
          const isMobile = window.innerWidth < 768
          setPopupPosition(calculateSafePopupPosition(baseX, baseY, isMobile))
        },
        onAllegianceChanged: (landmark) => {
          // Update the specific landmark's visual (border color)
          landmarkManager.updateLandmark(landmark, true)

          // Update voronoi overlay if enabled
          if (mapEditorStore.showFactionOverlay) {
            updateVoronoiOverlay()
          }

          // Trigger PIXI render
          renderPixi()
        },
      })
    }
  })

  // Handle map selection change (wait for PIXI to be ready)
  // Track imageData explicitly so the effect re-runs when it's loaded
  createEffect(
    on(
      () => [mapsStore.selectedMap?.id, mapsStore.selectedMap?.imageData, isReady()] as const,
      ([mapId, imageData, ready]) => {
        if (mapId && imageData && ready) {
          loadMap(imageData)
        }
      },
    ),
  )

  // Load accumulated landmark states when timeline changes, then re-render
  createEffect(
    on(
      () => [currentStoryTime(), currentStoryStore.id] as const,
      ([storyTime, storyId]) => {
        if (storyTime !== null && storyId && !isRendering()) {
          setIsRendering(true)
          landmarkStatesStore
            .loadAccumulatedStates(storyId, storyTime)
            .then(() => {
              renderAllLandmarks()
              setIsRendering(false)
            })
            .catch(() => {
              setIsRendering(false)
            })
        }
      },
    ),
  )

  // Direct pointerdown handler for fleet creation mode
  createEffect(() => {
    const vp = viewport()
    if (!vp) return

    let pointerDownPos: { x: number; y: number } | null = null
    let isDragging = false

    const handlePointerDown = (e: PIXI.FederatedPointerEvent) => {
      // Only handle in fleet mode and for left-clicks (button 0)
      if (mapEditorStore.creationMode !== 'pawn' || e.button !== 0) return

      // Record the pointer down position
      pointerDownPos = { x: e.global.x, y: e.global.y }
      isDragging = false
    }

    const handlePointerMove = (e: PIXI.FederatedPointerEvent) => {
      if (!pointerDownPos) return

      // Calculate distance moved
      const dx = e.global.x - pointerDownPos.x
      const dy = e.global.y - pointerDownPos.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      // If moved more than 5 pixels, consider it a drag
      if (distance > 5) {
        isDragging = true
      }
    }

    const handlePointerUp = (e: PIXI.FederatedPointerEvent) => {
      // Only handle in fleet mode and for left-clicks (button 0)
      if (mapEditorStore.creationMode !== 'pawn' || e.button !== 0 || !pointerDownPos) {
        pointerDownPos = null
        isDragging = false
        return
      }

      // If it was a drag, don't process as a click
      if (isDragging) {
        pointerDownPos = null
        isDragging = false
        return
      }

      const sprite = mapSprite()
      if (!sprite) return

      // Get world position
      const worldPos = vp.toWorld(e.global)

      // Convert to normalized coordinates
      const normalizedX = worldPos.x / sprite.width
      const normalizedY = worldPos.y / sprite.height

      // Check bounds
      if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
        pointerDownPos = null
        return
      }

      // Check if a fleet is already selected for movement
      if (mapEditorStore.selectedFleetForMovement) {
        // Deselect the fleet instead of creating a new one
        mapEditorStore.setSelectedFleetForMovement(null)
        const map = mapsStore.selectedMap
        if (map?.fleets) {
          fleetManager.refreshAllFleets(map.fleets)
          fleetManager.drawAllFleetPaths(map.fleets)
        }
        pointerDownPos = null
        return
      }

      // Get screen position
      const screenPos = vp.toScreen(worldPos)
      const baseX = screenPos.x + (canvasContainer()?.offsetLeft || 0)
      const baseY = screenPos.y + (canvasContainer()?.offsetTop || 0)

      // Check for nearby landmark and snap
      const nearbyLandmark = findNearbyLandmark({
        x: baseX,
        y: baseY,
        normalizedX,
        normalizedY,
      })

      const finalX = nearbyLandmark ? nearbyLandmark.x : normalizedX
      const finalY = nearbyLandmark ? nearbyLandmark.y : normalizedY

      // Start fleet creation dialog
      mapEditorStore.setNewPawnPos({ x: finalX, y: finalY })
      mapEditorStore.initEditForNewPawn()
      mapEditorStore.setEditColor('#00ff00') // Use green for fleets
      setIsAddingFleet(true)
      setSelectedFleet(null)
      setSelectedLandmark(null)

      // Position popup
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      if (isTouchDevice) {
        setPopupPosition(calculateSafePopupPosition(baseX, baseY, true))
      } else {
        setPopupPosition(calculateSafePopupPosition(baseX + 80, baseY - 12, false))
      }

      pointerDownPos = null
    }

    vp.on('pointerdown', handlePointerDown)
    vp.on('pointermove', handlePointerMove)
    vp.on('pointerup', handlePointerUp)

    return () => {
      vp.off('pointerdown', handlePointerDown)
      vp.off('pointermove', handlePointerMove)
      vp.off('pointerup', handlePointerUp)
    }
  })

  // Update fleet positions when story time changes
  createEffect(
    on(
      () => currentStoryTime(),
      () => {
        const map = mapsStore.selectedMap
        if (map?.fleets && map.fleets.length > 0) {
          fleetManager.updateFleetPositions(map.fleets)
        }
      },
    ),
  )

  // Refresh fleets when selection changes (to update blue circle indicator)
  createEffect(
    on(
      () => mapEditorStore.selectedFleetForMovement?.id,
      () => {
        const map = mapsStore.selectedMap
        if (map?.fleets && map.fleets.length > 0) {
          fleetManager.refreshAllFleets(map.fleets)
          fleetManager.drawAllFleetPaths(map.fleets)
        }
      },
    ),
  )

  // Re-render overlay when toggle or method changes
  createEffect(
    on(
      () => [mapEditorStore.showFactionOverlay, mapEditorStore.overlayMethod] as const,
      () => {
        updateVoronoiOverlay()
        renderPixi()
      },
      { defer: true },
    ),
  )

  // Toggle landmark and hyperlane interactivity based on creation mode
  createEffect(() => {
    const isSelectMode = mapEditorStore.creationMode === 'select'
    landmarkManager.setInteractive(isSelectMode)
    hyperlaneManager.setInteractive(isSelectMode)
  })

  // Shift key detection for paint mode and Escape key for canceling operations
  createEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !e.repeat) {
        setIsShiftHeld(true)
      }

      // Cancel hyperlane creation with Escape
      if (e.key === 'Escape' && mapEditorStore.isCreatingPath) {
        mapEditorStore.setIsCreatingPath(false)
        mapEditorStore.setCurrentPathSegments([])
        mapEditorStore.setPathPreviewEnd(null)
        hyperlaneManager.hidePreviewSegment()
        console.log('Hyperlane creation canceled')
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftHeld(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      setIsShiftHeld(false)
    }
  })

  // Brush visual preview effect
  createEffect(() => {
    const brushSprite = containers().brush
    const vp = viewport()
    const enabled = mapEditorStore.paintModeEnabled
    const container = canvasContainer()

    if (!brushSprite || !vp || !container) return

    if (enabled) {
      // Draw the brush circle (100px radius, semi-transparent)
      const brushRadiusPx = 100
      brushSprite.clear()
      brushSprite.circle(0, 0, brushRadiusPx)
      brushSprite.fill({ color: 0xffffff, alpha: 0.2 })
      brushSprite.stroke({ color: 0xffffff, width: 2, alpha: 0.5 })

      // Add mouse move listener to update brush position
      const handleMouseMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect()
        const screenX = e.clientX - rect.left
        const screenY = e.clientY - rect.top

        // Convert screen to world coordinates
        const worldPos = vp.toWorld(screenX, screenY)
        brushSprite.position.set(worldPos.x, worldPos.y)
      }

      container.addEventListener('mousemove', handleMouseMove)
      brushSprite.visible = true

      // Cleanup function
      return () => {
        container.removeEventListener('mousemove', handleMouseMove)
        brushSprite.visible = false
      }
    }
    brushSprite.visible = false
  })

  // Hyperlane preview effect - show preview line when creating hyperlane
  createEffect(() => {
    const vp = viewport()
    const sprite = mapSprite()
    const previewEnd = mapEditorStore.pathPreviewEnd
    const creating = mapEditorStore.isCreatingPath
    const container = canvasContainer()

    if (!vp || !sprite || !container || !creating || !previewEnd) {
      hyperlaneManager.hidePreviewSegment()
      // Return empty cleanup to ensure previous event listener is removed
      return () => {}
    }

    const segments = mapEditorStore.currentPathSegments
    if (segments.length === 0) {
      hyperlaneManager.hidePreviewSegment()
      // Return empty cleanup to ensure previous event listener is removed
      return () => {}
    }

    const lastSegment = segments[segments.length - 1]

    // Add mouse move listener to update preview
    const handleMouseMove = (e: MouseEvent) => {
      // Don't show preview if not creating
      if (!mapEditorStore.isCreatingPath) return

      const rect = container.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top

      // Convert screen to world coordinates
      const worldPos = vp.toWorld(screenX, screenY)

      // Convert to normalized coordinates
      const normalizedX = worldPos.x / sprite.width
      const normalizedY = worldPos.y / sprite.height

      // Update preview segment from last point to mouse position
      hyperlaneManager.showPreviewSegment(lastSegment.startX, lastSegment.startY, normalizedX, normalizedY)
    }

    container.addEventListener('mousemove', handleMouseMove)

    // Cleanup function
    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
    }
  })

  // Path preview effect - show path preview when fleet is selected and mouse moves
  createEffect(() => {
    const fleet = mapEditorStore.selectedFleetForMovement
    const vp = viewport()
    const sprite = mapSprite()
    const container = canvasContainer()

    if (!fleet || !vp || !sprite || !container) {
      pathfinding.hidePathPreview()
      return () => {}
    }

    // Add mouse move listener to show path preview
    const handleMouseMove = (e: MouseEvent) => {
      const selectedFleet = mapEditorStore.selectedFleetForMovement
      if (!selectedFleet) return

      const rect = container.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top

      // Convert screen to world coordinates
      const worldPos = vp.toWorld(screenX, screenY)

      // Convert to normalized coordinates
      const normalizedX = worldPos.x / sprite.width
      const normalizedY = worldPos.y / sprite.height

      // Show path preview from fleet's current position to mouse position
      pathfinding.showPathPreview(selectedFleet, normalizedX, normalizedY)
    }

    container.addEventListener('mousemove', handleMouseMove)

    // Cleanup function
    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      pathfinding.hidePathPreview()
    }
  })

  // Update landmark scales when viewport zoom changes
  createEffect(() => {
    const vp = viewport()
    if (!vp) return

    const handleZoom = () => {
      const zoomLevel = vp.scale.x // x and y scale should be the same
      landmarkManager.updateLandmarkScales(zoomLevel)
    }

    // Call once initially
    handleZoom()

    // Listen for zoom changes
    vp.on('zoomed', handleZoom)

    return () => {
      vp.off('zoomed', handleZoom)
    }
  })

  onCleanup(() => {
    // Cancel any progressive rendering
    cancelAnimation(distanceFieldAnimation())
    // Unregister callbacks
    mapEditorStore.unregisterCallbacks()
  })

  return (
    <Show when={mapsStore.showMaps}>
      <ListDetailPanel<StoryMap>
        ref={(r) => (panelRef = r)}
        items={mapsStore.maps}
        class={styles.mapsPanel}
        onSelectionChange={handleMapSelectionChange}
        backIcon={<BsArrowLeft />}
        emptyStateMessage="Select a map or add a new one to get started"
        renderListItem={(map) => (
          <div class={styles.mapListItem}>
            <span class={styles.mapListItemName}>{map.name}</span>
            <span class={styles.mapListItemLandmarks}>
              {map.landmarks.length} landmark{map.landmarks.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        newItemTitle="Add New Map"
        renderNewForm={() => (
          <div class={styles.addMapForm}>
            <input
              type="text"
              class={styles.mapNameInput}
              value={newMapName()}
              onInput={(e) => setNewMapName(e.target.value)}
              placeholder="Map name"
            />

            <EJSCodeEditor
              value={newMapBorderColor()}
              onChange={setNewMapBorderColor}
              placeholder="Border color template (optional)"
              minHeight="60px"
            />

            <div class={styles.fileUpload}>
              <input
                type="file"
                id="map-file-input"
                class={styles.fileInput}
                accept="image/*"
                onChange={handleFileSelect}
              />
              <label for="map-file-input" class={styles.fileInputLabel}>
                {selectedFileName() || 'Choose map image...'}
              </label>
            </div>

            <div class={styles.addMapFormActions}>
              <button
                class={styles.addMapButton}
                onClick={handleAddMap}
                disabled={!newMapName().trim() || !selectedFile()}
              >
                <BsPlus /> Add Map
              </button>
              <button class={styles.cancelButton} onClick={() => panelRef?.clearSelection()}>
                Cancel
              </button>
            </div>
          </div>
        )}
        detailTitle={(map) => (
          <div class={styles.detailTitleContainer}>
            <span class={styles.detailTitleText}>{map.name}</span>
            <div class={styles.detailTitleActions}>
              <button
                class={styles.iconButton}
                onClick={startEditingBorderColor}
                title="Edit border color template"
              >
                <BsPencil />
              </button>
              <button
                class={`${styles.iconButton} ${styles.deleteButton}`}
                onClick={handleDeleteMap}
                title="Delete map"
              >
                <BsTrash />
              </button>
            </div>
          </div>
        )}
        renderDetail={(_map) => (
          <div class={styles.mapDetailContent}>
            {/* Loading Indicator */}
            <Show when={mapsStore.loadingMapId}>
              <div class={styles.loadingOverlay}>
                <div class={styles.loadingSpinner} />
                <span>Loading map...</span>
              </div>
            </Show>

            {/* Edit Border Color Form */}
            <Show when={editingMapBorderColor()}>
              <div class={styles.borderColorEditor}>
                <h4>Edit Border Color Template</h4>
                <EJSCodeEditor
                  value={editMapBorderColorValue()}
                  onChange={setEditMapBorderColorValue}
                  placeholder="Border color template"
                  minHeight="100px"
                />
                <div class={styles.borderColorActions}>
                  <button class={styles.addMapButton} onClick={handleSaveBorderColor}>
                    <BsCheck /> Save
                  </button>
                  <button class={styles.cancelButton} onClick={() => setEditingMapBorderColor(false)}>
                    <BsX /> Cancel
                  </button>
                </div>
              </div>
            </Show>

            {/* Map Timeline */}
            <MapTimeline />

            {/* Map Toolbar */}
            <MapToolbar onModeChange={handleModeChange} />

            {/* Path creation status */}
            <Show when={mapEditorStore.creationMode === 'path'}>
              <div class={styles.hyperlaneStatus}>Status: {hyperlaneCreationStatus()}</div>
            </Show>

            {/* Map Viewer Area */}
            <div class={styles.mapViewer}>
              <div class={styles.mapContainer}>
                <div
                  ref={setCanvasContainer}
                  class={styles.mapCanvas}
                />
              </div>

              <Show
                when={selectedHyperlane()}
                fallback={
                  <Show
                    when={selectedFleet() || isAddingFleet()}
                    fallback={
                      <Show
                        when={selectedLandmark() || isAddingNew()}
                        fallback={
                          <LandmarksList />
                        }
                      >
                        <LandmarkDetail
                          selectedLandmark={selectedLandmark}
                          quickColors={quickColors}
                          onBack={() => {
                            setSelectedLandmark(null)
                            setIsAddingNew(false)
                            mapEditorStore.cancelEditing()
                          }}
                          onFetchLandmarkInfo={fetchLandmarkInfo}
                        />
                      </Show>
                    }
                  >
                    <PawnDetail
                      selectedPawn={selectedFleet}
                      quickColors={quickColors}
                      onBack={() => {
                        setSelectedFleet(null)
                        setIsAddingFleet(false)
                        mapEditorStore.cancelEditing()
                      }}
                    />
                  </Show>
                }
              >
                <PathDetail
                  selectedPath={selectedHyperlane}
                  onBack={() => {
                    setSelectedHyperlane(null)
                    mapEditorStore.cancelEditing()
                  }}
                />
              </Show>
            </div>
          </div>
        )}
      />
    </Show>
  )
}
