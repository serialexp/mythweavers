import { Accessor, createSignal } from "solid-js";
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import { PixiContainers } from "./usePixiMap";
import { Landmark } from "../../types/core";

export interface UseMapLoaderReturn {
  mapSprite: Accessor<PIXI.Sprite | null>;
  loadMap: (
    imageData: string,
    viewport: Viewport,
    containers: PixiContainers,
    onLandmarksLoad?: (addLandmark: (landmark: Landmark) => void) => void,
    onInteractionsSetup?: () => void
  ) => Promise<void>;
}

/**
 * Hook to manage map loading and sprite lifecycle
 */
export function useMapLoader(): UseMapLoaderReturn {
  const [mapSprite, setMapSprite] = createSignal<PIXI.Sprite | null>(null);

  const loadMap = async (
    imageData: string,
    viewport: Viewport,
    containers: PixiContainers,
    onLandmarksLoad?: (addLandmark: (landmark: Landmark) => void) => void,
    onInteractionsSetup?: () => void
  ) => {
    const landmarkContainer = containers.landmark;
    const labelContainer = containers.label;
    if (!landmarkContainer) return;

    // Clear existing map
    const currentSprite = mapSprite();
    if (currentSprite) {
      viewport.removeChild(currentSprite);
      currentSprite.destroy();
    }

    // Clear existing landmarks and labels
    landmarkContainer.removeChildren();
    if (labelContainer) {
      labelContainer.removeChildren();
    }

    // Load new map texture
    const texture = await PIXI.Assets.load(imageData);
    const sprite = new PIXI.Sprite(texture);

    // Add map to viewport (behind landmarks) before accessing dimensions
    viewport.addChildAt(sprite, 0);

    setMapSprite(sprite);

    // Fit viewport to map using texture dimensions (sprite dimensions may not be ready yet)
    viewport.worldWidth = texture.width;
    viewport.worldHeight = texture.height;
    viewport.fit();
    viewport.moveCenter(texture.width / 2, texture.height / 2);

    // Setup viewport interactions (if callback provided)
    if (onInteractionsSetup) {
      onInteractionsSetup();
    }

    // Load landmarks (if callback provided)
    if (onLandmarksLoad) {
      onLandmarksLoad(() => {
        // This callback will be provided by the parent component
        // to add individual landmarks
      });
    }
  };

  return {
    mapSprite,
    loadMap,
  };
}
