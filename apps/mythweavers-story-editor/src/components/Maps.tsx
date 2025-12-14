import {
  Component,
  Show,
  createSignal,
  onCleanup,
  createEffect,
  createMemo,
  on,
  batch,
} from "solid-js";
import * as PIXI from "pixi.js";
import { mapsStore } from "../stores/mapsStore";
import { messagesStore } from "../stores/messagesStore";
import { nodeStore } from "../stores/nodeStore";
import { landmarkStatesStore } from "../stores/landmarkStatesStore";
import { Landmark, LandmarkIndustry, Fleet, Hyperlane, HyperlaneSegment } from "../types/core";
import { generateMessageId } from "../utils/id";
import { evaluateTemplate } from "../utils/scriptEngine";
import { currentStoryStore } from "../stores/currentStoryStore";
import { scriptDataStore } from "../stores/scriptDataStore";
import { searchLandmarkInfo } from "../utils/landmarkSearch";
import { FactionOverlayControls } from "./maps/FactionOverlayControls";
import { MapTimeline } from "./maps/MapTimeline";
import { LandmarksList } from "./maps/LandmarksList";
import { MapControls } from "./maps/MapControls";
import { LandmarkPopup } from "./maps/LandmarkPopup";
import { FleetPopup } from "./maps/FleetPopup";
import { HyperlanePopup } from "./maps/HyperlanePopup";
import { usePixiMap } from "../hooks/maps/usePixiMap";
import { useMapLoader } from "../hooks/maps/useMapLoader";
import { useLandmarkManager } from "../hooks/maps/useLandmarkManager";
import { useMapInteractions } from "../hooks/maps/useMapInteractions";
import { useFleetManager } from "../hooks/maps/useFleetManager";
import { useHyperlaneManager } from "../hooks/maps/useHyperlaneManager";
import { usePathfinding } from "../hooks/maps/usePathfinding";
import { LandmarkSprite } from "../utils/maps/landmarkRenderer";
import { parseColorToHex, ColoredLandmark } from "../utils/maps/colorUtils";
import {
  drawStandardVoronoi,
  drawDistanceField,
  drawBlurredVoronoi,
  cancelAnimation,
  AnimationHandle
} from "../utils/maps/voronoiRenderer";
import { getActiveMovement } from "../utils/fleetUtils";
import { createFleetMovementsFromPath } from "./maps/fleetMovementHandler";
import {
  getTimelineRange,
  getChapterAtStoryTime,
  getStoryTimeForMessage
} from "../utils/timelineUtils";
import styles from "./Maps.module.css";

