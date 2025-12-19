import type { Character } from '@writer/shared'
import { getOrderedSceneIds } from '../lib/selectors/orderedSceneIds'
import { setSelectedCharacterId } from '../lib/stores/characters'
import { scenesState } from '../lib/stores/scenes'
import { treeState } from '../lib/stores/tree'
import type { CharacterVersion } from '../lib/utils/character-versions'

interface CharacterTimelineProps {
  versions: CharacterVersion[]
  onRemoveAction?: (character: Character, timestamp: number) => void
}

export function CharacterTimeline(props: CharacterTimelineProps) {
  const renderActionsList = (version: CharacterVersion) => {
    const { character } = version
    if (!character.significantActions?.length) {
      return <div class="text-gray-500 text-center py-4">No significant actions recorded for this version yet.</div>
    }

    const orderedSceneIds = getOrderedSceneIds(treeState.structure)
    return [...character.significantActions]
      .sort((a, b) => {
        const aIndex = orderedSceneIds.indexOf(a.sceneId)
        const bIndex = orderedSceneIds.indexOf(b.sceneId)
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })
      .map((action) => {
        const path = treeState.structure.flatMap(
          (book) =>
            book.children?.flatMap(
              (arc) =>
                arc.children?.flatMap(
                  (chapter) => chapter.children?.filter((scene) => scene.id === action.sceneId) || [],
                ) || [],
            ) || [],
        )
        const scene = path[0]
        const sceneData = scenesState.scenes[action.sceneId]

        return (
          <div class="card bg-base-300">
            <div class="card-body p-4">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <p class="text-sm">{action.action}</p>
                  {scene && (
                    <div class="text-xs text-gray-500 mt-1">
                      Scene: {scene.name || sceneData?.title || 'Unnamed Scene'}
                    </div>
                  )}
                </div>
                <div class="text-xs text-gray-500">{new Date(action.timestamp).toLocaleString()}</div>
                {version.type === 'current' && props.onRemoveAction ? (
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs text-error"
                    onClick={() => props.onRemoveAction?.(character, action.timestamp)}
                    title="Remove action"
                  >
                    ×
                  </button>
                ) : (
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    onClick={() => setSelectedCharacterId(character.id)}
                    title="View character version"
                  >
                    👁️
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })
  }

  const renderVersion = (version: CharacterVersion) => {
    const { character, type, index } = version
    const title = [
      character.firstName,
      character.middleName,
      character.lastName,
      character.nickname ? `"${character.nickname}"` : undefined,
    ]
      .filter(Boolean)
      .join(' ')

    if (type === 'current') {
      return (
        <div class="space-y-2 mb-4">
          <div class="font-semibold">Current Timeline</div>
          <div class="space-y-2">{renderActionsList(version)}</div>
        </div>
      )
    }

    const timelineLabel = type === 'past' ? 'Timeline' : 'Future Timeline'

    return (
      <div class="mb-4">
        <details class="collapse collapse-arrow bg-base-200" open>
          <summary class="collapse-title font-medium">
            {timelineLabel} {index}: {title}
          </summary>
          <div class="collapse-content">
            <div class="space-y-2">{renderActionsList(version)}</div>
          </div>
        </details>
      </div>
    )
  }

  return (
    <div>
      <div class="divider">Significant Actions</div>
      <div>{props.versions.map((version) => renderVersion(version))}</div>
    </div>
  )
}
