import debounce from 'debounce'
import shortUUID from 'short-uuid'
import { createEffect, createSignal } from 'solid-js'
import { For, Show } from 'solid-js'
import { generateContext, generateContext as generatePrompt } from '../../lib/generation/generateContext.ts'
import { addNotification } from '../../lib/stores/notifications.ts'
import { currentScene } from '../../lib/stores/retrieval/current-scene.ts'
import { createSceneParagraph, updateSceneData } from '../../lib/stores/scenes.ts'
import { settingsState } from '../../lib/stores/settings.ts'
import { uiState } from '../../lib/stores/ui.ts'
import { useAi } from '../../lib/use-ai.ts'
import { ContextNodeFinder } from '../shared/ContextNodeFinder.tsx'

export const GenerateNext = () => {
  const [generatingNext, setGeneratingNext] = createSignal<boolean>(false)
  const [generatingOptions, setGeneratingOptions] = createSignal<boolean>(false)
  const [validGenerationId, setValidGenerationId] = createSignal<string | null>(null)
  const [generateContextText, setGenerateContextText] = createSignal<string>('')
  const [showContext, setShowContext] = createSignal<boolean>(false)
  const [showContextSelector, setShowContextSelector] = createSignal<boolean>(false)
  const [generatedOptions, setGeneratedOptions] = createSignal<string[]>([])

  const paragraphCount = () => currentScene()?.paragraphsToGenerate ?? 1

  const debouncedGenerateContext = debounce(() => {
    console.log('generating context')
    generateContext(currentScene()?.id ?? '', {
      instruction: `Write ${
        paragraphCount() === -1
          ? 'as many paragraphs as necessary'
          : paragraphCount() === 1
            ? 'a paragraph'
            : `${paragraphCount()} paragraphs`
      } for the next scene in which _EVERYTHING_ between the <scene_content> and </scene_content> tags happens. Text contained between '(' and ')' is extra information, but not part of the content. Do not output any other text than the paragraphs:\n\n<scene_content>\n${currentScene()?.generateNextText}\n</scene_content>`,
    }).then((context) => {
      setGenerateContextText(context?.inputSections.map((s) => s.text).join('\n\n') ?? '')
    })
  }, 2000)
  createEffect(() => {
    // debounce the generateContext call, this last modified is here purely to trigger the effect xD
    const lastModified = currentScene()?.modifiedAt
    if (lastModified) {
      debouncedGenerateContext()
    }
  })

  // Toggle selection of a context node
  const _toggleContextNode = (nodeId: string) => {
    const scene = currentScene()
    if (!scene) return

    const currentSelection = scene.selectedContextNodes || []
    const newSelection = currentSelection.includes(nodeId)
      ? currentSelection.filter((id) => id !== nodeId)
      : [...currentSelection, nodeId]

    // Persist selection in scene state
    updateSceneData(scene.id, {
      selectedContextNodes: newSelection,
    })
  }

  // Remove a selected context node
  const _removeContextNode = (nodeId: string) => {
    const scene = currentScene()
    if (!scene) return

    const currentSelection = scene.selectedContextNodes || []
    const newSelection = currentSelection.filter((id) => id !== nodeId)

    // Persist selection in scene state
    updateSceneData(scene.id, {
      selectedContextNodes: newSelection,
    })
  }

  return currentScene() ? (
    <>
      <div class="flex flex-col items-start w-full gap-2 mt-2">
        <div class="flex items-center gap-4 w-full">
          <label class="flex items-center gap-2">
            Generate:
            <select
              class="select select-bordered select-sm"
              value={paragraphCount()}
              onChange={(e) => {
                const scene = currentScene()
                if (!scene) return
                updateSceneData(scene.id, {
                  paragraphsToGenerate: Number.parseInt(e.target.value),
                })
              }}
            >
              <For each={[1, 2, 3, 4, 5]}>{(num) => <option value={num}>{num}</option>}</For>
              <option value={-1}>Unlimited</option>
            </select>
            {paragraphCount() === -1 ? '' : 'paragraphs'}
          </label>
        </div>

        <Show
          when={showContext()}
          fallback={
            <button type="button" class="btn btn-primary btn-xs" onClick={() => setShowContext(true)}>
              Show Context
            </button>
          }
        >
          <textarea
            class="w-full textarea textarea-bordered textarea-disabled text-black"
            rows={15}
            value={generateContextText()}
            placeholder={'The context that gets sent to generate the next paragraphs'}
            readonly
          />
          <div class="text-sm flex justify-between w-full">
            <button type="button" class="btn btn-primary btn-xs" onClick={() => setShowContext(false)}>
              Hide Context
            </button>
            <div>
              {generateContextText().length} character context, ~{Math.round(generateContextText().length / 3.5)} tokens
            </div>
          </div>
        </Show>

        <textarea
          class="w-full textarea textarea-bordered"
          rows={5}
          value={currentScene()?.generateNextText ?? ''}
          placeholder={'What happens in this paragraph'}
          onChange={(event) => {
            const scene = currentScene()
            if (!scene) return
            updateSceneData(scene.id, {
              generateNextText: event.target.value,
            })
          }}
        />

        <Show
          when={showContextSelector()}
          fallback={
            <button type="button" class="btn btn-primary btn-xs" onClick={() => setShowContextSelector(true)}>
              Select Context Nodes
            </button>
          }
        >
          <ContextNodeFinder
            selectedNodeIds={currentScene()?.selectedContextNodes ?? []}
            onChange={(selectedNodeIds) => {
              const scene = currentScene()
              if (!scene) return
              updateSceneData(scene.id, {
                selectedContextNodes: selectedNodeIds,
              })
            }}
            maxHeight="200px"
            nodeTypes={['context']}
          />
          <button type="button" class="btn btn-primary btn-xs mt-2" onClick={() => setShowContextSelector(false)}>
            Hide Context Selector
          </button>
        </Show>

        <Show when={generatedOptions().length > 0}>
          <div class="w-full">
            <h4 class="text-sm font-semibold mb-2">Generated Options (click to use):</h4>
            <div class="grid grid-cols-1 gap-2">
              <For each={generatedOptions()}>
                {(option, index) => (
                  <button
                    type="button"
                    class="btn btn-outline btn-sm text-left justify-start h-auto min-h-0 p-3 whitespace-normal"
                    onClick={() => {
                      const scene = currentScene()
                      if (!scene) return
                      updateSceneData(scene.id, {
                        generateNextText: option,
                      })
                      setGeneratedOptions([])
                    }}
                  >
                    <span class="font-semibold text-xs mr-2">{index() + 1}.</span>
                    {option}
                  </button>
                )}
              </For>
            </div>
            <button type="button" class="btn btn-ghost btn-xs mt-2" onClick={() => setGeneratedOptions([])}>
              Clear Options
            </button>
          </div>
        </Show>

        <div class="flex gap-2 w-full">
          <button
            type="button"
            class="btn btn-secondary flex-1"
            disabled={generatingOptions()}
            onClick={() => {
              setGeneratingOptions(true)
              const generateOptions = async () => {
                const scene = currentScene()
                if (!scene) return

                const contextData = await generatePrompt(scene.id, {
                  instruction: `Based on the current story context, generate exactly 4 different creative options for what could happen next in the story. Each option should be a brief description (1-2 sentences) of potential plot developments or scenes. Return ONLY a valid JSON array of strings, with no additional text or formatting. Example format: ["Option 1 description", "Option 2 description", "Option 3 description", "Option 4 description"]`,
                })

                if (!contextData) return

                const validId = shortUUID.generate()
                setValidGenerationId(validId)
                const result = await useAi('generate_options', contextData.inputSections, false)
                if (validId !== validGenerationId()) return

                try {
                  const options = JSON.parse(result.trim())
                  if (Array.isArray(options) && options.length === 4) {
                    setGeneratedOptions(options)
                  } else {
                    throw new Error('Invalid response format')
                  }
                } catch (error) {
                  console.error('Failed to parse options:', error)
                  addNotification({
                    title: 'Error parsing options',
                    message: 'The AI response was not in the expected JSON format',
                    type: 'error',
                  })
                }
              }
              generateOptions()
                .catch((error) => {
                  console.error(error)
                  addNotification({
                    title: 'Error generating options',
                    message: error.message,
                    type: 'error',
                  })
                })
                .finally(() => {
                  setGeneratingOptions(false)
                })
            }}
          >
            {generatingOptions() ? <span class="loading loading-ring" /> : null}{' '}
            {generatingOptions() ? 'Generating Options...' : 'Generate 4 Options'}
          </button>

          <button
            type="button"
            class="btn btn-primary flex-1"
            disabled={generatingNext()}
            onClick={() => {
              const nextParagraphValue = currentScene()?.generateNextText
              if (!nextParagraphValue) return
              setGeneratingNext(true)
              const generate = async () => {
                if (!nextParagraphValue) {
                  return
                }
                const scene = currentScene()
                if (!scene) return

                const contextData = await generatePrompt(scene.id, {
                  instruction: `Write ${
                    paragraphCount() === -1
                      ? 'as many paragraphs as necessary'
                      : paragraphCount() === 1
                        ? 'a paragraph'
                        : `${paragraphCount()} paragraphs`
                  } for the next scene in which _EVERYTHING_ between the <scene_content> and </scene_content> tags happens. Text contained between '(' and ')' is extra information, but not part of the content. Do not output any other text than the paragraphs:\n\n<scene_content>\n${scene.generateNextText}\n</scene_content>`,
                })

                if (!contextData) return

                const validId = shortUUID.generate()
                setValidGenerationId(validId)
                const result = await useAi('next_paragraph', contextData.inputSections, false)
                if (validId !== validGenerationId()) return
                const paragraphs = result.split('\n\n')
                console.log('output', result)
                for (const paragraph of paragraphs) {
                  createSceneParagraph(scene.id, {
                    id: shortUUID.generate(),
                    // replace with em dash
                    text: paragraph.replaceAll(' - ', '—'),
                    state: 'ai',
                    comments: [],
                  })
                }

                // Force the editor to resync after a brief delay
                setTimeout(() => {
                  // Trigger a small update to force the editor to check for changes
                  updateSceneData(scene.id, {
                    modifiedAt: Date.now(),
                  })
                }, 100)
              }
              generate()
                .catch((error) => {
                  console.error(error)
                  addNotification({
                    title: 'Error generating next paragraph',
                    message: error.message,
                    type: 'error',
                  })
                })
                .finally(() => {
                  setGeneratingNext(false)
                })
            }}
          >
            {generatingNext() ? <span class="loading loading-ring" /> : null}{' '}
            {generatingNext() ? 'Generating Next Paragraph...' : 'Generate Next Paragraph'}
          </button>
        </div>
        {generatingNext() || generatingOptions() ? (
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() => {
              setGeneratingNext(false)
              setGeneratingOptions(false)
              setValidGenerationId(null)
            }}
          >
            Cancel
          </button>
        ) : null}
        <p>
          Using {settingsState.aiSource} {settingsState.aiModel} Last generation usage:{' '}
          <For each={Object.entries(uiState.lastGenerationUsage ?? {})}>
            {([key, value]) => (
              <span>
                {key}: {value}
              </span>
            )}
          </For>
        </p>
      </div>
    </>
  ) : null
}