export const Maps: Component = () => {
  let canvasContainer: HTMLDivElement | undefined;
  let popupElement: HTMLDivElement | undefined;

  // Use the PIXI map hook
  const pixiMap = usePixiMap(() => canvasContainer);
  const { app, viewport, containers, initialize, isReady } = pixiMap;

  // Use the map loader hook
  const mapLoader = useMapLoader();
  const { mapSprite, loadMap: loadMapImage } = mapLoader;

  const [newMapName, setNewMapName] = createSignal("");
  const [newMapBorderColor, setNewMapBorderColor] = createSignal("");
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [selectedFileName, setSelectedFileName] = createSignal("");
  const [showAddMap, setShowAddMap] = createSignal(false);
  const [editingBorderColor, setEditingBorderColor] = createSignal(false);
  const [editBorderColorValue, setEditBorderColorValue] = createSignal("");
  const [selectedLandmark, setSelectedLandmark] = createSignal<Landmark | null>(
    null,
  );
  const [selectedFleet, setSelectedFleet] = createSignal<Fleet | null>(null);
  const [selectedHyperlane, setSelectedHyperlane] = createSignal<Hyperlane | null>(null);
  const [popupPosition, setPopupPosition] = createSignal({ x: 0, y: 0 });
  const [isEditing, setIsEditing] = createSignal(false);
  const [isAddingFleet, setIsAddingFleet] = createSignal(false);
  const [editName, setEditName] = createSignal("");
  const [editDescription, setEditDescription] = createSignal("");
  const [editDesignation, setEditDesignation] = createSignal("");
  const [editHyperdriveRating, setEditHyperdriveRating] = createSignal("1.0");
  const [hyperdriveError, setHyperdriveError] = createSignal("");
  const [editSpeedMultiplier, setEditSpeedMultiplier] = createSignal("10.0");
  const [speedMultiplierError, setSpeedMultiplierError] = createSignal("");
  const [editColor, setEditColor] = createSignal("#3498db");
  const [editSize, setEditSize] = createSignal<"small" | "medium" | "large">(
    "medium",
  );
  const [editVariant, setEditVariant] = createSignal<"military" | "transport" | "scout">("military");
  const [editType, setEditType] = createSignal<"system" | "station" | "nebula" | "junction">("system");
  const [editPopulation, setEditPopulation] = createSignal("");
  const [editIndustry, setEditIndustry] = createSignal<LandmarkIndustry | "">("");
  const [editPlanetaryBodies, setEditPlanetaryBodies] = createSignal("");
  const [editRegion, setEditRegion] = createSignal("");
  const [editSector, setEditSector] = createSignal("");
  const [populationError, setPopulationError] = createSignal("");
  // Remember last used settings for new landmarks (with localStorage persistence)
  const [lastUsedColor, setLastUsedColor] = createSignal(
    localStorage.getItem('lastLandmarkColor') || "#3498db"
  );
  const [lastUsedSize, setLastUsedSize] = createSignal<"small" | "medium" | "large">(
    (localStorage.getItem('lastLandmarkSize') as "small" | "medium" | "large") || "medium"
  );
  const [lastUsedType, setLastUsedType] = createSignal<"system" | "station" | "nebula" | "junction">(
    (localStorage.getItem('lastLandmarkType') as "system" | "station" | "nebula" | "junction") || "system"
  );
  const [isSaving, setIsSaving] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);
  const [isDeletingMovement, setIsDeletingMovement] = createSignal(false);
  const [isAddingNew, setIsAddingNew] = createSignal(false);
  const [newLandmarkPos, setNewLandmarkPos] = createSignal({ x: 0, y: 0 });
  const [newFleetPos, setNewFleetPos] = createSignal({ x: 0, y: 0 });
  const [sortAscending, setSortAscending] = createSignal(true);
  const [pendingStoryTime, setPendingStoryTime] = createSignal<number | null>(null);
  const [showFactionOverlay, setShowFactionOverlay] = createSignal(false);
  const [overlayMethod, setOverlayMethod] = createSignal<'voronoi' | 'metaball' | 'blurred' | 'noise'>('voronoi');
  const [paintModeEnabled, setPaintModeEnabled] = createSignal(false);
  const [selectedPaintFaction, setSelectedPaintFaction] = createSignal<string | null>(null);
  const [isShiftHeld, setIsShiftHeld] = createSignal(false);
  const [isSavingAllegiance, setIsSavingAllegiance] = createSignal(false);
  const [isFetchingLandmarkInfo, setIsFetchingLandmarkInfo] = createSignal(false);
  const [distanceFieldAnimation, setDistanceFieldAnimation] = createSignal<AnimationHandle | null>(null);
  const [isRendering, setIsRendering] = createSignal(false);
  const [creationMode, setCreationMode] = createSignal<"landmark" | "fleet" | "hyperlane">("landmark");
  const [selectedFleetForMovement, setSelectedFleetForMovement] = createSignal<Fleet | null>(null);

  // Hyperlane creation state
  const [isCreatingHyperlane, setIsCreatingHyperlane] = createSignal(false);
  const [currentHyperlaneSegments, setCurrentHyperlaneSegments] = createSignal<HyperlaneSegment[]>([]);
  const [hyperlanePreviewEnd, setHyperlanePreviewEnd] = createSignal<{ x: number, y: number } | null>(null);

  let timelineDebounceTimer: number | null = null;

  // Parse population string to number (removes commas, spaces, etc.)
  const parsePopulation = (value: string): number | null => {
    if (!value.trim()) return null;
    // Remove all non-digit characters except decimal point
    const cleaned = value.replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  // Format number with thousand separators
  const formatPopulation = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Validate population input
  const validatePopulation = (value: string): boolean => {
    if (!value.trim()) return true; // Empty is valid (optional field)
    const parsed = parsePopulation(value);
    return parsed !== null && parsed >= 0;
  };

  // Handle population input change
  const handlePopulationInput = (value: string) => {
    setEditPopulation(value);
    if (value.trim() && !validatePopulation(value)) {
      setPopulationError("Please enter a valid number");
    } else {
      setPopulationError("");
    }
  };

  // Validate hyperdrive rating (0.5 - 2.0)
  const validateHyperdriveRating = (value: string): boolean => {
    if (!value.trim()) return false;
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0.5 && num <= 2.0;
  };

  // Quick color picks
  const quickColors = [
    { name: "Red", hex: "#e74c3c" },
    { name: "Yellow", hex: "#f1c40f" },
    { name: "Purple", hex: "#9b59b6" },
    { name: "Orange", hex: "#e67e22" },
    { name: "Light Blue", hex: "#74c8eb" },
    { name: "Pink", hex: "#ff69b4" },
    { name: "Blue", hex: "#3498db" },
    { name: "White", hex: "#ffffff" },
  ];

  // Sorted landmarks for the list
  const sortedLandmarks = createMemo(() => {
    const map = mapsStore.selectedMap;
    if (!map) return [];

    const landmarks = [...map.landmarks];
    landmarks.sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return sortAscending() ? comparison : -comparison;
    });
    return landmarks;
  });

  // Hyperlane creation status text
  const hyperlaneCreationStatus = createMemo(() => {
    if (!isCreatingHyperlane()) {
      return "Idle";
    }
    const segmentCount = currentHyperlaneSegments().length;
    return `Creating - ${segmentCount} segment${segmentCount === 1 ? "" : "s"}`;
  });

  // Timeline range and current story time
  const timelineRange = createMemo(() => getTimelineRange(currentStoryStore, nodeStore.nodesArray));

  const currentStoryTime = createMemo(() => {
    const pending = pendingStoryTime();
    if (pending !== null) return pending;

    const stored = mapsStore.currentStoryTime;
    if (stored !== null) return stored;

    // Default to end of timeline
    const range = timelineRange();
    return range.end;
  });

  // Find the active chapter and message at the current story time
  const activeChapter = createMemo(() => {
    const storyTime = currentStoryTime();
    return getChapterAtStoryTime(storyTime, nodeStore.nodesArray);
  });

  // Get current message ID based on active chapter
  // For now, we'll use the last message of the active chapter
  const currentMessageId = createMemo(() => {
    const chapter = activeChapter();
    if (!chapter) return null;

    // Get messages for this chapter
    const messages = messagesStore.messages
      .filter(m => m.nodeId === chapter.id && m.role === 'assistant' && !m.isQuery)
      .sort((a, b) => a.order - b.order);

    // Return last message
    return messages.length > 0 ? messages[messages.length - 1].id : null;
  });

  // Convert landmark state message IDs to story times for timeline indicators
  const storyTimesWithStates = createMemo(() => {
    const messageIdsWithStates = landmarkStatesStore.messageIdsWithStates;
    const storyTimes: number[] = [];

    for (const messageId of messageIdsWithStates) {
      const storyTime = getStoryTimeForMessage(messageId, messagesStore.messages, nodeStore.nodesArray);
      if (storyTime !== null) {
        storyTimes.push(storyTime);
      }
    }

    return storyTimes;
  });

  // Get all fleet movement story times for timeline indicators
  const fleetMovementTimes = createMemo(() => {
    const map = mapsStore.selectedMap;
    if (!map || !map.fleets) return [];

    const times: number[] = [];
    for (const fleet of map.fleets) {
      for (const movement of fleet.movements) {
        // Add both start and end times
        times.push(movement.startStoryTime);
        times.push(movement.endStoryTime);
      }
    }

    return times;
  });

  // Derive allegiance state reactively from the store (must be after currentMessageId)
  const selectedAllegiance = createMemo(() => {
    const landmark = selectedLandmark();
    const map = mapsStore.selectedMap;
    if (!landmark || !map) return null;

    // Force reactivity by reading the entire accumulatedStates object inline
    const key = `${map.id}:${landmark.id}:allegiance`;
    return landmarkStatesStore.accumulatedStates[key]?.value || null;
  });

  const allegianceAtThisMessage = createMemo(() => {
    const landmark = selectedLandmark();
    const map = mapsStore.selectedMap;
    const messageId = currentMessageId();
    if (!landmark || !map || !messageId) return null;

    // Force reactivity by reading states inline
    const stateAtThisMessage = landmarkStatesStore.states.find(
      s => s.mapId === map.id &&
           s.landmarkId === landmark.id &&
           s.messageId === messageId &&
           s.field === 'allegiance'
    );
    return stateAtThisMessage?.value || null;
  });

  const allegianceSourceMessageId = createMemo(() => {
    const landmark = selectedLandmark();
    const map = mapsStore.selectedMap;
    if (!landmark || !map) return null;

    const key = `${map.id}:${landmark.id}:allegiance`;
    // Force reactivity by reading accumulatedStates inline
    return landmarkStatesStore.accumulatedStates[key]?.messageId || null;
  });

  // Debounced story time update
  const handleTimelineChange = (newStoryTime: number) => {
    // Update pending time immediately for UI feedback
    setPendingStoryTime(newStoryTime);

    // Clear existing timer
    if (timelineDebounceTimer !== null) {
      clearTimeout(timelineDebounceTimer);
    }

    // Set new timer to update actual time after delay
    timelineDebounceTimer = window.setTimeout(() => {
      mapsStore.setCurrentStoryTime(newStoryTime);
      setPendingStoryTime(null);
      timelineDebounceTimer = null;
    }, 500); // 500ms delay
  };

  // Step forward/back in timeline (by granularity)
  const stepTimeline = (direction: 'forward' | 'back') => {
    const range = timelineRange();
    const granularityMinutes = range.granularity === 'hour' ? 60 : 1440;
    const current = currentStoryTime();

    let newTime = current;
    if (direction === 'forward') {
      newTime = Math.min(current + granularityMinutes, range.end);
    } else {
      newTime = Math.max(current - granularityMinutes, range.start);
    }

    // Clear any pending changes
    if (timelineDebounceTimer !== null) {
      clearTimeout(timelineDebounceTimer);
      timelineDebounceTimer = null;
    }
    setPendingStoryTime(null);

    // Update time directly
    mapsStore.setCurrentStoryTime(newTime);
  };

  // Jump to a specific message's story time
  const jumpToMessage = (messageId: string) => {
    const storyTime = getStoryTimeForMessage(messageId, messagesStore.messages, nodeStore.nodesArray);

    if (storyTime !== null) {
      // Clear any pending changes
      if (timelineDebounceTimer !== null) {
        clearTimeout(timelineDebounceTimer);
        timelineDebounceTimer = null;
      }
      setPendingStoryTime(null);

      // Update time directly
      mapsStore.setCurrentStoryTime(storyTime);
    }
  };

  // Cache script execution data via scriptDataStore so we don't re-run scripts
  // for every landmark render (expensive with hundreds of landmarks)
  const scriptDataAtTimeline = createMemo(() => {
    const messageId = currentMessageId();
    if (!messageId) {
      return {};
    }

    const cached = scriptDataStore.getCumulativeDataAtMessage(messageId);
    return cached ? cached : {};
  });

  // Helper to keep existing call sites simple
  const getScriptDataAtTimeline = () => scriptDataAtTimeline();

  // Evaluate border color for a landmark
  const evaluateLandmarkBorderColor = (landmarkName: string): string => {
    const map = mapsStore.selectedMap;
    if (!map?.borderColor) return "";

    const scriptData = getScriptDataAtTimeline();

    // Get the allegiance for this landmark
    const landmark = map.landmarks.find(l => l.name === landmarkName);
    const allegiance = landmark
      ? landmarkStatesStore.getLandmarkState(map.id, landmark.id, 'allegiance')
      : null;

    // Build a systems object from all landmark states
    const systems: Record<string, string> = {};
    for (const l of map.landmarks) {
      const state = landmarkStatesStore.getLandmarkState(map.id, l.id, 'allegiance');
      if (state) {
        systems[l.name] = state;
      }
    }

    const dataWithContext = {
      ...scriptData,
      currentSystemName: landmarkName,
      currentAllegiance: allegiance,
      systems, // Now populated from landmark states instead of scripts
    };

    try {
      const result = evaluateTemplate(map.borderColor, dataWithContext);
      return result.trim();
    } catch (error) {
      console.error("Error evaluating border color:", error);
      return "";
    }
  };

  // Use the landmark manager hook
  const landmarkManager = useLandmarkManager({
    viewport,
    containers,
    mapSprite,
    canvasContainer: () => canvasContainer,
    evaluateBorderColor: evaluateLandmarkBorderColor,
    shouldStopPropagation: () => {
      // Don't stop propagation in fleet mode - allow clicks to pass through to map
      return creationMode() !== "fleet";
    },
    interactive: () => {
      // Make landmarks non-interactive in fleet mode - allow clicks to pass through
      return creationMode() !== "fleet";
    },
    onLandmarkClick: (lm, screenPos, button) => {
      // Ignore landmark clicks when in paint mode
      if (paintModeEnabled()) return;

      const mode = creationMode();

      // In fleet mode, ignore all left-clicks on landmarks (only fleets should be selectable)
      // Right clicks still snap for fleet movement waypoints
      if (mode === "fleet") {
        return; // Don't select landmarks in fleet mode
      }

      // In hyperlane mode, only handle left clicks (button 0)
      // Right clicks are used for hyperlane creation
      if (mode === "hyperlane" && button !== 0) {
        return;
      }

      setSelectedLandmark(lm);
      setSelectedFleet(null);
      setIsEditing(false);
      setIsAddingNew(false);
      const isMobile = window.innerWidth < 768;
      setPopupPosition(calculateSafePopupPosition(screenPos.x, screenPos.y, isMobile));
    },
  });

  // Use the fleet manager hook
  const fleetManager = useFleetManager({
    viewport,
    containers,
    mapSprite,
    canvasContainer: () => canvasContainer,
    currentStoryTime,
    selectedFleetId: () => selectedFleetForMovement()?.id || null,
    onFleetClick: (fleet, screenPos, button) => {
      // In fleet mode, only handle left clicks (button 0)
      // Right clicks are used for movement waypoints
      if (creationMode() === "fleet" && button !== 0) {
        return;
      }

      // If clicking the same fleet that's selected for movement, just show popup
      if (selectedFleetForMovement()?.id === fleet.id) {
        setSelectedFleet(fleet);
        setSelectedLandmark(null);
        setIsEditing(false);
        setIsAddingNew(false);
        const isMobile = window.innerWidth < 768;
        setPopupPosition(calculateSafePopupPosition(screenPos.x, screenPos.y, isMobile));
        return;
      }

      // Select this fleet for movement and show popup
      setSelectedFleetForMovement(fleet);
      setSelectedFleet(fleet);
      setSelectedLandmark(null);
      setIsEditing(false);
      setIsAddingNew(false);
      const isMobile = window.innerWidth < 768;
      setPopupPosition(calculateSafePopupPosition(screenPos.x, screenPos.y, isMobile));
    },
  });

  // Use the hyperlane manager hook
  const hyperlaneManager = useHyperlaneManager({
    viewport,
    containers,
    mapSprite,
    canvasContainer: () => canvasContainer,
    shouldStopPropagation: () => {
      // Don't stop propagation in fleet mode - allow clicks to pass through to map
      return creationMode() !== "fleet";
    },
    interactive: () => {
      // Make hyperlanes non-interactive in fleet mode - allow clicks to pass through
      return creationMode() !== "fleet";
    },
    onHyperlaneClick: (hyperlane, screenPos) => {
      // Only handle hyperlane clicks in hyperlane mode
      if (creationMode() !== "hyperlane") {
        return;
      }

      setSelectedHyperlane(hyperlane);
      setSelectedLandmark(null);
      setSelectedFleet(null);
      setIsEditing(false);
      setIsAddingNew(false);
      setIsAddingFleet(false);
      const isMobile = window.innerWidth < 768;
      setPopupPosition(calculateSafePopupPosition(screenPos.x, screenPos.y, isMobile));
    },
  });

  // Use the pathfinding hook
  const pathfinding = usePathfinding({
    containers,
    mapSprite,
    currentStoryTime,
    landmarks: () => mapsStore.selectedMap?.landmarks || [],
    hyperlanes: () => mapsStore.selectedMap?.hyperlanes || [],
  });

  // Helper function to generate next junction name
  const getNextJunctionName = () => {
    const map = mapsStore.selectedMap;
    if (!map) return "Junction 1";

    // Count existing junctions
    const junctionCount = map.landmarks.filter(l => l.type === "junction").length;
    return `Junction ${junctionCount + 1}`;
  };

  // Helper function to check if clicking near a landmark and return it if so
  const findNearbyLandmark = (position: { x: number, y: number, normalizedX: number, normalizedY: number }) => {
    const map = mapsStore.selectedMap;
    if (!map) return null;

    const snapRadius = 30; // pixels
    const sprite = mapSprite();
    const vp = viewport();
    if (!sprite || !vp) return null;

    for (const landmark of map.landmarks) {
      const landmarkWorldX = landmark.x * sprite.width;
      const landmarkWorldY = landmark.y * sprite.height;
      const landmarkScreen = vp.toScreen(landmarkWorldX, landmarkWorldY);

      const dx = position.x - landmarkScreen.x;
      const dy = position.y - landmarkScreen.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= snapRadius) {
        return landmark;
      }
    }
    return null;
  };

  // Handle right-click in hyperlane mode
  const handleHyperlaneRightClick = (position: { x: number, y: number, normalizedX: number, normalizedY: number }) => {
    const map = mapsStore.selectedMap;
    if (!map) return;

    const nearbyLandmark = findNearbyLandmark(position);

    // Determine the click position (snap to landmark if nearby)
    const clickX = nearbyLandmark ? nearbyLandmark.x : position.normalizedX;
    const clickY = nearbyLandmark ? nearbyLandmark.y : position.normalizedY;

    if (!isCreatingHyperlane()) {
      // Start a new hyperlane
      console.log("Starting new hyperlane at", clickX, clickY);

      // If not snapping to a landmark, create a junction
      let startLandmarkId: string | null = null;
      if (!nearbyLandmark) {
        const junction = mapsStore.addLandmark(map.id, {
          x: clickX,
          y: clickY,
          name: getNextJunctionName(),
          description: "",
          type: "junction",
          color: "#ffffff",
          size: "small"
        });
        startLandmarkId = junction.id;
        updateLandmarks();
      } else {
        startLandmarkId = nearbyLandmark.id;
        console.log(`Snapped to landmark: ${nearbyLandmark.name || "junction"}`);
      }

      // Initialize the first segment (just the start point, no end yet)
      // Use batch() to update all three signals atomically
      batch(() => {
        setCurrentHyperlaneSegments([{
          id: generateMessageId(),
          hyperlaneId: "", // Will be set when saving
          mapId: map.id,
          order: 0,
          startX: clickX,
          startY: clickY,
          endX: clickX, // Will be updated on next click
          endY: clickY,
          startLandmarkId,
          endLandmarkId: null
        }]);
        setIsCreatingHyperlane(true);
        setHyperlanePreviewEnd({ x: clickX, y: clickY });
      });

      // Show initial preview (will update on mouse move)
      hyperlaneManager.showPreviewSegment(clickX, clickY, clickX, clickY);
    } else {
      // Continue or end the hyperlane
      const segments = currentHyperlaneSegments();
      if (segments.length === 0) return;

      const lastSegment = segments[segments.length - 1];

      // If clicking on a landmark or junction, end the hyperlane
      if (nearbyLandmark) {
        console.log(`Ending hyperlane at landmark: ${nearbyLandmark.name || "junction"}`);

        // Update the last segment's end point
        const updatedSegments = [...segments];
        updatedSegments[updatedSegments.length - 1] = {
          ...lastSegment,
          endX: clickX,
          endY: clickY,
          endLandmarkId: nearbyLandmark.id
        };

        // Save the hyperlane
        saveHyperlane(updatedSegments);

        // Reset state atomically
        batch(() => {
          setIsCreatingHyperlane(false);
          setCurrentHyperlaneSegments([]);
          setHyperlanePreviewEnd(null);
        });
        hyperlaneManager.hidePreviewSegment();
        return;
      }

      // Clicking in empty space - add a junction and continue
      console.log("Adding segment to hyperlane at", clickX, clickY);

      // Create a junction at the click position
      const junction = mapsStore.addLandmark(map.id, {
        x: clickX,
        y: clickY,
        name: getNextJunctionName(),
        description: "",
        type: "junction",
        color: "#ffffff",
        size: "small"
      });
      updateLandmarks();

      // Update the last segment's end point
      const updatedSegments = [...segments];
      updatedSegments[updatedSegments.length - 1] = {
        ...lastSegment,
        endX: clickX,
        endY: clickY,
        endLandmarkId: junction.id
      };

      // Add a new segment starting from this junction
      updatedSegments.push({
        id: generateMessageId(),
        hyperlaneId: "", // Will be set when saving
        mapId: map.id,
        order: segments.length,
        startX: clickX,
        startY: clickY,
        endX: clickX, // Will be updated on next click
        endY: clickY,
        startLandmarkId: junction.id,
        endLandmarkId: null
      });

      // Use batch() to update signals atomically
      batch(() => {
        setCurrentHyperlaneSegments(updatedSegments);
        setHyperlanePreviewEnd({ x: clickX, y: clickY });
      });

      // Show initial preview from new junction (will update on mouse move)
      hyperlaneManager.showPreviewSegment(clickX, clickY, clickX, clickY);
    }
  };

  // Save the completed hyperlane
  const saveHyperlane = (segments: HyperlaneSegment[]) => {
    const map = mapsStore.selectedMap;
    if (!map) return;

    console.log(`Saving hyperlane with ${segments.length} segment(s)`);

    mapsStore.addHyperlane(map.id, {
      speedMultiplier: 10.0, // Default 10x speed
      segments
    });

    // Refresh hyperlanes to show the new one
    if (map.hyperlanes) {
      hyperlaneManager.refreshAllHyperlanes(map.hyperlanes);
    }
  };

  // Use the map interactions hook
  const mapInteractions = useMapInteractions({
    viewport,
    containers,
    mapSprite,
    canvasContainer: () => canvasContainer,
    isEditing,
    isAddingNew,
    mapSelected: () => !!mapsStore.selectedMap,
    lastUsedType,
    creationMode,
    paintModeEnabled,
    isShiftHeld,
    selectedPaintFaction,
    onPaintClick: (screenX, screenY, faction) => applyAllegianceToBrush(screenX, screenY, faction),
    onMapClick: (position) => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // Deselect fleet for movement if clicking on empty map (not in fleet creation mode)
      if (creationMode() !== "fleet" && selectedFleetForMovement()) {
        setSelectedFleetForMovement(null);
        // Refresh fleets to remove selection indicator
        const map = mapsStore.selectedMap;
        if (map && map.fleets) {
          fleetManager.refreshAllFleets(map.fleets);
          fleetManager.drawAllFleetPaths(map.fleets);
        }
      }

      // Clear hyperlane selection when clicking on empty space in hyperlane mode
      if (creationMode() === "hyperlane" && selectedHyperlane()) {
        setSelectedHyperlane(null);
        setIsEditing(false);
        // Refresh hyperlanes to remove selection highlight
        const map = mapsStore.selectedMap;
        if (map && map.hyperlanes) {
          hyperlaneManager.refreshAllHyperlanes(map.hyperlanes);
        }
      }

      // Check creation mode
      const mode = creationMode();

      if (mode === "fleet") {
        // Fleet creation mode
        if (isAddingFleet()) {
          // If already adding a fleet, reposition or close
          const sprite = mapSprite();
          const vp = viewport();

          if (sprite && vp) {
            const currentWorldX = newFleetPos().x * sprite.width;
            const currentWorldY = newFleetPos().y * sprite.height;
            const currentScreen = vp.toScreen(currentWorldX, currentWorldY);

            const dx = position.x - currentScreen.x;
            const dy = position.y - currentScreen.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 30) {
              setIsAddingFleet(false);
              setIsEditing(false);
              setSelectedFleet(null);
              return;
            }
          }

          // Reposition
          setNewFleetPos({ x: position.normalizedX, y: position.normalizedY });
          const actualHeight = popupElement?.offsetHeight;
          setPopupPosition(calculateSafePopupPosition(position.x, position.y, isTouchDevice, actualHeight));
          return;
        }

        // Start adding a new fleet
        setNewFleetPos({ x: position.normalizedX, y: position.normalizedY });
        setEditName("");
        setEditDescription("");
        setEditDesignation("");
        setEditHyperdriveRating("1.0");
        setHyperdriveError("");
        setEditColor("#00ff00");
        setEditSize("medium");
        setEditVariant("military");
        setIsAddingFleet(true);
        setIsEditing(true);
        setSelectedFleet(null);
        setSelectedLandmark(null);

        // Position popup
        if (isTouchDevice) {
          setPopupPosition(calculateSafePopupPosition(position.x, position.y, true));
        } else {
          setPopupPosition(calculateSafePopupPosition(position.x + 80, position.y - 12, false));
        }
      } else if (mode === "landmark") {
        // Landmark creation mode
        if (isAddingNew()) {
          const sprite = mapSprite();
          const vp = viewport();

          if (sprite && vp) {
            const currentWorldX = newLandmarkPos().x * sprite.width;
            const currentWorldY = newLandmarkPos().y * sprite.height;
            const currentScreen = vp.toScreen(currentWorldX, currentWorldY);

            const dx = position.x - currentScreen.x;
            const dy = position.y - currentScreen.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 30) {
              setIsAddingNew(false);
              setIsEditing(false);
              setSelectedLandmark(null);
              mapInteractions.hidePreview();
              return;
            }
          }

          setNewLandmarkPos({ x: position.normalizedX, y: position.normalizedY });
          mapInteractions.updatePreview(
            { x: position.normalizedX, y: position.normalizedY },
            editColor(),
            editSize(),
            editType(),
            "landmark"
          );
          const actualHeight = popupElement?.offsetHeight;
          const isMobile = isTouchDevice;
          setPopupPosition(calculateSafePopupPosition(position.x, position.y, isMobile, actualHeight));
          return;
        }

        // Start adding a new landmark
        setNewLandmarkPos({ x: position.normalizedX, y: position.normalizedY });
        setEditName("");
        setEditDescription("");
        setEditPopulation("");
        setEditIndustry("");
        setEditPlanetaryBodies("");
        setEditRegion("");
        setEditSector("");
        setPopulationError("");
        setEditColor(lastUsedColor());
        setEditSize(lastUsedSize());
        setEditType(lastUsedType());
        setIsAddingNew(true);
        setIsEditing(true);
        setSelectedLandmark(null);
        setSelectedFleet(null);

        // Show preview sprite
        mapInteractions.updatePreview(
          { x: position.normalizedX, y: position.normalizedY },
          lastUsedColor(),
          lastUsedSize(),
          lastUsedType(),
          "landmark"
        );

        // Position popup
        const markerRadius = 12;
        if (isTouchDevice) {
          setPopupPosition(calculateSafePopupPosition(position.x, position.y, true));
        } else {
          setPopupPosition(calculateSafePopupPosition(position.x + markerRadius + 80, position.y - markerRadius, false));
        }
      }
    },
    onMapRightClick: (position) => {
      const map = mapsStore.selectedMap;
      if (!map) return;

      // Check if in hyperlane mode
      if (creationMode() === "hyperlane") {
        handleHyperlaneRightClick(position);
        return;
      }

      // Check if a fleet is selected for movement
      const fleet = selectedFleetForMovement();
      if (!fleet) {
        console.log("No fleet selected for movement");
        return;
      }

      // Check for landmark snapping - if clicking near a landmark, snap to its center
      let targetX = position.normalizedX;
      let targetY = position.normalizedY;
      const snapRadius = 30; // pixels

      for (const landmark of map.landmarks) {
        const sprite = mapSprite();
        const vp = viewport();
        if (!sprite || !vp) continue;

        const landmarkWorldX = landmark.x * sprite.width;
        const landmarkWorldY = landmark.y * sprite.height;
        const landmarkScreen = vp.toScreen(landmarkWorldX, landmarkWorldY);

        const dx = position.x - landmarkScreen.x;
        const dy = position.y - landmarkScreen.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= snapRadius) {
          // Snap to landmark center
          targetX = landmark.x;
          targetY = landmark.y;
          console.log(`Snapped to landmark: ${landmark.name}`);
          break;
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
        mapsStore
      });

      // Refresh fleets to show the new path
      if (map.fleets && map.fleets.length > 0) {
        fleetManager.refreshAllFleets(map.fleets);
        fleetManager.drawAllFleetPaths(map.fleets);
      }
    },
  });

  // Get landmarks with colors for overlay
  const getLandmarksWithColors = (): ColoredLandmark[] => {
    const sprite = mapSprite();
    if (!sprite || !mapsStore.selectedMap) return [];

    const landmarksWithColors: ColoredLandmark[] = [];

    mapsStore.selectedMap.landmarks.forEach((landmark) => {
      const borderColor = evaluateLandmarkBorderColor(landmark.name);
      if (borderColor && borderColor !== "") {
        const hexColor = parseColorToHex(borderColor);
        landmarksWithColors.push({
          x: landmark.x * sprite.width,
          y: landmark.y * sprite.height,
          color: hexColor,
          name: landmark.name,
        });
      }
    });

    return landmarksWithColors;
  };

  // Wrapper functions for voronoi rendering (use imported utilities)
  const renderStandardVoronoi = (landmarksWithColors: ColoredLandmark[]) => {
    const voronoiContainer = containers().voronoi;
    const sprite = mapSprite();
    if (!voronoiContainer || !sprite) return;

    drawStandardVoronoi(
      voronoiContainer,
      landmarksWithColors,
      sprite.width,
      sprite.height
    );
  };

  const renderDistanceField = (landmarksWithColors: ColoredLandmark[]) => {
    const voronoiContainer = containers().voronoi;
    const sprite = mapSprite();
    if (!voronoiContainer || !sprite) return;

    // Cancel any existing animation
    cancelAnimation(distanceFieldAnimation());

    // Start new rendering and store the handle
    const handle = drawDistanceField(
      voronoiContainer,
      landmarksWithColors,
      sprite.width,
      sprite.height
    );
    setDistanceFieldAnimation(handle);
  };

  const renderBlurredVoronoi = (landmarksWithColors: ColoredLandmark[]) => {
    const voronoiContainer = containers().voronoi;
    const sprite = mapSprite();
    if (!voronoiContainer || !sprite) return;

    drawBlurredVoronoi(
      voronoiContainer,
      landmarksWithColors,
      sprite.width,
      sprite.height
    );
  };

  // Update overlay based on selected method
  const updateVoronoiOverlay = () => {
    const voronoiContainer = containers().voronoi;
    if (!voronoiContainer || !mapSprite || !mapsStore.selectedMap) return;

    // Cancel any progressive rendering in progress
    cancelAnimation(distanceFieldAnimation());
    setDistanceFieldAnimation(null);

    // Clear existing overlay and filters
    voronoiContainer.removeChildren();
    voronoiContainer.filters = [];

    // Only draw if overlay is enabled
    if (!showFactionOverlay()) return;

    const landmarksWithColors = getLandmarksWithColors();

    // Need at least 1 point for metaballs, 2 for Voronoi
    if (landmarksWithColors.length === 0) return;

    switch (overlayMethod()) {
      case 'voronoi':
        if (landmarksWithColors.length >= 2) {
          renderStandardVoronoi(landmarksWithColors);
        }
        break;
      case 'metaball':
        renderDistanceField(landmarksWithColors);
        break;
      case 'blurred':
        if (landmarksWithColors.length >= 2) {
          renderBlurredVoronoi(landmarksWithColors);
        }
        break;
      case 'noise':
        // TODO: Implement noise-distorted Voronoi
        if (landmarksWithColors.length >= 2) {
          renderStandardVoronoi(landmarksWithColors);
        }
        break;
    }
  };

  // Plain function to render all landmarks and fleets (no reactivity)
  const renderAllLandmarks = () => {
    const map = mapsStore.selectedMap;
    const sprite = mapSprite();

    if (!map || !sprite) return;

    landmarkManager.refreshAllLandmarks(map.landmarks);

    // Also render fleets if they exist
    if (map.fleets && map.fleets.length > 0) {
      fleetManager.refreshAllFleets(map.fleets);
      fleetManager.drawAllFleetPaths(map.fleets);
    }

    // Render hyperlanes if they exist
    if (map.hyperlanes && map.hyperlanes.length > 0) {
      hyperlaneManager.refreshAllHyperlanes(map.hyperlanes);
    }

    updateVoronoiOverlay();
  };

  // Plain function to update landmarks incrementally (no reactivity)
  const updateLandmarks = () => {
    const map = mapsStore.selectedMap;
    const sprite = mapSprite();
    const landmarkContainer = containers().landmark;

    if (!map || !sprite || !landmarkContainer) return;

    const existingSprites = landmarkContainer.children as LandmarkSprite[];
    const existingLandmarksMap = new Map<string, LandmarkSprite>();

    for (const existingSprite of existingSprites) {
      if (existingSprite.landmarkData) {
        existingLandmarksMap.set(existingSprite.landmarkData.id, existingSprite);
      }
    }

    // Track which landmarks we've seen
    const seenLandmarkIds = new Set<string>();

    // Update or add landmarks
    for (const landmark of map.landmarks) {
      seenLandmarkIds.add(landmark.id);
      landmarkManager.updateLandmark(landmark);
    }

    // Remove landmarks that no longer exist
    for (const id of existingLandmarksMap.keys()) {
      if (!seenLandmarkIds.has(id)) {
        landmarkManager.removeLandmark(id);
      }
    }

    updateVoronoiOverlay();
  };

  // Wrapper to load map using the hook
  const loadMap = async (imageData: string) => {
    const vp = viewport();
    if (!vp) return;

    await loadMapImage(
      imageData,
      vp,
      containers(),
      () => {
        // Load landmarks after map is loaded
        renderAllLandmarks();
      },
      () => {
        // Setup interactions after map is loaded
        mapInteractions.setupInteractions();
      }
    );
  };
  
  // Measure popup and update position when it's rendered or content changes
  createEffect(() => {
    const vp = viewport();
    const sprite = mapSprite();
    if (popupElement && (selectedLandmark() || isAddingNew()) && vp && sprite) {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // Get the actual height of the popup
      const actualHeight = popupElement.offsetHeight;

      // Get current position (either selected landmark or new landmark position)
      let worldX: number, worldY: number;
      if (isAddingNew()) {
        const pos = newLandmarkPos();
        worldX = pos.x * sprite.width;
        worldY = pos.y * sprite.height;
      } else if (selectedLandmark()) {
        worldX = selectedLandmark()!.x * sprite.width;
        worldY = selectedLandmark()!.y * sprite.height;
      } else {
        return;
      }

      // Convert to screen coordinates
      const screenPos = vp.toScreen(worldX, worldY);
      const baseX = screenPos.x + (canvasContainer?.offsetLeft || 0);
      const baseY = screenPos.y + (canvasContainer?.offsetTop || 0);

      // Pass canvas-relative position for mobile
      // Recalculate position with actual height
      const newPosition = calculateSafePopupPosition(baseX, baseY, isTouchDevice, actualHeight);

      // Only update if position changed significantly (to avoid infinite loops)
      const currentPos = popupPosition();
      if (Math.abs(newPosition.x - currentPos.x) > 1 || Math.abs(newPosition.y - currentPos.y) > 1) {
        setPopupPosition(newPosition);
      }
    }
  });

  // Show placement indicator when adding new landmark
  createEffect(() => {
    if (isAddingNew()) {
      mapInteractions.updatePreview(
        newLandmarkPos(),
        editColor(),
        editSize(),
        editType()
      );
    } else {
      mapInteractions.hidePreview();
    }
  });

  // Handle file selection
  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      setSelectedFileName(file.name);
    }
  };

  // Add new map
  const handleAddMap = async () => {
    const name = newMapName().trim();
    const borderColor = newMapBorderColor().trim();
    const file = selectedFile();

    if (!name || !file) return;

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      await mapsStore.addMap(name, imageData, borderColor || undefined);
      setNewMapName("");
      setNewMapBorderColor("");
      setSelectedFile(null);
      setSelectedFileName("");
    };
    reader.readAsDataURL(file);
  };

  // Save landmark (new or edit)
  const saveLandmark = () => {
    const name = editName().trim();
    const description = editDescription().trim();

    if (!name || isSaving()) return; // Only name is required and prevent double-clicks
    
    // Validate population if provided
    if (editPopulation().trim() && !validatePopulation(editPopulation())) {
      setPopulationError("Please enter a valid number");
      return;
    }
    
    setIsSaving(true);
    
    try {
      if (isAddingNew() && mapsStore.selectedMap) {
        // Remember the settings for next time
        setLastUsedColor(editColor());
        setLastUsedSize(editSize());
        setLastUsedType(editType());
        localStorage.setItem('lastLandmarkColor', editColor());
        localStorage.setItem('lastLandmarkSize', editSize());
        localStorage.setItem('lastLandmarkType', editType());

        // Add new landmark
        mapsStore.addLandmark(
          mapsStore.selectedMap.id,
          {
            x: newLandmarkPos().x,
            y: newLandmarkPos().y,
            name,
            description,
            type: editType(),
            population: editPopulation() || undefined,
            industry: (editIndustry() as LandmarkIndustry) || undefined,
            planetaryBodies: editPlanetaryBodies() || undefined,
            region: editRegion() || undefined,
            sector: editSector() || undefined,
            color: editColor(),
            size: editSize(),
          },
        );
        // Update landmarks to show the new one
        updateLandmarks();
      } else if (selectedLandmark() && mapsStore.selectedMap) {
        // Update existing landmark
        mapsStore.updateLandmark(
          mapsStore.selectedMap.id,
          selectedLandmark()!.id,
          {
            name,
            description,
            type: editType(),
            population: editPopulation() || undefined,
            industry: (editIndustry() as LandmarkIndustry) || undefined,
            planetaryBodies: editPlanetaryBodies() || undefined,
            region: editRegion() || undefined,
            sector: editSector() || undefined,
            color: editColor(),
            size: editSize(),
          },
        );
        // Update landmarks to show the changes
        updateLandmarks();
      }

      setIsEditing(false);
      setIsAddingNew(false);
      setSelectedLandmark(null);
    } finally {
      // Reset saving state after a short delay to provide UI feedback
      setTimeout(() => setIsSaving(false), 200);
    }
  };

  // Delete landmark
  const deleteLandmark = () => {
    if (selectedLandmark() && mapsStore.selectedMap && !isDeleting()) {
      setIsDeleting(true);

      try {
        mapsStore.deleteLandmark(
          mapsStore.selectedMap.id,
          selectedLandmark()!.id,
        );
        setSelectedLandmark(null);

        // Update landmarks to remove the deleted one
        updateLandmarks();
      } finally {
        // Reset deleting state after a short delay to provide UI feedback
        setTimeout(() => setIsDeleting(false), 200);
      }
    }
  };

  // Save fleet (new or edit)
  const saveFleet = () => {
    const name = editName().trim();
    const description = editDescription().trim();
    const designation = editDesignation().trim();

    if (!name || isSaving()) return;

    // Validate hyperdrive rating
    if (!validateHyperdriveRating(editHyperdriveRating())) {
      setHyperdriveError("Must be between 0.5 and 2.0");
      return;
    }

    setIsSaving(true);

    try {
      if (isAddingFleet() && mapsStore.selectedMap) {
        // Add new fleet
        mapsStore.addFleet(
          mapsStore.selectedMap.id,
          {
            defaultX: newFleetPos().x,
            defaultY: newFleetPos().y,
            name,
            description,
            designation: designation || undefined,
            hyperdriveRating: parseFloat(editHyperdriveRating()),
            color: editColor(),
            size: editSize(),
            variant: editVariant(),
          },
        );
        // Refresh fleets
        const map = mapsStore.selectedMap;
        if (map && map.fleets && map.fleets.length > 0) {
          fleetManager.refreshAllFleets(map.fleets);
          fleetManager.drawAllFleetPaths(map.fleets);
        }
      } else if (selectedFleet() && mapsStore.selectedMap) {
        // Update existing fleet
        mapsStore.updateFleet(
          mapsStore.selectedMap.id,
          selectedFleet()!.id,
          {
            name,
            description,
            designation: designation || undefined,
            hyperdriveRating: parseFloat(editHyperdriveRating()),
            color: editColor(),
            size: editSize(),
            variant: editVariant(),
          },
        );
        // Refresh fleets
        const map = mapsStore.selectedMap;
        if (map && map.fleets && map.fleets.length > 0) {
          fleetManager.refreshAllFleets(map.fleets);
          fleetManager.drawAllFleetPaths(map.fleets);
        }
      }

      setIsEditing(false);
      setIsAddingFleet(false);
      setSelectedFleet(null);
    } finally {
      setTimeout(() => setIsSaving(false), 200);
    }
  };

  // Delete fleet
  const deleteFleet = () => {
    if (selectedFleet() && mapsStore.selectedMap && !isDeleting()) {
      setIsDeleting(true);

      try {
        mapsStore.deleteFleet(
          mapsStore.selectedMap.id,
          selectedFleet()!.id,
        );
        setSelectedFleet(null);

        // Refresh fleets
        const map = mapsStore.selectedMap;
        if (map && map.fleets) {
          fleetManager.refreshAllFleets(map.fleets);
          fleetManager.drawAllFleetPaths(map.fleets);
        }
      } finally {
        setTimeout(() => setIsDeleting(false), 200);
      }
    }
  };

  // Delete active movement
  const deleteActiveMovement = () => {
    const fleet = selectedFleet();
    const map = mapsStore.selectedMap;
    if (!fleet || !map || isDeletingMovement()) return;

    const activeMovement = getActiveMovement(fleet, currentStoryTime());
    if (!activeMovement) return;

    setIsDeletingMovement(true);
    try {
      mapsStore.deleteFleetMovement(map.id, fleet.id, activeMovement.id);
      // Refresh fleets
      if (map.fleets) {
        fleetManager.refreshAllFleets(map.fleets);
        fleetManager.drawAllFleetPaths(map.fleets);
      }
    } finally {
      setTimeout(() => setIsDeletingMovement(false), 200);
    }
  };

  // Start editing existing fleet
  const startEditingFleet = () => {
    if (selectedFleet()) {
      setEditName(selectedFleet()!.name);
      setEditDescription(selectedFleet()!.description || "");
      setEditDesignation(selectedFleet()!.designation || "");
      setEditHyperdriveRating(selectedFleet()!.hyperdriveRating.toString());
      setHyperdriveError("");
      setEditColor(selectedFleet()!.color || "#00ff00");
      setEditSize(selectedFleet()!.size || "medium");
      setEditVariant(selectedFleet()!.variant || "military");
      setIsEditing(true);
      setIsAddingFleet(false);
    }
  };

  // Cancel fleet editing
  const cancelEditingFleet = () => {
    setIsEditing(false);
    setIsAddingFleet(false);
    if (isAddingFleet()) {
      setSelectedFleet(null);
    }
  };

  // Validate speed multiplier (1.0 - 20.0)
  const validateSpeedMultiplier = (value: string): boolean => {
    if (!value.trim()) return false;
    const num = parseFloat(value);
    return !isNaN(num) && num >= 1.0 && num <= 20.0;
  };

  // Start editing existing hyperlane
  const startEditingHyperlane = () => {
    if (selectedHyperlane()) {
      setEditSpeedMultiplier(selectedHyperlane()!.speedMultiplier.toString());
      setSpeedMultiplierError("");
      setIsEditing(true);
    }
  };

  // Save hyperlane (edit only, creation is handled by saveHyperlane function)
  const saveHyperlaneEdit = () => {
    const hyperlane = selectedHyperlane();
    const map = mapsStore.selectedMap;

    if (!hyperlane || !map || isSaving()) return;

    // Validate speed multiplier
    if (!validateSpeedMultiplier(editSpeedMultiplier())) {
      setSpeedMultiplierError("Must be between 1.0 and 20.0");
      return;
    }

    setIsSaving(true);

    try {
      mapsStore.updateHyperlane(map.id, hyperlane.id, {
        speedMultiplier: parseFloat(editSpeedMultiplier()),
      });

      // Refresh hyperlanes
      if (map.hyperlanes) {
        hyperlaneManager.refreshAllHyperlanes(map.hyperlanes);
      }

      setIsEditing(false);
    } finally {
      setTimeout(() => setIsSaving(false), 200);
    }
  };

  // Quick save speed multiplier directly (for quick select buttons)
  const quickSaveSpeedMultiplier = (value: string) => {
    const hyperlane = selectedHyperlane();
    const map = mapsStore.selectedMap;

    if (!hyperlane || !map || isSaving()) return;

    // Validate speed multiplier
    if (!validateSpeedMultiplier(value)) {
      return;
    }

    setIsSaving(true);

    try {
      mapsStore.updateHyperlane(map.id, hyperlane.id, {
        speedMultiplier: parseFloat(value),
      });

      // Refresh hyperlanes
      if (map.hyperlanes) {
        hyperlaneManager.refreshAllHyperlanes(map.hyperlanes);
      }
    } finally {
      setTimeout(() => setIsSaving(false), 200);
    }
  };

  // Delete hyperlane
  const deleteHyperlaneEdit = () => {
    const hyperlane = selectedHyperlane();
    const map = mapsStore.selectedMap;

    if (!hyperlane || !map || isDeleting()) return;

    setIsDeleting(true);

    try {
      mapsStore.deleteHyperlane(map.id, hyperlane.id);
      setSelectedHyperlane(null);

      // Refresh hyperlanes
      if (map.hyperlanes) {
        hyperlaneManager.refreshAllHyperlanes(map.hyperlanes);
      }
    } finally {
      setTimeout(() => setIsDeleting(false), 200);
    }
  };

  // Cancel hyperlane editing
  const cancelEditingHyperlane = () => {
    setIsEditing(false);
  };

  // Calculate safe popup position that stays within viewport
  const calculateSafePopupPosition = (x: number, y: number, preferVertical: boolean = false, actualHeight?: number) => {
    const popupWidth = 280; // Fixed width from CSS
    const popupHeight = actualHeight || 400; // Use actual height if available, else max from CSS
    const padding = 10; // Minimum distance from viewport edges
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let finalX = x;
    let finalY = y;
    
    if (preferVertical) {
      // Mobile: Always stick to top of viewport
      
      // Center horizontally on the point
      finalX = x - popupWidth / 2;
      
      // Always position at top
      finalY = padding;
      
      // Ensure X stays within bounds (centered but adjusted if needed)
      if (finalX < padding) {
        finalX = padding;
      } else if (finalX + popupWidth + padding > viewportWidth) {
        finalX = viewportWidth - popupWidth - padding;
      }
    } else {
      // Desktop: Prioritize horizontal positioning (left/right)
      
      // Calculate initial position (offset to the right)
      finalX = x + 80;
      finalY = y - 10;
      
      // Adjust X position if popup would go off right edge
      if (finalX + popupWidth + padding > viewportWidth) {
        // Try positioning to the left of the point instead
        finalX = x - popupWidth - 20;
        // If still off screen, just position at right edge
        if (finalX < padding) {
          finalX = viewportWidth - popupWidth - padding;
        }
      }
      
      // Ensure X doesn't go off left edge
      if (finalX < padding) {
        finalX = padding;
      }
      
      // Adjust Y position if popup would go off bottom edge
      if (finalY + popupHeight + padding > viewportHeight) {
        // Try positioning above the point instead
        finalY = y - popupHeight - 20;
        // If still off screen, just position at bottom edge
        if (finalY < padding) {
          finalY = viewportHeight - popupHeight - padding;
        }
      }
      
      // Ensure Y doesn't go off top edge
      if (finalY < padding) {
        finalY = padding;
      }
    }
    
    return { x: finalX, y: finalY };
  };

  // Focus on a landmark from the list
  const focusOnLandmark = (landmark: Landmark) => {
    // Ignore landmark selection when in paint mode
    if (paintModeEnabled()) return;

    const vp = viewport();
    const sprite = mapSprite();
    if (!vp || !sprite) return;

    // Set as selected
    setSelectedLandmark(landmark);
    setIsEditing(false);
    setIsAddingNew(false);

    // Calculate world position from normalized coordinates
    const worldX = landmark.x * sprite.width;
    const worldY = landmark.y * sprite.height;

    // Move to the landmark position
    // Check if animate method exists (it's available in pixi-viewport)
    const vpAny = vp as any;
    if (vpAny.animate) {
      vpAny.animate({
        position: { x: worldX, y: worldY },
        scale: Math.max(1, vp.scale.x), // Ensure minimum zoom level
        time: 500, // Animation duration in ms
        ease: "easeInOutSine",
      });
    } else {
      // Fallback to immediate positioning
      vpAny.moveCenter(worldX, worldY);
    }

    // Show the landmark popup
    const screenPos = vp.toScreen(worldX, worldY);
    const baseX = screenPos.x + (canvasContainer?.offsetLeft || 0);
    const baseY = screenPos.y + (canvasContainer?.offsetTop || 0);
    const isMobile = window.innerWidth < 768;
    setPopupPosition(calculateSafePopupPosition(baseX, baseY, isMobile));
  };

  // Start editing existing landmark
  const startEditing = () => {
    if (selectedLandmark()) {
      setEditName(selectedLandmark()!.name);
      setEditDescription(selectedLandmark()!.description);
      setEditType(selectedLandmark()!.type || "system");
      setEditPopulation(selectedLandmark()!.population || "");
      setEditIndustry(selectedLandmark()!.industry || "");
      setEditPlanetaryBodies(selectedLandmark()!.planetaryBodies || "");
      setEditRegion(selectedLandmark()!.region || "");
      setEditSector(selectedLandmark()!.sector || "");
      setPopulationError("");
      setEditColor(selectedLandmark()!.color || "#3498db");
      setEditSize(selectedLandmark()!.size || "medium");
      setIsEditing(true);
      setIsAddingNew(false);
    }
  };
  
  
  // Save allegiance for selected landmark
  const saveAllegiance = async (value: string | null) => {
    const landmark = selectedLandmark();
    const map = mapsStore.selectedMap;
    const messageId = currentMessageId();
    const storyId = currentStoryStore.id;

    if (!landmark || !map || !messageId || !storyId) return;

    setIsSavingAllegiance(true);
    try {
      await landmarkStatesStore.setLandmarkState(
        storyId,
        map.id,
        landmark.id,
        messageId,
        'allegiance',
        value
      );

      // Reload accumulated states - the reactive memos will automatically update
      await landmarkStatesStore.loadAccumulatedStates(storyId, messageId);

      // Update the landmark visual (border color)
      landmarkManager.updateLandmark(landmark, true);

      // Update voronoi overlay if enabled
      if (showFactionOverlay()) {
        updateVoronoiOverlay();
      }
    } catch (error) {
      console.error('Failed to save allegiance:', error);
    } finally {
      setIsSavingAllegiance(false);
    }
  };

  // Batch apply allegiance to all landmarks within brush radius
  const applyAllegianceToBrush = async (screenX: number, screenY: number, faction: string | null) => {
    const map = mapsStore.selectedMap;
    const messageId = currentMessageId();
    const storyId = currentStoryStore.id;
    const sprite = mapSprite();
    const vp = viewport();

    if (!map || !messageId || !storyId || !sprite || !vp) return;

    // Find all landmarks within 100px screen radius
    const affectedLandmarks: Landmark[] = [];
    const brushRadiusPx = 100;

    for (const landmark of map.landmarks) {
      // Convert landmark position to screen coordinates
      const worldX = landmark.x * sprite.width;
      const worldY = landmark.y * sprite.height;
      const landmarkScreen = vp.toScreen(worldX, worldY);

      // Calculate distance
      const dx = landmarkScreen.x - screenX;
      const dy = landmarkScreen.y - screenY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= brushRadiusPx) {
        affectedLandmarks.push(landmark);
      }
    }

    if (affectedLandmarks.length === 0) return;

    // Batch update all affected landmarks
    for (const landmark of affectedLandmarks) {
      await landmarkStatesStore.setLandmarkState(
        storyId,
        map.id,
        landmark.id,
        messageId,
        'allegiance',
        faction
      );
    }

    // Reload accumulated states
    await landmarkStatesStore.loadAccumulatedStates(storyId, messageId);

    // Update all affected landmark sprites
    for (const landmark of affectedLandmarks) {
      landmarkManager.updateLandmark(landmark, true);
    }

    // Update voronoi overlay once after all landmarks (if enabled)
    if (showFactionOverlay()) {
      updateVoronoiOverlay();
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setIsAddingNew(false);
    if (isAddingNew()) {
      setSelectedLandmark(null);
    }
  };

  // Fetch landmark info from web search
  const fetchLandmarkInfo = async () => {
    const name = editName().trim();
    const type = editType();
    if (!name || isFetchingLandmarkInfo()) return;
    
    // Only proceed if fields are empty
    const hasExistingInfo = editPopulation() || editIndustry() || editDescription() || editPlanetaryBodies();
    if (hasExistingInfo && !confirm('This will overwrite existing information. Continue?')) {
      return;
    }
    
    setIsFetchingLandmarkInfo(true);
    
    try {
      const info = await searchLandmarkInfo(name, type);
      
      // Only update empty fields by default, unless user confirmed overwrite
      if (!editPopulation() || hasExistingInfo) {
        setEditPopulation(info.population || editPopulation());
      }
      if (!editIndustry() || hasExistingInfo) {
        setEditIndustry(info.industry || editIndustry());
      }
      if (!editDescription() || hasExistingInfo) {
        setEditDescription(info.description || editDescription());
      }
      if (!editPlanetaryBodies() || hasExistingInfo) {
        setEditPlanetaryBodies(info.planetaryBodies || editPlanetaryBodies());
      }
      
      console.log('Fetched landmark info:', info);
    } catch (error) {
      console.error('Failed to fetch landmark info:', error);
      alert('Failed to fetch landmark information. Please check your Anthropic API key and try again.');
    } finally {
      setIsFetchingLandmarkInfo(false);
    }
  };

  // Initialize Pixi when canvas container is available and map is selected
  createEffect(on(
    () => [app(), mapsStore.selectedMap] as const,
    ([pixiApp, map]) => {
      if (canvasContainer && map && !pixiApp) {
        initialize();
      }
    }
  ));

  // Handle map selection change (wait for PIXI to be ready)
  createEffect(on(
    () => [mapsStore.selectedMap, isReady()] as const,
    ([map, ready]) => {
      if (map && map.imageData && ready) {
        loadMap(map.imageData);
      }
    }
  ));

  // Load accumulated landmark states when timeline changes, then re-render
  createEffect(on(
    () => [currentMessageId(), currentStoryStore.id] as const,
    ([messageId, storyId]) => {
      if (messageId && storyId && !isRendering()) {
        setIsRendering(true);
        landmarkStatesStore.loadAccumulatedStates(storyId, messageId).then(() => {
          renderAllLandmarks();
          setIsRendering(false);
        }).catch(() => {
          setIsRendering(false);
        });
      }
    }
  ));

  // Direct pointerdown handler for fleet creation mode
  createEffect(() => {
    const vp = viewport();
    if (!vp) return;

    let pointerDownPos: { x: number; y: number } | null = null;
    let isDragging = false;

    const handlePointerDown = (e: PIXI.FederatedPointerEvent) => {
      // Only handle in fleet mode and for left-clicks (button 0)
      if (creationMode() !== "fleet" || e.button !== 0) return;

      // Record the pointer down position
      pointerDownPos = { x: e.global.x, y: e.global.y };
      isDragging = false;
    };

    const handlePointerMove = (e: PIXI.FederatedPointerEvent) => {
      if (!pointerDownPos) return;

      // Calculate distance moved
      const dx = e.global.x - pointerDownPos.x;
      const dy = e.global.y - pointerDownPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If moved more than 5 pixels, consider it a drag
      if (distance > 5) {
        isDragging = true;
      }
    };

    const handlePointerUp = (e: PIXI.FederatedPointerEvent) => {
      // Only handle in fleet mode and for left-clicks (button 0)
      if (creationMode() !== "fleet" || e.button !== 0 || !pointerDownPos) {
        pointerDownPos = null;
        isDragging = false;
        return;
      }

      // If it was a drag, don't process as a click
      if (isDragging) {
        pointerDownPos = null;
        isDragging = false;
        return;
      }

      const sprite = mapSprite();
      if (!sprite) return;

      // Get world position
      const worldPos = vp.toWorld(e.global);

      // Convert to normalized coordinates
      const normalizedX = worldPos.x / sprite.width;
      const normalizedY = worldPos.y / sprite.height;

      // Check bounds
      if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
        pointerDownPos = null;
        return;
      }

      // Check if a fleet is already selected for movement
      if (selectedFleetForMovement()) {
        // Deselect the fleet instead of creating a new one
        setSelectedFleetForMovement(null);
        const map = mapsStore.selectedMap;
        if (map && map.fleets) {
          fleetManager.refreshAllFleets(map.fleets);
          fleetManager.drawAllFleetPaths(map.fleets);
        }
        pointerDownPos = null;
        return;
      }

      // Get screen position
      const screenPos = vp.toScreen(worldPos);
      const baseX = screenPos.x + (canvasContainer?.offsetLeft || 0);
      const baseY = screenPos.y + (canvasContainer?.offsetTop || 0);

      // Check for nearby landmark and snap
      const nearbyLandmark = findNearbyLandmark({
        x: baseX,
        y: baseY,
        normalizedX,
        normalizedY
      });

      const finalX = nearbyLandmark ? nearbyLandmark.x : normalizedX;
      const finalY = nearbyLandmark ? nearbyLandmark.y : normalizedY;

      // Start fleet creation dialog
      setNewFleetPos({ x: finalX, y: finalY });
      setEditName("");
      setEditDescription("");
      setEditDesignation("");
      setEditHyperdriveRating("1.0");
      setHyperdriveError("");
      setEditColor("#00ff00");
      setEditSize("medium");
      setEditVariant("military");
      setIsAddingFleet(true);
      setIsEditing(true);
      setSelectedFleet(null);
      setSelectedLandmark(null);

      // Position popup
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (isTouchDevice) {
        setPopupPosition(calculateSafePopupPosition(baseX, baseY, true));
      } else {
        setPopupPosition(calculateSafePopupPosition(baseX + 80, baseY - 12, false));
      }

      pointerDownPos = null;
    };

    vp.on("pointerdown", handlePointerDown);
    vp.on("pointermove", handlePointerMove);
    vp.on("pointerup", handlePointerUp);

    return () => {
      vp.off("pointerdown", handlePointerDown);
      vp.off("pointermove", handlePointerMove);
      vp.off("pointerup", handlePointerUp);
    };
  });

  // Update fleet positions when story time changes
  createEffect(on(
    () => currentStoryTime(),
    () => {
      const map = mapsStore.selectedMap;
      if (map && map.fleets && map.fleets.length > 0) {
        fleetManager.updateFleetPositions(map.fleets);
      }
    }
  ));

  // Refresh fleets when selection changes (to update blue circle indicator)
  createEffect(on(
    () => selectedFleetForMovement()?.id,
    () => {
      const map = mapsStore.selectedMap;
      if (map && map.fleets && map.fleets.length > 0) {
        fleetManager.refreshAllFleets(map.fleets);
        fleetManager.drawAllFleetPaths(map.fleets);
      }
    }
  ));

  // Re-render overlay when toggle or method changes
  createEffect(on(
    () => [showFactionOverlay(), overlayMethod()] as const,
    () => {
      updateVoronoiOverlay();
    },
    { defer: true }
  ));

  // Toggle landmark container interactivity based on creation mode
  createEffect(() => {
    const mode = creationMode();
    // Landmarks should be non-interactive in fleet mode
    landmarkManager.setInteractive(mode !== "fleet");
  });

  // Toggle hyperlane container interactivity based on creation mode
  createEffect(() => {
    const mode = creationMode();
    // Hyperlanes should be non-interactive in fleet mode
    hyperlaneManager.setInteractive(mode !== "fleet");
  });

  // Shift key detection for paint mode and Escape key for canceling operations
  createEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !e.repeat) {
        setIsShiftHeld(true);
      }

      // Cancel hyperlane creation with Escape
      if (e.key === 'Escape' && isCreatingHyperlane()) {
        setIsCreatingHyperlane(false);
        setCurrentHyperlaneSegments([]);
        setHyperlanePreviewEnd(null);
        hyperlaneManager.hidePreviewSegment();
        console.log("Hyperlane creation canceled");
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftHeld(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      setIsShiftHeld(false);
    };
  });

  // Brush visual preview effect
  createEffect(() => {
    const brushSprite = containers().brush;
    const vp = viewport();
    const enabled = paintModeEnabled();

    if (!brushSprite || !vp || !canvasContainer) return;

    if (enabled) {
      // Draw the brush circle (100px radius, semi-transparent)
      const brushRadiusPx = 100;
      brushSprite.clear();
      brushSprite.circle(0, 0, brushRadiusPx);
      brushSprite.fill({ color: 0xffffff, alpha: 0.2 });
      brushSprite.stroke({ color: 0xffffff, width: 2, alpha: 0.5 });

      // Add mouse move listener to update brush position
      const handleMouseMove = (e: MouseEvent) => {
        const rect = canvasContainer!.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // Convert screen to world coordinates
        const worldPos = vp.toWorld(screenX, screenY);
        brushSprite.position.set(worldPos.x, worldPos.y);
      };

      canvasContainer.addEventListener('mousemove', handleMouseMove);
      brushSprite.visible = true;

      // Cleanup function
      return () => {
        canvasContainer?.removeEventListener('mousemove', handleMouseMove);
        brushSprite.visible = false;
      };
    } else {
      brushSprite.visible = false;
    }
  });

  // Hyperlane preview effect - show preview line when creating hyperlane
  createEffect(() => {
    const vp = viewport();
    const sprite = mapSprite();
    const previewEnd = hyperlanePreviewEnd();
    const creating = isCreatingHyperlane();

    if (!vp || !sprite || !canvasContainer || !creating || !previewEnd) {
      hyperlaneManager.hidePreviewSegment();
      // Return empty cleanup to ensure previous event listener is removed
      return () => {};
    }

    const segments = currentHyperlaneSegments();
    if (segments.length === 0) {
      hyperlaneManager.hidePreviewSegment();
      // Return empty cleanup to ensure previous event listener is removed
      return () => {};
    }

    const lastSegment = segments[segments.length - 1];

    // Add mouse move listener to update preview
    const handleMouseMove = (e: MouseEvent) => {
      // Don't show preview if not creating
      if (!isCreatingHyperlane()) return;

      const rect = canvasContainer!.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Convert screen to world coordinates
      const worldPos = vp.toWorld(screenX, screenY);

      // Convert to normalized coordinates
      const normalizedX = worldPos.x / sprite.width;
      const normalizedY = worldPos.y / sprite.height;

      // Update preview segment from last point to mouse position
      hyperlaneManager.showPreviewSegment(
        lastSegment.startX,
        lastSegment.startY,
        normalizedX,
        normalizedY
      );
    };

    canvasContainer.addEventListener('mousemove', handleMouseMove);

    // Cleanup function
    return () => {
      canvasContainer?.removeEventListener('mousemove', handleMouseMove);
    };
  });

  // Path preview effect - show path preview when fleet is selected and mouse moves
  createEffect(() => {
    const fleet = selectedFleetForMovement();
    const vp = viewport();
    const sprite = mapSprite();

    if (!fleet || !vp || !sprite || !canvasContainer) {
      pathfinding.hidePathPreview();
      return () => {};
    }

    // Add mouse move listener to show path preview
    const handleMouseMove = (e: MouseEvent) => {
      const selectedFleet = selectedFleetForMovement();
      if (!selectedFleet) return;

      const rect = canvasContainer!.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Convert screen to world coordinates
      const worldPos = vp.toWorld(screenX, screenY);

      // Convert to normalized coordinates
      const normalizedX = worldPos.x / sprite.width;
      const normalizedY = worldPos.y / sprite.height;

      // Show path preview from fleet's current position to mouse position
      pathfinding.showPathPreview(selectedFleet, normalizedX, normalizedY);
    };

    canvasContainer.addEventListener('mousemove', handleMouseMove);

    // Cleanup function
    return () => {
      canvasContainer?.removeEventListener('mousemove', handleMouseMove);
      pathfinding.hidePathPreview();
    };
  });

  // Update landmark scales when viewport zoom changes
  createEffect(() => {
    const vp = viewport();
    if (!vp) return;

    const handleZoom = () => {
      const zoomLevel = vp.scale.x; // x and y scale should be the same
      landmarkManager.updateLandmarkScales(zoomLevel);
    };

    // Call once initially
    handleZoom();

    // Listen for zoom changes
    vp.on('zoomed', handleZoom);

    return () => {
      vp.off('zoomed', handleZoom);
    };
  });

  onCleanup(() => {
    // Clean up timeline debounce timer
    if (timelineDebounceTimer !== null) {
      clearTimeout(timelineDebounceTimer);
    }
    // Cancel any progressive rendering
    cancelAnimation(distanceFieldAnimation());
  });

  return (
    <Show when={mapsStore.showMaps}>
      <div class={styles.mapsPanel}>
        <MapControls
          showAddMap={showAddMap}
          setShowAddMap={setShowAddMap}
          newMapName={newMapName}
          setNewMapName={setNewMapName}
          newMapBorderColor={newMapBorderColor}
          setNewMapBorderColor={setNewMapBorderColor}
          selectedFileName={selectedFileName}
          editingBorderColor={editingBorderColor}
          setEditingBorderColor={setEditingBorderColor}
          editBorderColorValue={editBorderColorValue}
          setEditBorderColorValue={setEditBorderColorValue}
          onFileSelect={handleFileSelect}
          onAddMap={handleAddMap}
        />

        <MapTimeline
          story={() => currentStoryStore}
          nodes={() => nodeStore.nodesArray}
          currentStoryTime={currentStoryTime}
          pendingStoryTime={pendingStoryTime}
          storyTimesWithStates={storyTimesWithStates}
          fleetMovementTimes={fleetMovementTimes}
          onTimelineChange={handleTimelineChange}
          onStep={stepTimeline}
          onReset={() => {
            // Cancel any pending update
            if (timelineDebounceTimer !== null) {
              clearTimeout(timelineDebounceTimer);
              timelineDebounceTimer = null;
            }
            setPendingStoryTime(null);
            mapsStore.resetStoryTime();
          }}
        />

        <div class={styles.mapViewer}>
          <div class={styles.mapContainer}>
            <Show when={!mapsStore.selectedMap}>
              <div class={styles.noMapMessage}>
                Select a map or add a new one to get started
              </div>
            </Show>
            <div
              ref={canvasContainer}
              class={styles.mapCanvas}
              style={{ display: mapsStore.selectedMap ? "block" : "none" }}
            ></div>
            {/* Creation Mode Toggle */}
            <Show when={mapsStore.selectedMap}>
              <div class={styles.creationModeToggle}>
                <button
                  class={`${styles.modeButton} ${creationMode() === "landmark" ? styles.active : ""}`}
                  onClick={() => {
                    setCreationMode("landmark");
                    // Clear any ongoing fleet creation
                    setIsAddingFleet(false);
                    setSelectedFleet(null);
                    // Clear any ongoing hyperlane creation
                    setIsCreatingHyperlane(false);
                    setCurrentHyperlaneSegments([]);
                    setHyperlanePreviewEnd(null);
                    hyperlaneManager.hidePreviewSegment();
                  }}
                  title="Click map to add landmarks"
                >
                  Add Landmark
                </button>
                <button
                  class={`${styles.modeButton} ${creationMode() === "fleet" ? styles.active : ""}`}
                  onClick={() => {
                    setCreationMode("fleet");
                    // Clear any ongoing landmark creation
                    setIsAddingNew(false);
                    setSelectedLandmark(null);
                    mapInteractions.hidePreview();
                    // Clear any ongoing hyperlane creation
                    setIsCreatingHyperlane(false);
                    setCurrentHyperlaneSegments([]);
                    setHyperlanePreviewEnd(null);
                    hyperlaneManager.hidePreviewSegment();
                  }}
                  title="Click map to add fleets"
                >
                  Add Fleet
                </button>
                <button
                  class={`${styles.modeButton} ${creationMode() === "hyperlane" ? styles.active : ""}`}
                  onClick={() => {
                    setCreationMode("hyperlane");
                    // Clear any ongoing landmark creation
                    setIsAddingNew(false);
                    setSelectedLandmark(null);
                    mapInteractions.hidePreview();
                    // Clear any ongoing fleet creation
                    setIsAddingFleet(false);
                    setSelectedFleet(null);
                    // Reset hyperlane creation state (allows canceling and restarting)
                    setIsCreatingHyperlane(false);
                    setCurrentHyperlaneSegments([]);
                    setHyperlanePreviewEnd(null);
                    hyperlaneManager.hidePreviewSegment();
                  }}
                  title="Right-click to draw hyperlane routes"
                >
                  Add Hyperlane
                </button>
                <Show when={creationMode() === "hyperlane"}>
                  <div class={styles.hyperlaneStatus}>
                    Status: {hyperlaneCreationStatus()}
                  </div>
                </Show>
              </div>
            </Show>

            <FactionOverlayControls
              showFactionOverlay={showFactionOverlay}
              setShowFactionOverlay={setShowFactionOverlay}
              overlayMethod={overlayMethod}
              setOverlayMethod={setOverlayMethod}
              paintModeEnabled={paintModeEnabled}
              setPaintModeEnabled={setPaintModeEnabled}
              selectedPaintFaction={selectedPaintFaction}
              setSelectedPaintFaction={setSelectedPaintFaction}
            />
          </div>

          <LandmarksList
            sortedLandmarks={sortedLandmarks}
            selectedLandmark={selectedLandmark}
            sortAscending={sortAscending}
            setSortAscending={setSortAscending}
            onFocusLandmark={focusOnLandmark}
          />
        </div>

        <LandmarkPopup
          popupRef={popupElement}
          selectedLandmark={selectedLandmark}
          isAddingNew={isAddingNew}
          popupPosition={popupPosition}
          isEditing={isEditing}
          isDeleting={isDeleting}
          isSaving={isSaving}
          isFetchingLandmarkInfo={isFetchingLandmarkInfo}
          isSavingAllegiance={isSavingAllegiance}
          editName={editName}
          setEditName={setEditName}
          editDescription={editDescription}
          setEditDescription={setEditDescription}
          editColor={editColor}
          setEditColor={setEditColor}
          editSize={editSize}
          setEditSize={setEditSize}
          editType={editType}
          setEditType={setEditType}
          editPopulation={editPopulation}
          handlePopulationInput={handlePopulationInput}
          populationError={populationError}
          editIndustry={editIndustry}
          setEditIndustry={setEditIndustry}
          editPlanetaryBodies={editPlanetaryBodies}
          setEditPlanetaryBodies={setEditPlanetaryBodies}
          editRegion={editRegion}
          setEditRegion={setEditRegion}
          editSector={editSector}
          setEditSector={setEditSector}
          quickColors={quickColors}
          parsePopulation={parsePopulation}
          formatPopulation={formatPopulation}
          validatePopulation={validatePopulation}
          currentMessageId={currentMessageId}
          selectedAllegiance={selectedAllegiance}
          allegianceAtThisMessage={allegianceAtThisMessage}
          allegianceSourceMessageId={allegianceSourceMessageId}
          onStartEditing={startEditing}
          onSaveLandmark={saveLandmark}
          onCancelEditing={cancelEditing}
          onDeleteLandmark={deleteLandmark}
          onFetchLandmarkInfo={fetchLandmarkInfo}
          onJumpToMessage={jumpToMessage}
          onSaveAllegiance={saveAllegiance}
        />

        <FleetPopup
          selectedFleet={selectedFleet}
          isAddingFleet={isAddingFleet}
          popupPosition={popupPosition}
          isEditing={isEditing}
          isDeleting={isDeleting}
          isSaving={isSaving}
          editName={editName}
          setEditName={setEditName}
          editDescription={editDescription}
          setEditDescription={setEditDescription}
          editDesignation={editDesignation}
          setEditDesignation={setEditDesignation}
          editHyperdriveRating={editHyperdriveRating}
          setEditHyperdriveRating={setEditHyperdriveRating}
          hyperdriveError={hyperdriveError}
          editColor={editColor}
          setEditColor={setEditColor}
          editSize={editSize}
          setEditSize={setEditSize}
          editVariant={editVariant}
          setEditVariant={setEditVariant}
          quickColors={quickColors}
          currentStoryTime={currentStoryTime}
          isDeletingMovement={isDeletingMovement}
          onStartEditing={startEditingFleet}
          onSaveFleet={saveFleet}
          onCancelEditing={cancelEditingFleet}
          onDeleteFleet={deleteFleet}
          onDeleteActiveMovement={deleteActiveMovement}
        />

        <HyperlanePopup
          selectedHyperlane={selectedHyperlane}
          popupPosition={popupPosition}
          landmarks={() => mapsStore.selectedMap?.landmarks || []}
          isEditing={isEditing}
          isDeleting={isDeleting}
          isSaving={isSaving}
          editSpeedMultiplier={editSpeedMultiplier}
          setEditSpeedMultiplier={setEditSpeedMultiplier}
          speedMultiplierError={speedMultiplierError}
          onStartEditing={startEditingHyperlane}
          onSaveHyperlane={saveHyperlaneEdit}
          onCancelEditing={cancelEditingHyperlane}
          onDeleteHyperlane={deleteHyperlaneEdit}
          onQuickSaveSpeedMultiplier={quickSaveSpeedMultiplier}
        />
      </div>
    </Show>
  );
};
