import { Show, createSignal } from 'solid-js'
import type { SceneEditorProps } from './SceneEditorProps'
import { GenerateBetweenModal, RewriteModal } from './components/EditorModals'
import { ProseMirrorEditor } from './components/ProseMirrorEditor'

/**
 * SceneEditor - Full-featured rich text editor for story scenes
 *
 * This is a props-based component that can be used in any SolidJS app.
 * It handles paragraph editing, AI suggestions, and various editing actions.
 */
export function SceneEditor(props: SceneEditorProps) {
  // Current paragraph selection
  const [currentParagraphId, setCurrentParagraphId] = createSignal<string | null>(null)

  // Modal states
  const [showInventory, setShowInventory] = createSignal(false)
  const [showPlotpoint, setShowPlotpoint] = createSignal(false)
  const [rewriteModalOpen, setRewriteModalOpen] = createSignal(false)
  const [generateBetweenModalOpen, setGenerateBetweenModalOpen] = createSignal(false)
  const [isGenerating, setIsGenerating] = createSignal(false)

  // Get current paragraph
  const currentParagraph = () => {
    const id = currentParagraphId()
    if (!id) return null
    return props.scene.paragraphs.find((p) => p.id === id)
  }

  // Handle paragraph text changes from editor
  const handleParagraphsChange = (paragraphs: any[], changedIds: string[]) => {
    // Notify parent of full paragraphs array (for state sync)
    props.onParagraphsChange?.(paragraphs)

    for (const id of changedIds) {
      const paragraph = paragraphs.find((p) => p.id === id)
      if (paragraph) {
        props.onParagraphUpdate(id, { body: paragraph.body, contentSchema: paragraph.contentSchema })
      }
    }

    // Handle new paragraphs (paragraphs in doc but not in scene)
    const sceneIds = new Set(props.scene.paragraphs.map((p) => p.id))
    const newParagraphs = paragraphs.filter((p) => !sceneIds.has(p.id))

    for (const newPara of newParagraphs) {
      const index = paragraphs.findIndex((p) => p.id === newPara.id)
      const afterId = index > 0 ? paragraphs[index - 1].id : undefined

      props.onParagraphCreate(
        {
          body: newPara.body,
          contentSchema: newPara.contentSchema,
          state: 'draft',
          comments: [],
        },
        afterId,
      )
    }

    // Handle deleted paragraphs (paragraphs in scene but not in doc)
    const docIds = new Set(paragraphs.map((p) => p.id))
    const deletedIds = props.scene.paragraphs.filter((p) => !docIds.has(p.id)).map((p) => p.id)

    for (const id of deletedIds) {
      props.onParagraphDelete(id)
    }
  }

  // Handle AI rewrite request
  const handleRewrite = async (paragraphId: string, customInstructions?: string) => {
    const result = await props.onAiRequest?.('rewrite', paragraphId, customInstructions)
    if (result) {
      props.onParagraphUpdate(paragraphId, {
        extra: result,
        extraLoading: false,
      })
    }
  }

  // Handle custom rewrite modal
  const handleCustomRewrite = (instructions: string) => {
    const id = currentParagraphId()
    if (id) {
      handleRewrite(id, instructions)
    }
  }

  // Handle generate between
  const handleGenerateBetween = async (text: string) => {
    const id = currentParagraphId()
    if (!id) return

    setIsGenerating(true)
    props.onGenerateBetweenTextSave?.(text)

    try {
      const result = await props.onAiRequest?.('generate_between', id, text)
      if (result) {
        // Split result into paragraphs and create them
        const paragraphs = result.split('\n\n')
        const afterId = id

        for (const paragraph of paragraphs) {
          props.onParagraphCreate(
            {
              body: paragraph,
              state: 'ai',
              comments: [],
            },
            afterId,
          )
          // We don't know the new ID here, so apps need to handle this
        }
      }
      setGenerateBetweenModalOpen(false)
    } finally {
      setIsGenerating(false)
    }
  }

  // Handle suggestion accept/reject
  const handleSuggestionAccept = (paragraphId: string, content: string) => {
    props.onParagraphUpdate(paragraphId, {
      body: content,
      contentSchema: null,
      extra: '',
      extraLoading: false,
    })
  }

  const handleSuggestionReject = (paragraphId: string) => {
    props.onParagraphUpdate(paragraphId, {
      extra: '',
      extraLoading: false,
    })
  }

  // Create paragraph actions object
  const paragraphActions = {
    moveUp: props.onParagraphMoveUp,
    moveDown: props.onParagraphMoveDown,
    delete: props.onParagraphDelete,
    addAfter: (id: string) => {
      props.onParagraphCreate(
        {
          body: '',
          state: 'draft',
          comments: [],
        },
        id,
      )
    },
    generateBetween: (id: string) => {
      setCurrentParagraphId(id)
      setGenerateBetweenModalOpen(true)
    },
    spellCheck: async (id: string) => {
      const result = await props.onAiRequest?.('rewrite_spelling', id)
      if (result) {
        props.onParagraphUpdate(id, { extra: result, extraLoading: false })
      }
    },
    rewrite: async (id: string) => {
      const result = await props.onAiRequest?.('rewrite', id)
      if (result) {
        props.onParagraphUpdate(id, { extra: result, extraLoading: false })
      }
    },
    refineStyle: async (id: string) => {
      const result = await props.onAiRequest?.('snowflake_refine_scene_style', id)
      if (result) {
        props.onParagraphUpdate(id, { extra: result, extraLoading: false })
      }
    },
    addSensory: async (id: string) => {
      const result = await props.onAiRequest?.('add_sensory_details', id)
      if (result) {
        props.onParagraphUpdate(id, { extra: result, extraLoading: false })
      }
    },
    setState: (id: string, state: any) => {
      props.onParagraphUpdate(id, { state })
    },
    toggleInventory: (id: string) => {
      setCurrentParagraphId(id)
      setShowInventory((prev) => !prev)
      setShowPlotpoint(false)
    },
    togglePlotpoint: (id: string) => {
      setCurrentParagraphId(id)
      setShowPlotpoint((prev) => !prev)
      setShowInventory(false)
    },
    customRewrite: (id: string) => {
      setCurrentParagraphId(id)
      setRewriteModalOpen(true)
    },
    convertPerspective: async (id: string) => {
      const result = await props.onAiRequest?.('snowflake_convert_perspective', id)
      if (result) {
        props.onParagraphUpdate(id, { extra: result, extraLoading: false })
      }
    },
    splitScene: (id: string) => {
      props.onSceneSplit?.(id)
    },
  }

  return (
    <div>
      {/* Main editor */}
      <ProseMirrorEditor
        paragraphs={props.scene.paragraphs}
        onParagraphsChange={handleParagraphsChange}
        onParagraphCreate={props.onParagraphCreate}
        onParagraphDelete={props.onParagraphDelete}
        onParagraphSelect={(id) => {
          setCurrentParagraphId(id)
          if (id) props.onSelectedParagraphChange(id)
        }}
        onParagraphAction={paragraphActions}
        onSuggestionAccept={handleSuggestionAccept}
        onSuggestionReject={handleSuggestionReject}
        isProtagonistSet={!!props.scene.protagonistId}
      />

      {/* Floating Inventory Actions */}
      <Show when={showInventory() && props.InventoryActionsComponent}>
        <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-base-100 shadow-lg rounded-lg p-4 border border-gray-200">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-lg">Inventory Actions</h3>
            <button type="button" class="btn btn-sm btn-ghost" onClick={() => setShowInventory(false)}>
              ✕
            </button>
          </div>
          {props.InventoryActionsComponent?.()}
        </div>
      </Show>

      {/* Floating Plotpoint Actions */}
      <Show when={showPlotpoint() && props.PlotpointActionsComponent}>
        <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-base-100 shadow-lg rounded-lg p-4 border border-gray-200">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-lg">Plot Point Actions</h3>
            <button type="button" class="btn btn-sm btn-ghost" onClick={() => setShowPlotpoint(false)}>
              ✕
            </button>
          </div>
          {props.PlotpointActionsComponent?.({ onClose: () => setShowPlotpoint(false) })}
        </div>
      </Show>

      {/* Audio Button - Fixed position when paragraph is selected */}
      <Show when={currentParagraphId() && currentParagraph() && props.AudioButtonComponent}>
        <div class="fixed top-4 right-4 z-40">
          {props.AudioButtonComponent?.({
            text: currentParagraph()!.body,
          })}
        </div>
      </Show>

      {/* Modals */}
      <RewriteModal
        isOpen={rewriteModalOpen()}
        onClose={() => setRewriteModalOpen(false)}
        onSubmit={handleCustomRewrite}
      />

      <GenerateBetweenModal
        isOpen={generateBetweenModalOpen()}
        initialValue={props.savedGenerateBetweenText}
        isGenerating={isGenerating()}
        onClose={() => setGenerateBetweenModalOpen(false)}
        onGenerate={handleGenerateBetween}
      />
    </div>
  )
}
