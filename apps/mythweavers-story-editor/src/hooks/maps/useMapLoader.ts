import { Viewport } from 'pixi-viewport'
import * as PIXI from 'pixi.js'
import { Accessor, createSignal } from 'solid-js'
import { Landmark } from '../../types/core'
import { DIAGNOSTIC_GRID_LABEL, drawDiagnosticGrid } from '../../utils/maps/diagnosticGrid'
import { MapError, checkTextureFit, describeError, getMaxTextureSize } from '../../utils/maps/mapDiagnostics'
import { PixiContainers } from './usePixiMap'

/**
 * World size used when there is no image to measure. Landmarks are stored as
 * normalised 0..1 coordinates, so any square extent places them in the right
 * positions relative to each other -- only the aspect ratio is a guess, and a
 * guess is worth more than showing nothing.
 */
const PLACEHOLDER_EXTENT = 2000

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

    /**
     * Everything that has to happen once the world extent is known, with or
     * without a picture. Landmark positions are multiplied by the sprite's
     * dimensions and the interaction handlers convert screen coordinates
     * through the same sprite, so both are downstream of a sprite existing --
     * but neither needs that sprite to have an image in it.
     */
    const settle = (sprite: PIXI.Sprite, width: number, height: number) => {
      // Add map to viewport (behind landmarks) before accessing dimensions
      viewport.addChildAt(sprite, 0)
      setMapSprite(sprite)

      // Fit viewport to map using texture dimensions (sprite dimensions may not be ready yet)
      viewport.worldWidth = width
      viewport.worldHeight = height

      // Re-scale the grid to the map that actually loaded, so its bounds
      // rectangle marks where the image should be rather than the 2000x2000
      // placeholder the viewport starts with.
      const grid = viewport.getChildByLabel(DIAGNOSTIC_GRID_LABEL)
      if (grid instanceof PIXI.Graphics) {
        drawDiagnosticGrid(grid, width, height)
      }
      viewport.fit()
      viewport.moveCenter(width / 2, height / 2)

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

    /**
     * Stands in for a map whose image cannot be shown. Texture.WHITE is a 1x1
     * pixel scaled to the placeholder extent and then hidden: it exists purely
     * to give landmarks and hit-testing a coordinate space, so the diagnostic
     * grid stays visible through it rather than being painted over.
     *
     * Without this, a broken image took the landmarks down with it -- they are
     * stored independently of the picture and are perfectly renderable, but
     * every consumer reads its dimensions from the sprite.
     */
    const settleWithoutImage = () => {
      const placeholder = new PIXI.Sprite(PIXI.Texture.WHITE)
      placeholder.width = PLACEHOLDER_EXTENT
      placeholder.height = PLACEHOLDER_EXTENT
      placeholder.visible = false
      settle(placeholder, PLACEHOLDER_EXTENT, PLACEHOLDER_EXTENT)
    }

    // No image to try. The store already recorded why, so don't overwrite its
    // more specific explanation with a generic one here.
    if (!imageData) {
      settleWithoutImage()
      return
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
      settleWithoutImage()
      return
    }

    if (!texture) {
      console.error('[useMapLoader] Failed to load texture')
      setError({
        title: 'The map image could not be loaded',
        detail: 'The image finished loading but produced no texture. It may be corrupt or zero-sized.',
      })
      settleWithoutImage()
      return
    }

    // Oversize textures are not an exception -- the GPU silently drops the
    // upload and the sprite draws as a black quad, which is indistinguishable
    // from a dead renderer. Refuse to add it and say why instead.
    const oversize = checkTextureFit(texture.width, texture.height, getMaxTextureSize())
    if (oversize) {
      console.error('[useMapLoader]', oversize.title, texture.width, texture.height)
      setError(oversize)
      // Deliberately the real dimensions, not the placeholder: the landmarks
      // then sit where they belong on a map we simply cannot paint.
      const blank = new PIXI.Sprite(PIXI.Texture.WHITE)
      blank.width = texture.width
      blank.height = texture.height
      blank.visible = false
      settle(blank, texture.width, texture.height)
      return
    }

    settle(new PIXI.Sprite(texture), texture.width, texture.height)
  }

  return {
    mapSprite,
    error,
    loadMap,
  }
}
