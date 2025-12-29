import { Viewport } from 'pixi-viewport'
import * as PIXI from 'pixi.js'
import { Accessor, createSignal } from 'solid-js'
import { Landmark } from '../../types/core'
import { PixiContainers } from './usePixiMap'

export interface UseMapLoaderReturn {
  mapSprite: Accessor<PIXI.Sprite | null>
  loadMap: (
    imageData: string,
    viewport: Viewport,
    containers: PixiContainers,
    onLandmarksLoad?: (addLandmark: (landmark: Landmark) => void) => void,
    onInteractionsSetup?: () => void,
  ) => Promise<void>
}

/**
 * Hook to manage map loading and sprite lifecycle
 */
export function useMapLoader(): UseMapLoaderReturn {
  const [mapSprite, setMapSprite] = createSignal<PIXI.Sprite | null>(null)

  const loadMap = async (
    imageData: string,
    viewport: Viewport,
    containers: PixiContainers,
    onLandmarksLoad?: (addLandmark: (landmark: Landmark) => void) => void,
    onInteractionsSetup?: () => void,
  ) => {
    const landmarkContainer = containers.landmark
    const labelContainer = containers.label
    if (!landmarkContainer) return

    // Clear existing map
    const currentSprite = mapSprite()
    if (currentSprite) {
      viewport.removeChild(currentSprite)
      currentSprite.destroy()
    }

    // Clear existing landmarks and labels
    landmarkContainer.removeChildren()
    if (labelContainer) {
      labelContainer.removeChildren()
    }

    // Load new map texture
    let texture: PIXI.Texture

    // For blob URLs, we need to load the image manually since PIXI can't detect the type
    if (imageData.startsWith('blob:')) {
      texture = await new Promise<PIXI.Texture>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          resolve(PIXI.Texture.from(img))
        }
        img.onerror = (err) => {
          reject(new Error(`Failed to load image: ${err}`))
        }
        img.src = imageData
      })
    } else {
      // For regular URLs with extensions, use PIXI.Assets
      texture = await PIXI.Assets.load(imageData)
    }

    if (!texture) {
      console.error('[useMapLoader] Failed to load texture')
      return
    }
    const sprite = new PIXI.Sprite(texture)

    // Add map to viewport (behind landmarks) before accessing dimensions
    viewport.addChildAt(sprite, 0)

    setMapSprite(sprite)

    // Fit viewport to map using texture dimensions (sprite dimensions may not be ready yet)
    viewport.worldWidth = texture.width
    viewport.worldHeight = texture.height
    viewport.fit()
    viewport.moveCenter(texture.width / 2, texture.height / 2)

    // Setup viewport interactions (if callback provided)
    if (onInteractionsSetup) {
      onInteractionsSetup()
    }

    // Load landmarks (if callback provided)
    if (onLandmarksLoad) {
      onLandmarksLoad(() => {
        // This callback will be provided by the parent component
        // to add individual landmarks
      })
    }
  }

  return {
    mapSprite,
    loadMap,
  }
}
