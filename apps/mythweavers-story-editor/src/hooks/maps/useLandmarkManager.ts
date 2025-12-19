import { Viewport } from 'pixi-viewport'
import * as PIXI from 'pixi.js'
import { Accessor } from 'solid-js'
import { Landmark } from '../../types/core'
import { parseColorToHex } from '../../utils/maps/colorUtils'
import {
  LandmarkSprite,
  createLabelText,
  createLandmarkSprite,
  landmarkHasChanged,
  positionLandmark,
} from '../../utils/maps/landmarkRenderer'
import { PixiContainers } from './usePixiMap'

export type LandmarkClickHandler = (landmark: Landmark, screenPos: { x: number; y: number }, button: number) => void

export interface UseLandmarkManagerOptions {
  viewport: Accessor<Viewport | null>
  containers: Accessor<PixiContainers>
  mapSprite: Accessor<PIXI.Sprite | null>
  canvasContainer: Accessor<HTMLDivElement | undefined>
  evaluateBorderColor: (landmarkName: string) => string
  onLandmarkClick?: LandmarkClickHandler
  shouldStopPropagation?: () => boolean
  interactive?: () => boolean
}

export interface UseLandmarkManagerReturn {
  addLandmark: (landmark: Landmark) => void
  removeLandmark: (landmarkId: string) => void
  updateLandmark: (landmark: Landmark, forceBorderColorCheck?: boolean) => void
  clearAllLandmarks: () => void
  refreshAllLandmarks: (landmarks: Landmark[]) => void
  updateLandmarkScales: (zoomLevel: number) => void
  setInteractive: (interactive: boolean) => void
}

/**
 * Hook to manage landmark sprites on the map
 */
export function useLandmarkManager(options: UseLandmarkManagerOptions): UseLandmarkManagerReturn {
  const {
    viewport,
    containers,
    mapSprite,
    canvasContainer,
    evaluateBorderColor,
    onLandmarkClick,
    shouldStopPropagation,
    interactive,
  } = options

  const addLandmark = (landmark: Landmark) => {
    const landmarkContainer = containers().landmark
    const labelContainer = containers().label
    const sprite = mapSprite()
    if (!landmarkContainer || !sprite) return

    // Get border color from template (if any)
    const borderColor = evaluateBorderColor(landmark.name)

    // Evaluate the interactive state at creation time
    const isInteractive = interactive ? interactive() : true

    // Create the sprite using the imported utility
    const landmarkSprite = createLandmarkSprite(landmark, {
      borderColor,
      parseColorToHex,
      shouldStopPropagation: shouldStopPropagation ? shouldStopPropagation() : true,
      interactive: isInteractive,
      onPointerDown: (lm, e) => {
        if (onLandmarkClick) {
          const vp = viewport()
          if (!vp) return
          const screenPos = vp.toScreen(landmarkSprite.position)
          const container = canvasContainer()
          const baseX = screenPos.x + (container?.offsetLeft || 0)
          const baseY = screenPos.y + (container?.offsetTop || 0)
          onLandmarkClick(lm, { x: baseX, y: baseY }, e.button)
        }
      },
    })

    // Create and add label
    const labelText = createLabelText(landmark, landmark.size === 'large' ? 16 : landmark.size === 'small' ? 8 : 12)
    landmarkSprite.labelText = labelText

    // Position the sprite and label
    positionLandmark(landmarkSprite, landmark, sprite.width, sprite.height)

    // Add to containers
    landmarkContainer.addChild(landmarkSprite)
    if (labelContainer) {
      labelContainer.addChild(labelText)
    }
  }

  const removeLandmark = (landmarkId: string) => {
    const landmarkContainer = containers().landmark
    const labelContainer = containers().label
    if (!landmarkContainer) return

    const existingSprites = landmarkContainer.children as LandmarkSprite[]
    const spriteToRemove = existingSprites.find((s) => s.landmarkData?.id === landmarkId)

    if (spriteToRemove) {
      landmarkContainer.removeChild(spriteToRemove)
      if (spriteToRemove.labelText && labelContainer) {
        labelContainer.removeChild(spriteToRemove.labelText)
      }
    }
  }

  const updateLandmark = (landmark: Landmark, forceBorderColorCheck = false) => {
    const landmarkContainer = containers().landmark
    const labelContainer = containers().label
    if (!landmarkContainer) return

    const existingSprites = landmarkContainer.children as LandmarkSprite[]
    const existingSprite = existingSprites.find((s) => s.landmarkData?.id === landmark.id)

    if (existingSprite?.landmarkData) {
      const hasChanged = landmarkHasChanged(existingSprite.landmarkData, landmark)

      // Also check if border color changed (for allegiance updates)
      // When allegiance changes, we need to re-render to pick up the new border color
      let borderColorChanged = false
      if (forceBorderColorCheck) {
        borderColorChanged = true
      }

      if (hasChanged || borderColorChanged) {
        // Remove old sprite
        landmarkContainer.removeChild(existingSprite)
        if (existingSprite.labelText && labelContainer) {
          labelContainer.removeChild(existingSprite.labelText)
        }
        // Add updated sprite
        addLandmark(landmark)
      } else {
        // Update the stored landmark data copy even if visual hasn't changed
        existingSprite.landmarkData = { ...landmark }
      }
    } else {
      // New landmark
      addLandmark(landmark)
    }
  }

  const clearAllLandmarks = () => {
    const landmarkContainer = containers().landmark
    const labelContainer = containers().label
    if (landmarkContainer) {
      landmarkContainer.removeChildren()
    }
    if (labelContainer) {
      labelContainer.removeChildren()
    }
  }

  const refreshAllLandmarks = (landmarks: Landmark[]) => {
    clearAllLandmarks()
    landmarks.forEach((landmark) => {
      addLandmark(landmark)
    })
  }

  const updateLandmarkScales = (zoomLevel: number) => {
    const landmarkContainer = containers().landmark
    if (!landmarkContainer) return

    // Calculate scale factor - use square root for gentler scaling
    // At zoom 1x: scale = 1
    // At zoom 2x: scale = 0.71
    // At zoom 4x: scale = 0.5
    const scaleFactor = 1 / Math.sqrt(Math.max(1, zoomLevel))

    // Update all landmark sprites
    const sprites = landmarkContainer.children as LandmarkSprite[]
    for (const sprite of sprites) {
      sprite.baseScale = scaleFactor // Update base scale for hover effects
      sprite.scale.set(scaleFactor)
    }

    // Update label positions based on new scale
    const labelContainer = containers().label
    if (labelContainer) {
      const labels = labelContainer.children as PIXI.Text[]
      for (const label of labels) {
        // Find the corresponding sprite
        const sprite = sprites.find((s) => s.labelText === label)
        if (sprite?.landmarkData) {
          const radius = sprite.landmarkData.size === 'large' ? 16 : sprite.landmarkData.size === 'small' ? 8 : 12
          label.y = sprite.y - radius * scaleFactor - 8
        }
      }
    }
  }

  const setInteractive = (interactive: boolean) => {
    const landmarkContainer = containers().landmark
    if (!landmarkContainer) return

    // Only control interactiveChildren - don't set eventMode on the container itself
    // This allows the viewport to handle drag events even when children are non-interactive
    landmarkContainer.interactiveChildren = interactive
  }

  return {
    addLandmark,
    removeLandmark,
    updateLandmark,
    clearAllLandmarks,
    refreshAllLandmarks,
    updateLandmarkScales,
    setInteractive,
  }
}
