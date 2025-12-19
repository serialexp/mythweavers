import type { Node } from '@writer/shared'
import { For, createSignal } from 'solid-js'
import { charactersState } from '../../lib/stores/characters'
import { addNotification } from '../../lib/stores/notifications'
import { scenesState, updateSceneData } from '../../lib/stores/scenes'
import { treeState } from '../../lib/stores/tree'
import { findPathToNode } from '../../lib/stores/tree'
import { CharacterSelect } from '../CharacterSelect'
import { extractCharactersFromScene } from './actions/extractCharactersFromScene'

// Add character selection UI to SnowflakeItem
export const CharacterList = (props: { node: Node }) => {
  const scene = scenesState.scenes[props.node.id]
  const characters = () => scene?.characterIds ?? []
  const referredCharacters = () => scene?.referredCharacterIds ?? []
  const [extractingCharacters, setExtractingCharacters] = createSignal(false)
  const [openDropdowns, setOpenDropdowns] = createSignal<Record<'perspective' | 'present' | 'referred', boolean>>({
    perspective: false,
    present: false,
    referred: false,
  })

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

  const copyCharactersFromPreviousScene = () => {
    const previousScene = getPreviousScene()
    if (!previousScene?.characterIds?.length) {
      addNotification({
        type: 'warning',
        title: 'No Characters to Copy',
        message: 'Previous scene has no characters.',
      })
      return
    }

    updateSceneData(props.node.id, {
      characterIds: [...new Set([...characters(), ...previousScene.characterIds])],
    })

    addNotification({
      type: 'success',
      title: 'Characters Copied',
      message: 'Characters from previous scene have been added.',
    })
  }

  const copyReferredCharactersFromPreviousScene = () => {
    const previousScene = getPreviousScene()
    if (!previousScene?.referredCharacterIds?.length) {
      addNotification({
        type: 'warning',
        title: 'No Referred Characters to Copy',
        message: 'Previous scene has no referred characters.',
      })
      return
    }

    updateSceneData(props.node.id, {
      referredCharacterIds: [...new Set([...referredCharacters(), ...previousScene.referredCharacterIds])],
    })

    addNotification({
      type: 'success',
      title: 'Referred Characters Copied',
      message: 'Referred characters from previous scene have been added.',
    })
  }

  return (
    <div class="flex flex-col gap-2">
      {/* Present Characters */}
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold">Characters Present:</span>
        <div
          class="dropdown dropdown-start"
          classList={{
            'dropdown-open': openDropdowns().present,
          }}
        >
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            title="Add present character"
            onClick={() => {
              setOpenDropdowns((r) => {
                return {
                  ...r,
                  present: !r.present,
                }
              })
            }}
          >
            +
          </button>
          <div class="dropdown-content z-[1] p-2 shadow bg-base-100 rounded-box w-52">
            <CharacterSelect
              placeholder="Select character..."
              onChange={(characterId) => {
                if (!characterId) return
                const currentCharacters = new Set(characters())
                if (currentCharacters.has(characterId)) return

                updateSceneData(props.node.id, {
                  characterIds: [...currentCharacters, characterId],
                })
                setOpenDropdowns((r) => {
                  return {
                    ...r,
                    present: false,
                  }
                })
              }}
            />
          </div>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          onClick={copyCharactersFromPreviousScene}
          title="Copy characters from previous scene"
        >
          ⬆️
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          disabled={extractingCharacters()}
          onClick={async () => {
            setExtractingCharacters(true)
            try {
              await extractCharactersFromScene(props.node)
            } catch (error) {
              addNotification({
                type: 'error',
                title: 'Error extracting characters',
                message: error instanceof Error ? error.message : 'Unknown error',
              })
            } finally {
              setExtractingCharacters(false)
            }
          }}
          title="Extract characters from scene content"
        >
          {extractingCharacters() ? <span class="loading loading-spinner loading-xs" /> : '🔍'}
        </button>
        <div
          class="dropdown dropdown-end"
          classList={{
            'dropdown-open': openDropdowns().perspective,
          }}
        >
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            title="Set perspective character"
            onClick={() => {
              setOpenDropdowns((r) => {
                return {
                  ...r,
                  perspective: !r.perspective,
                }
              })
            }}
          >
            👁️
          </button>
          <div class="dropdown-content z-[1] p-2 shadow bg-base-100 rounded-box w-52">
            <CharacterSelect
              placeholder="Select perspective..."
              value={scene.protagonistId}
              onChange={(characterId) => {
                updateSceneData(props.node.id, {
                  protagonistId: characterId || undefined,
                })
                setOpenDropdowns((r) => {
                  return {
                    ...r,
                    perspective: false,
                  }
                })
              }}
              characters={characters()}
              emptyMessage="Add characters to the scene first"
            />
          </div>
        </div>

        <button
          type="button"
          class="btn btn-ghost btn-xs"
          title="Set perspective type"
          onClick={() => {
            updateSceneData(props.node.id, {
              perspective: scene.perspective === 'first' ? 'third' : 'first',
            })
          }}
        >
          {scene.perspective === 'first' ? '1st' : '3rd'}
        </button>
      </div>
      <div class="flex flex-wrap gap-1">
        <For each={characters()}>
          {(characterId) => {
            const character = charactersState.characters[characterId]
            if (!character) return null

            const fullName = [
              character.firstName,
              character.middleName,
              character.lastName,
              character.nickname ? `"${character.nickname}"` : null,
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <div
                class={`badge gap-1 ${
                  character.id === scene.protagonistId
                    ? 'badge-secondary' // Perspective character
                    : (character.isMainCharacter ?? true)
                      ? 'badge-primary'
                      : 'badge-accent'
                }`}
                title={`${
                  character.id === scene.protagonistId
                    ? 'Perspective'
                    : (character.isMainCharacter ?? true)
                      ? 'Main'
                      : 'Side'
                } character`}
              >
                {character.id === scene.protagonistId && '👁️ '}
                {fullName}
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  onClick={() => {
                    updateSceneData(props.node.id, {
                      characterIds: characters().filter((id) => id !== characterId),
                      // Clear protagonist if removing that character
                      ...(character.id === scene.protagonistId ? { protagonistId: undefined } : {}),
                    })
                  }}
                >
                  ×
                </button>
              </div>
            )
          }}
        </For>
      </div>

      {/* Referred Characters */}
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold">Characters Referred To:</span>
        <div
          class="dropdown dropdown-start"
          classList={{
            'dropdown-open': openDropdowns().referred,
          }}
        >
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            title="Add referred character"
            onClick={() => {
              setOpenDropdowns((r) => {
                return {
                  ...r,
                  referred: !r.referred,
                }
              })
            }}
          >
            +
          </button>
          <div class="dropdown-content z-[1] p-2 shadow bg-base-100 rounded-box w-52">
            <CharacterSelect
              placeholder="Select character..."
              onChange={(characterId) => {
                if (!characterId) return
                const currentReferred = new Set(referredCharacters())
                if (currentReferred.has(characterId)) return

                updateSceneData(props.node.id, {
                  referredCharacterIds: [...currentReferred, characterId],
                })
                setOpenDropdowns((r) => {
                  return {
                    ...r,
                    referred: false,
                  }
                })
              }}
            />
          </div>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          onClick={copyReferredCharactersFromPreviousScene}
          title="Copy referred characters from previous scene"
        >
          ⬆️
        </button>
      </div>
      <div class="flex flex-wrap gap-1">
        <For each={referredCharacters()}>
          {(characterId) => {
            const character = charactersState.characters[characterId]
            if (!character) return null

            const fullName = [character.firstName, character.middleName, character.lastName].filter(Boolean).join(' ')

            return (
              <div
                class={`badge gap-1 ${(character.isMainCharacter ?? true) ? 'badge-secondary' : 'badge-neutral'}`}
                title={`${(character.isMainCharacter ?? true) ? 'Main' : 'Side'} character`}
              >
                {fullName}
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  onClick={() => {
                    updateSceneData(props.node.id, {
                      referredCharacterIds: referredCharacters().filter((id) => id !== characterId),
                    })
                  }}
                >
                  ×
                </button>
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}
