import type { Node } from '@writer/shared'
import { FaSolidXmark } from 'solid-icons/fa'
import { For, Show } from 'solid-js'
import { createSignal } from 'solid-js'
import { contentSchemaToText } from '../../lib/persistence/content-schema-to-html'
import { addNotification } from '../../lib/stores/notifications'
import { scenesState, updateSceneData } from '../../lib/stores/scenes'
import { findPathToNode } from '../../lib/stores/tree'
import { useAi } from '../../lib/use-ai'
import { generateSceneContent } from './actions/generateSceneContent'
import { loadingStates, setLoadingStates } from './store'

type Props = {
  node: Node
  versions?: Array<{
    name: string
    content: string
    timestamp: number
  }>
  onSelect: (content: string) => void
  onClose: () => void
}

export const SceneVersions = (props: Props) => {
  const [isDragging, setIsDragging] = createSignal(false)
  const [startX, setStartX] = createSignal(0)
  const [scrollLeft, setScrollLeft] = createSignal(0)
  let containerRef: HTMLDivElement | undefined
  const [customEditContent, setCustomEditContent] = createSignal<string | null>(null)
  const [customEditSelection, setCustomEditSelection] = createSignal<{
    text: string
    start: number
    end: number
  } | null>(null)
  const [customInstructions, setCustomInstructions] = createSignal('')

  const onMouseDown = (e: MouseEvent) => {
    if (!containerRef) return
    setIsDragging(true)
    setStartX(e.pageX - containerRef.offsetLeft)
    setScrollLeft(containerRef.scrollLeft)
  }

  const onMouseUp = () => {
    setIsDragging(false)
  }

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging() || !containerRef) return
    e.preventDefault()
    const x = e.pageX - containerRef.offsetLeft
    const walk = (x - startX()) * 2 // Multiply by 2 for faster scrolling
    containerRef.scrollLeft = scrollLeft() - walk
  }

  const currentContent = () => {
    const scene = scenesState.scenes[props.node.id]
    if (!scene?.paragraphs.length) return null

    return scene.paragraphs.map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text))).join('\n\n')
  }

  const getSelectedText = (elementId: string): { text: string; start: number; end: number } | null => {
    const element = document.getElementById(elementId)
    if (!element) return null
    const selection = window.getSelection()
    if (!selection || !selection.toString().trim()) return null

    // Make sure selection is within this element
    let container = selection.anchorNode
    while (container && container !== element) {
      container = container.parentNode
    }
    if (!container) return null

    const fullText = element.textContent || ''
    const selectedText = selection.toString()
    const start = fullText.indexOf(selectedText)

    return {
      text: selectedText,
      start,
      end: start + selectedText.length,
    }
  }

  const createVersionWithReplacement = (
    originalContent: string,
    originalSelection: { text: string; start: number; end: number },
    newText: string,
    versionName: string,
  ) => {
    const newContent =
      originalContent.substring(0, originalSelection.start) + newText + originalContent.substring(originalSelection.end)

    if (props.versions) {
      updateSceneData(props.node.id, {
        generationApproaches: [
          ...props.versions,
          {
            name: versionName,
            content: newContent,
            timestamp: Date.now(),
          },
        ],
      })
    }
  }

  const expandVersion = async (content: string, type: 'variation' | 'dialogue', elementId?: string) => {
    const selection = elementId ? getSelectedText(elementId) : null

    // Existing full-content expansion logic
    setLoadingStates({ [`${props.node.id}_expand_${type}`]: true })
    try {
      const expandedContent = await useAi(
        type === 'dialogue' ? 'snowflake_expand_scene_dialogue' : 'snowflake_expand_scene_variation',
        selection ? selection.text : content,
      )

      if (selection) {
        createVersionWithReplacement(
          content,
          selection,
          expandedContent,
          type === 'dialogue' ? 'Expanded Dialogue' : 'Expanded Version',
        )
      } else {
        if (props.versions) {
          updateSceneData(props.node.id, {
            generationApproaches: [
              ...props.versions,
              {
                name: type === 'dialogue' ? 'Expanded Dialogue' : 'Expanded Version',
                content: expandedContent,
                timestamp: Date.now(),
              },
            ],
          })
        }
      }

      addNotification({
        type: 'success',
        title: 'Scene Expanded',
        message: `Created a new version with expanded ${type === 'dialogue' ? 'dialogue' : 'content'}.`,
      })
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to expand scene',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setLoadingStates({ [`${props.node.id}_expand_${type}`]: false })
    }
  }

  const customEdit = async (content: string, instructions: string) => {
    setLoadingStates({ [`${props.node.id}_custom_edit`]: true })
    try {
      // Get the previous scenes in the chapter
      const _scene = scenesState.scenes[props.node.id]
      const [_bookNode, _arcNode, chapterNode, _sceneNode] = findPathToNode(props.node.id)
      const scenesInChapter = chapterNode.children?.map((c) => scenesState.scenes[c.id])

      if (!scenesInChapter) {
        addNotification({
          title: 'No scenes found in chapter',
          message: 'No child scenes found',
          type: 'error',
        })
        return
      }

      const sceneNodeIndex = scenesInChapter.findIndex((s) => s.id === props.node.id)
      console.log('scenesinchapter', scenesInChapter, props.node.id, sceneNodeIndex)
      if (sceneNodeIndex === undefined || sceneNodeIndex === -1) {
        addNotification({
          title: 'Current scene not found in chapter',
          message: 'Current scene not found',
          type: 'error',
        })
        return
      }

      // Get previous scenes' content
      const previousScenes = scenesInChapter
        .slice(0, sceneNodeIndex)
        .map((scene) =>
          scene.paragraphs.map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text))).join('\n\n'),
        )

      const editedContent = await useAi(
        'snowflake_custom_scene_edit',
        `PREVIOUS SCENES IN CHAPTER:\n${previousScenes.map((scene, i) => `Scene ${i + 1}:\n${scene}`).join('\n\n')}\n\nCURRENT SCENE:\n${customEditSelection() ? customEditSelection()?.text : content}\n\nINSTRUCTIONS:\n${instructions}`,
      )

      if (customEditSelection()) {
        createVersionWithReplacement(content, customEditSelection()!, editedContent, 'Custom Edit')
      } else {
        if (props.versions) {
          updateSceneData(props.node.id, {
            generationApproaches: [
              ...props.versions,
              {
                name: 'Custom Edit',
                content: editedContent,
                timestamp: Date.now(),
              },
            ],
          })
        }
      }

      addNotification({
        type: 'success',
        title: 'Scene Modified',
        message: 'Created a new version with your custom edits.',
      })
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to modify scene',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setLoadingStates({ [`${props.node.id}_custom_edit`]: false })
      setCustomEditContent(null)
      setCustomInstructions('')
    }
  }

  const customEditButton = (content: string, elementId?: string) => (
    <button
      type="button"
      class="btn btn-secondary btn-xs"
      onClick={() => {
        setCustomEditContent(content)
        setCustomEditSelection(elementId ? getSelectedText(elementId) : null)
      }}
      disabled={loadingStates[`${props.node.id}_custom_edit`]}
    >
      {loadingStates[`${props.node.id}_custom_edit`] ? (
        <span class="loading loading-spinner loading-xs" />
      ) : (
        'Custom Edit'
      )}
    </button>
  )

  const refineVersion = async (content: string, elementId?: string) => {
    const selection = elementId ? getSelectedText(elementId) : null
    console.log('selection', selection)
    setLoadingStates({ [`${props.node.id}_refine`]: true })
    try {
      const critique = await useAi('snowflake_critique_scene', selection ? selection.text : content)
      const refinedContent = await useAi('snowflake_refine_scene_style', [
        { text: selection ? selection.text : content, canCache: true },
        { text: critique, canCache: false },
      ])

      if (selection) {
        createVersionWithReplacement(content, selection, refinedContent, 'Refined Version')
      } else {
        if (props.versions) {
          updateSceneData(props.node.id, {
            generationApproaches: [
              ...props.versions,
              {
                name: 'Refined Version',
                content: refinedContent,
                timestamp: Date.now(),
              },
            ],
          })
        }
      }

      addNotification({
        type: 'success',
        title: 'Scene Refined',
        message: 'Created a new refined version of the scene.',
      })
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to refine scene',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setLoadingStates({ [`${props.node.id}_refine`]: false })
    }
  }

  const smoothTransition = async (content: string, elementId?: string) => {
    const selection = elementId ? getSelectedText(elementId) : null
    setLoadingStates({ [`${props.node.id}_transition`]: true })

    try {
      // Get the previous scenes in the chapter
      const scene = scenesState.scenes[props.node.id]
      const pathToNode = findPathToNode(props.node.id)
      const chapterNode = pathToNode[pathToNode.length - 2]
      const scenesInChapter = chapterNode.children?.map((c) => scenesState.scenes[c.id])

      const sceneNodeIndex = scenesInChapter?.indexOf(scene)
      if (!sceneNodeIndex || sceneNodeIndex === -1) {
        addNotification({
          type: 'error',
          title: 'No Previous Scene',
          message: 'Cannot smooth transition: this is the first scene in the chapter.',
        })
        return
      }
      const previousScene = scenesInChapter?.[sceneNodeIndex - 1]

      if (!previousScene) {
        addNotification({
          type: 'error',
          title: 'No Previous Scene',
          message: 'Cannot smooth transition: this is the first scene in the chapter.',
        })
        return
      }

      const previousContent = previousScene.paragraphs
        .map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text)))
        .join('\n\n')

      const improvedContent = await useAi(
        'snowflake_smooth_transition',
        `PREVIOUS SCENE:\n${previousContent}\n\nCURRENT SCENE:\n${selection ? selection.text : content}`,
      )

      if (selection) {
        createVersionWithReplacement(content, selection, improvedContent, 'Smoothed Transition')
      } else {
        if (props.versions) {
          updateSceneData(props.node.id, {
            generationApproaches: [
              ...props.versions,
              {
                name: 'Smoothed Transition',
                content: improvedContent,
                timestamp: Date.now(),
              },
            ],
          })
        }
      }

      addNotification({
        type: 'success',
        title: 'Transition Smoothed',
        message: 'Created a new version with improved scene transition.',
      })
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to smooth transition',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setLoadingStates({ [`${props.node.id}_transition`]: false })
    }
  }

  const _expandButton = (content: string, elementId?: string) => (
    <button
      type="button"
      class="btn btn-secondary btn-xs"
      onClick={() => expandVersion(content, 'variation', elementId)}
      disabled={loadingStates[`${props.node.id}_expand_variation`]}
    >
      {loadingStates[`${props.node.id}_expand_variation`] ? (
        <span class="loading loading-spinner loading-xs" />
      ) : (
        'Expand'
      )}
    </button>
  )

  const _expandDialogueButton = (content: string, elementId?: string) => (
    <button
      type="button"
      class="btn btn-secondary btn-xs"
      onClick={() => expandVersion(content, 'dialogue', elementId)}
      disabled={loadingStates[`${props.node.id}_expand_dialogue`]}
    >
      {loadingStates[`${props.node.id}_expand_dialogue`] ? (
        <span class="loading loading-spinner loading-xs" />
      ) : (
        'Expand Dialogue'
      )}
    </button>
  )

  const refineButton = (content: string, elementId?: string) => (
    <button
      type="button"
      class="btn btn-secondary btn-xs"
      onClick={() => refineVersion(content, elementId)}
      disabled={loadingStates[`${props.node.id}_refine`]}
    >
      {loadingStates[`${props.node.id}_refine`] ? <span class="loading loading-spinner loading-xs" /> : 'Refine'}
    </button>
  )

  const transitionButton = (content: string, elementId?: string) => (
    <button
      type="button"
      class="btn btn-secondary btn-xs"
      onClick={() => smoothTransition(content, elementId)}
      disabled={loadingStates[`${props.node.id}_transition`]}
    >
      {loadingStates[`${props.node.id}_transition`] ? (
        <span class="loading loading-spinner loading-xs" />
      ) : (
        'Smooth Transition'
      )}
    </button>
  )

  return (
    <>
      <div class="modal modal-open">
        <div class="modal-box w-11/12 max-w-7xl">
          <h3 class="font-bold text-lg mb-4">Compare Generated Versions</h3>

          {/* Side-by-side layout */}
          <div class="flex gap-4">
            {/* Current Content - Fixed Width */}
            <Show when={currentContent()}>
              <div
                class="border border-primary bg-base-200 rounded-lg p-4"
                style={{ 'flex-shrink': '0', width: '300px' }}
              >
                <div class="flex flex-col justify-between items-center mb-2">
                  <div class="text-sm text-gray-500">
                    Current Scene Content - {currentContent()?.split(' ').length} words
                  </div>
                  <div class="flex items-end flex-wrap gap-2">
                    <button
                      type="button"
                      class="btn btn-secondary btn-xs"
                      onClick={() => expandVersion(currentContent()!, 'variation', `${props.node.id}_current_content`)}
                      disabled={loadingStates[`${props.node.id}_expand_variation`]}
                    >
                      {loadingStates[`${props.node.id}_expand_variation`] ? (
                        <span class="loading loading-spinner loading-xs" />
                      ) : (
                        'Expand'
                      )}
                    </button>
                    <button
                      type="button"
                      class="btn btn-secondary btn-xs"
                      onClick={() => expandVersion(currentContent()!, 'dialogue', `${props.node.id}_current_content`)}
                      disabled={loadingStates[`${props.node.id}_expand_dialogue`]}
                    >
                      {loadingStates[`${props.node.id}_expand_dialogue`] ? (
                        <span class="loading loading-spinner loading-xs" />
                      ) : (
                        'Expand Dialogue'
                      )}
                    </button>
                    {refineButton(currentContent()!, `${props.node.id}_current_content`)}
                    {transitionButton(currentContent()!, `${props.node.id}_current_content`)}
                    {customEditButton(currentContent()!, `${props.node.id}_current_content`)}
                  </div>
                </div>
                <div class="whitespace-pre-wrap select-text cursor-text" id={`${props.node.id}_current_content`}>
                  {currentContent()}
                </div>
              </div>
            </Show>

            {/* Horizontally Scrollable Variants */}
            <div class="relative flex-1 overflow-hidden">
              <div
                class="overflow-x-auto cursor-grab select-none active:cursor-grabbing relative"
                style={{
                  'mask-image': 'linear-gradient(to right, transparent, black 2%, black 98%, transparent)',
                  '-webkit-mask-image': 'linear-gradient(to right, transparent, black 2%, black 98%, transparent)',
                }}
                ref={containerRef}
                onMouseDown={onMouseDown}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onMouseMove={onMouseMove}
              >
                <div class="flex gap-4 relative" style={{ 'min-width': 'min-content' }}>
                  <For each={props.versions}>
                    {(version) => (
                      <div class="border border-base-300 rounded-lg p-4" style={{ 'flex-shrink': '0', width: '300px' }}>
                        <div class="flex flex-col justify-between items-center mb-2">
                          <div class="text-sm text-gray-500">
                            {new Date(version.timestamp).toLocaleString()} - {version.content.split(' ').length} words
                          </div>
                          <div class="flex items-end flex-wrap gap-2">
                            <button
                              type="button"
                              class="btn btn-primary btn-xs"
                              onClick={() => props.onSelect(version.content)}
                            >
                              Use This Version
                            </button>
                            <button
                              type="button"
                              class="btn btn-secondary btn-xs"
                              onClick={() =>
                                expandVersion(version.content, 'variation', `${props.node.id}_${version.timestamp}`)
                              }
                              disabled={loadingStates[`${props.node.id}_expand_variation`]}
                            >
                              {loadingStates[`${props.node.id}_expand_variation`] ? (
                                <span class="loading loading-spinner loading-xs" />
                              ) : (
                                'Expand'
                              )}
                            </button>
                            <button
                              type="button"
                              class="btn btn-secondary btn-xs"
                              onClick={() =>
                                expandVersion(version.content, 'dialogue', `${props.node.id}_${version.timestamp}`)
                              }
                              disabled={loadingStates[`${props.node.id}_expand_dialogue`]}
                            >
                              {loadingStates[`${props.node.id}_expand_dialogue`] ? (
                                <span class="loading loading-spinner loading-xs" />
                              ) : (
                                'Expand Dialogue'
                              )}
                            </button>
                            {refineButton(version.content, `${props.node.id}_${version.timestamp}`)}
                            {transitionButton(version.content, `${props.node.id}_${version.timestamp}`)}
                            {customEditButton(version.content, `${props.node.id}_${version.timestamp}`)}
                            <button
                              type="button"
                              class="btn btn-ghost btn-xs"
                              onClick={() => {
                                if (props.versions) {
                                  updateSceneData(props.node.id, {
                                    generationApproaches: props.versions.filter(
                                      (v) => v.timestamp !== version.timestamp,
                                    ),
                                  })
                                }
                              }}
                            >
                              <FaSolidXmark />
                            </button>
                          </div>
                        </div>
                        <div
                          class="whitespace-pre-wrap select-text cursor-text"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                          }}
                          id={`${props.node.id}_${version.timestamp}`}
                        >
                          {version.content}
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div class="modal-action">
            <button type="button" class="btn btn-primary" onClick={() => generateSceneContent(props.node)}>
              {loadingStates[`${props.node.id}_content`] ? (
                <span class="loading loading-spinner loading-sm" />
              ) : (
                'Generate New Version'
              )}
            </button>
            <button
              type="button"
              class="btn btn-primary"
              onClick={() => {
                updateSceneData(props.node.id, {
                  generationApproaches: [],
                })
              }}
            >
              Clear
            </button>
            <button type="button" class="btn" onClick={props.onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Custom Edit Modal */}
      <Show when={customEditContent()}>
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="font-bold text-lg mb-4">Custom Edit Instructions</h3>
            <p class="text-sm mb-4">
              Describe the changes you want to make to the scene. The AI will maintain the original tone and writing
              style while implementing your changes.
            </p>
            <textarea
              class="textarea textarea-bordered w-full h-32 mb-4"
              placeholder="Enter your editing instructions here..."
              value={customInstructions()}
              onInput={(e) => setCustomInstructions(e.currentTarget.value)}
            />
            <div class="modal-action">
              <button
                type="button"
                class="btn btn-primary"
                onClick={() => customEdit(customEditContent()!, customInstructions())}
                disabled={!customInstructions().trim()}
              >
                Apply Changes
              </button>
              <button type="button" class="btn" onClick={() => setCustomEditContent(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  )
}
