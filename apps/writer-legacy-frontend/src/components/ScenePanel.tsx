import type { Node } from '@writer/shared'
import { For, Show, createSignal } from 'solid-js'
import { extractSceneHighlights, needsHighlightsRegeneration } from '../lib/generation/extractSceneHighlights'
import { contentSchemaToText } from '../lib/persistence/content-schema-to-html'
import { charactersState, getCharacterName } from '../lib/stores/characters'
import { currentScene } from '../lib/stores/retrieval/current-scene'
import { deleteScene, updateSceneData } from '../lib/stores/scenes'
import { storyState } from '../lib/stores/story'
import { findNode, updateNode } from '../lib/stores/tree'
import { useAi } from '../lib/use-ai'
import { CharacterSelect } from './CharacterSelect'
import { NodeTypeButtons } from './NodeTypeButtons'
import { CharacterList } from './snowflake/CharacterList'
import { LocationList } from './snowflake/LocationList'
import { FormField } from './styled/FormField'

export const ScenePanel = () => {
  const [extractingHighlights, setExtractingHighlights] = createSignal(false)
  const [isAiLoading, setIsAiLoading] = createSignal(false)

  const help = async (helpKind: 'summarize' | 'improvements' | 'suggest_title', extra = false) => {
    const protagonist = charactersState.characters[currentScene()?.protagonistId ?? '']
    const protagonistName = protagonist ? getCharacterName(protagonist.id) : 'the protagonist'
    const protagonistGender = protagonist?.gender ?? 'male'

    const text = `Protagonist: ${protagonistName} (${protagonistGender})\n\nScene text:\n\n${currentScene()
      ?.paragraphs.map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text)))
      .join('\n\n')}\n\nOutput only the summary.`
    setIsAiLoading(true)
    try {
      const res = await useAi(helpKind, text)
      const sceneId = currentScene()?.id
      if (sceneId && extra) {
        updateSceneData(sceneId, { extra: res ?? undefined })
      } else if (sceneId) {
        if (helpKind === 'suggest_title') {
          updateSceneData(sceneId, { title: res ?? undefined })
        } else {
          updateSceneData(sceneId, { summary: res ?? undefined })
          updateNode(sceneId, { oneliner: res ?? undefined })
        }
      }
    } finally {
      setIsAiLoading(false)
    }
  }

  const sceneAsNode = (): Node | undefined => {
    const scene = currentScene()
    if (!scene) return undefined

    return {
      id: scene.id,
      name: scene.title,
      type: 'scene',
      isOpen: true,
      nodeType: findNode(scene.id)?.nodeType ?? 'story',
      oneliner: scene.summary,
    }
  }

  return currentScene() ? (
    <div class="flex flex-col p-4 w-full gap-2 overflow-y-auto h-full">
      <FormField label="Id">
        <input class="input input-bordered" value={currentScene()?.id ?? ''} disabled />
      </FormField>
      <FormField label="Title">
        <input
          class="input input-bordered"
          placeholder={'title'}
          onChange={(e) => {
            updateSceneData(currentScene()?.id ?? '', {
              title: e.target.value,
            })
          }}
          value={currentScene()?.title ?? ''}
        />
      </FormField>
      <FormField label="Perspective" helpText="The perspective this scene is written from.">
        <select
          class="select select-bordered w-full"
          value={currentScene()?.perspective ?? storyState.story?.settings?.defaultPerspective ?? 'third'}
          onChange={(e) =>
            updateSceneData(currentScene()?.id ?? '', {
              perspective: e.currentTarget.value as 'first' | 'third',
            })
          }
        >
          <option value="first">First Person</option>
          <option value="third">Third Person</option>
        </select>
      </FormField>

      <FormField label="Protagonist" helpText="The character whose perspective this scene is written from.">
        <CharacterSelect
          value={currentScene()?.protagonistId}
          onChange={(value) => {
            const id = currentScene()?.id
            if (!id) return

            updateSceneData(id, {
              protagonistId: value || undefined,
            })
          }}
          placeholder="Select protagonist..."
        />
      </FormField>

      <FormField label="Characters & Location">
        <div class="flex flex-col gap-4 p-2 border rounded-lg">
          {(() => {
            const node = sceneAsNode()
            return node ? (
              <>
                <CharacterList node={node} />
                <LocationList node={node} />
              </>
            ) : null
          })()}
        </div>
      </FormField>

      <FormField label="Summary">
        <textarea
          class="textarea textarea-bordered"
          onChange={(e) => {
            updateSceneData(currentScene()?.id ?? '', {
              summary: e.target.value,
            })
            updateNode(currentScene()?.id ?? '', {
              oneliner: e.target.value,
            })
          }}
          rows={6}
          placeholder="summary"
          style={{ width: '100%' }}
          value={currentScene()?.summary ?? ''}
        />
      </FormField>
      {currentScene()?.extra && (
        <FormField label="Extra">
          <textarea
            class="textarea textarea-bordered"
            onChange={(e) => {
              updateSceneData(currentScene()?.id ?? '', {
                extra: e.target.value,
              })
            }}
            rows={18}
            placeholder="extra"
            style={{ width: '100%' }}
            value={currentScene()?.extra ?? ''}
          />
        </FormField>
      )}
      <FormField label="Uploaded">
        <label class="label cursor-pointer max-w-40">
          <input
            type="checkbox"
            checked={currentScene()?.posted ?? false}
            onChange={() => {
              updateSceneData(currentScene()?.id ?? '', {
                posted: !currentScene()?.posted,
              })
            }}
            class="checkbox"
          />
          <span class="label-text">Uploaded</span>
        </label>
      </FormField>
      {/* Scene Highlights Section */}
      <Show when={currentScene()}>
        <FormField label="Scene Highlights">
          <div class="flex flex-col gap-2">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600">
                {currentScene()?.highlights?.length
                  ? `${currentScene()?.highlights?.length} highlight(s) found`
                  : 'No highlights generated yet'}
              </span>
              <button
                type="button"
                class="btn btn-sm btn-outline"
                disabled={extractingHighlights()}
                onClick={async () => {
                  const scene = currentScene()
                  if (!scene) return

                  setExtractingHighlights(true)
                  try {
                    await extractSceneHighlights(scene.id)
                  } finally {
                    setExtractingHighlights(false)
                  }
                }}
              >
                {extractingHighlights() ? <span class="loading loading-spinner loading-xs mr-2" /> : null}
                {needsHighlightsRegeneration(currentScene()?.id ?? '')
                  ? 'Generate Highlights'
                  : 'Regenerate Highlights'}
              </button>
            </div>

            <Show when={currentScene()?.highlights?.length}>
              <div class="bg-base-200 p-2 rounded-lg max-h-48 overflow-y-auto">
                <For each={currentScene()?.highlights}>
                  {(highlight) => (
                    <div class="mb-2 p-2 bg-base-100 rounded">
                      <div class="flex justify-between">
                        <span
                          class={`badge badge-sm ${
                            highlight.category === 'character'
                              ? 'badge-primary'
                              : highlight.category === 'plot'
                                ? 'badge-secondary'
                                : highlight.category === 'setting'
                                  ? 'badge-accent'
                                  : 'badge-neutral'
                          }`}
                        >
                          {highlight.category}
                        </span>
                        <span class="text-xs text-gray-500">{new Date(highlight.timestamp).toLocaleDateString()}</span>
                      </div>
                      <p class="mt-1 text-sm font-medium">{highlight.text}</p>
                      <p class="text-xs text-gray-600">{highlight.importance}</p>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </FormField>
      </Show>

      <Show when={currentScene()?.id}>{(id) => <NodeTypeButtons nodeId={id()} />}</Show>
      <div class="flex gap-2">
        <button
          type="button"
          class="btn btn-primary"
          disabled={isAiLoading() || extractingHighlights()}
          onClick={() => {
            help('suggest_title')
          }}
        >
          <Show when={isAiLoading() && !extractingHighlights()}>
            <span class="loading loading-spinner loading-xs mr-2" />
          </Show>
          [AI] Suggest Title
        </button>
        <button
          type="button"
          class="btn btn-primary"
          disabled={isAiLoading() || extractingHighlights()}
          onClick={() => {
            help('summarize')
          }}
        >
          <Show when={isAiLoading() && !extractingHighlights()}>
            <span class="loading loading-spinner loading-xs mr-2" />
          </Show>
          [AI] Summarize
        </button>
        <button
          type="button"
          class="btn btn-primary"
          disabled={isAiLoading() || extractingHighlights()}
          onClick={() => {
            help('improvements', true)
          }}
        >
          <Show when={isAiLoading() && !extractingHighlights()}>
            <span class="loading loading-spinner loading-xs mr-2" />
          </Show>
          [AI] Improvements
        </button>
        <button
          type="button"
          class="btn btn-error"
          onClick={() => {
            deleteScene(currentScene()?.id ?? '')
          }}
        >
          Delete
        </button>
      </div>
    </div>
  ) : null
}
