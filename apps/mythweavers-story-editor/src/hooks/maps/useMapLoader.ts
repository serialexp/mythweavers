import { Viewport } from 'pixi-viewport'
import * as PIXI from 'pixi.js'
import { Accessor, createSignal } from 'solid-js'
import { Landmark } from '../../types/core'
import { DIAGNOSTIC_GRID_LABEL, drawDiagnosticGrid } from '../../utils/maps/diagnosticGrid'
import { MapError, checkTextureFit, describeError, getMaxTextureSize } from '../../utils/maps/mapDiagnostics'
import { PixiContainers } from './usePixiMap'

export interface UseMapLoaderReturn {
  mapSprite: Accessor<PIXI.Sprite | null>
  /** Set when the map image could not be shown. Null while healthy. */
  error: Accessor<MapError | null>
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
  const [error, setError] = createSignal<MapError | null>(null)

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

    setError(null)

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

    // loadMap is called unawaited from an effect, so anything thrown below used
    // to vanish as an unhandled rejection and leave a blank canvas behind.
    try {
      // For blob URLs, we need to load the image manually since PIXI can't detect the type
      if (imageData.startsWith('blob:')) {
        texture = await new Promise<PIXI.Texture>((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            resolve(PIXI.Texture.from(img))
          }
          img.onerror = () => {
            // The error argument of img.onerror carries no useful detail, so
            // don't interpolate it -- it stringifies to "[object Event]".
            reject(new Error('The browser could not decode the image'))
          }
          img.src = imageData
        })
      } else {
        // For regular URLs with extensions, use PIXI.Assets
        texture = await PIXI.Assets.load(imageData)
      }
    } catch (err) {
      console.error('[useMapLoader] Failed to load texture', err)
      setError({
        title: 'The map image could not be loaded',
        detail: `${describeError(err)}. The file may be missing, still uploading, or in a format this browser cannot read.`,
      })
      return
    }

    if (!texture) {
      console.error('[useMapLoader] Failed to load texture')
      setError({
        title: 'The map image could not be loaded',
        detail: 'The image finished loading but produced no texture. It may be corrupt or zero-sized.',
      })
      return
    }

    // Oversize textures are not an exception -- the GPU silently drops the
    // upload and the sprite draws as a black quad, which is indistinguishable
    // from a dead renderer. Refuse to add it and say why instead.
    const oversize = checkTextureFit(texture.width, texture.height, getMaxTextureSize())
    if (oversize) {
      console.error('[useMapLoader]', oversize.title, texture.width, texture.height)
      setError(oversize)
      return
    }

    const sprite = new PIXI.Sprite(texture)

    // Add map to viewport (behind landmarks) before accessing dimensions
    viewport.addChildAt(sprite, 0)

    setMapSprite(sprite)

    // Fit viewport to map using texture dimensions (sprite dimensions may not be ready yet)
    viewport.worldWidth = texture.width
    viewport.worldHeight = texture.height

    // Re-scale the grid to the map that actually loaded, so its bounds
    // rectangle marks where the image should be rather than the 2000x2000
    // placeholder the viewport starts with.
    const grid = viewport.getChildByLabel(DIAGNOSTIC_GRID_LABEL)
    if (grid instanceof PIXI.Graphics) {
      drawDiagnosticGrid(grid, texture.width, texture.height)
    }
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
    error,
    loadMap,
  }
}
