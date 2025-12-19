import type { Node } from '@writer/shared'
import { createSignal } from 'solid-js'
import { locationsState } from '../../lib/stores/locations'
import { addNotification } from '../../lib/stores/notifications'
import { scenesState, updateSceneData } from '../../lib/stores/scenes'
import { treeState } from '../../lib/stores/tree'
import { findPathToNode } from '../../lib/stores/tree'
import { LocationSelect } from '../LocationSelect'
import { extractLocationFromScene } from './actions/extractLocationFromScene'

// Add location selection UI to SnowflakeItem
export const LocationList = (props: { node: Node }) => {
  const scene = scenesState.scenes[props.node.id]
  const [isOpen, setIsOpen] = createSignal(false)
  const [extractingLocation, setExtractingLocation] = createSignal(false)

  const getPreviousScene = () => {
    const path = findPathToNode(props.node.id)
    if (!path) return null

    const [bookNode, arcNode, chapterNode] = path
    const book = treeState.structure.find((b) => b.id === bookNode.id)
    const arc = book?.children?.find((a) => a.id === arcNode.id)
    const chapter = arc?.children?.find((c) => c.id === chapterNode.id)
    if (!chapter) return null

    const scenes = chapter.children ?? []
    const currentIndex = scenes.findIndex((s) => s.id === props.node.id)

    // Get previous scene from current chapter
    if (currentIndex > 0) {
      return scenesState.scenes[scenes[currentIndex - 1].id]
    }

    // Get last scene from previous chapter
    const chapters = arc?.children ?? []
    const chapterIndex = chapters.findIndex((c) => c.id === chapter.id)
    if (chapterIndex > 0) {
      const previousChapter = chapters[chapterIndex - 1]
      const previousChapterScenes = previousChapter.children ?? []
      if (previousChapterScenes.length > 0) {
        return scenesState.scenes[previousChapterScenes[previousChapterScenes.length - 1].id]
      }
    }

    return null
  }

  const copyLocationFromPreviousScene = () => {
    const previousScene = getPreviousScene()
    if (!previousScene?.locationId) {
      addNotification({
        type: 'warning',
        title: 'No Location to Copy',
        message: 'Previous scene has no location.',
      })
      return
    }

    updateSceneData(props.node.id, {
      locationId: previousScene.locationId,
    })

    addNotification({
      type: 'success',
      title: 'Location Copied',
      message: 'Location from previous scene has been added.',
    })
  }

  return (
    <div class="flex flex-col gap-2">
      {/* Location */}
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold">Location:</span>
        <div
          class="dropdown dropdown-start"
          classList={{
            'dropdown-open': isOpen(),
          }}
        >
          <button type="button" class="btn btn-ghost btn-xs" title="Set location" onClick={() => setIsOpen(!isOpen())}>
            {scene.locationId ? 'Change' : '+'}
          </button>
          <div class="dropdown-content z-[1] p-2 shadow bg-base-100 rounded-box w-[400px]">
            <LocationSelect
              placeholder="Select location..."
              value={scene.locationId}
              onChange={(locationId) => {
                updateSceneData(props.node.id, {
                  locationId: locationId || undefined,
                })
                setIsOpen(false)
              }}
            />
          </div>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          onClick={copyLocationFromPreviousScene}
          title="Copy location from previous scene"
        >
          ⬆️
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          disabled={extractingLocation()}
          onClick={async () => {
            setExtractingLocation(true)
            try {
              const locationId = await extractLocationFromScene(props.node)
              if (locationId) {
                updateSceneData(props.node.id, {
                  locationId,
                })
              }
            } catch (error) {
              addNotification({
                type: 'error',
                title: 'Error extracting location',
                message: error instanceof Error ? error.message : 'Unknown error',
              })
            } finally {
              setExtractingLocation(false)
            }
          }}
          title="Extract location from scene content"
        >
          {extractingLocation() ? <span class="loading loading-spinner loading-xs" /> : '🔍'}
        </button>
      </div>
      {scene.locationId && (
        <div class="flex flex-wrap gap-1">
          <div class="badge gap-1 badge-primary">
            {locationsState.locations[scene.locationId]?.name}
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onClick={() => {
                updateSceneData(props.node.id, {
                  locationId: undefined,
                })
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
