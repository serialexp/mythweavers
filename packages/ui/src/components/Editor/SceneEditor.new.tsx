import { createSignal } from 'solid-js'
import type { SceneEditorProps } from './SceneEditorProps'
import { SolidEditorWrapper } from './solid-editor'

/**
 * SceneEditor - Full-featured rich text editor for story scenes
 *
 * This is a props-based component that can be used in any SolidJS app.
 * It handles paragraph editing, AI suggestions, and various editing actions.
 */
export function SceneEditor(props: SceneEditorProps) {
  // Current paragraph selection (getter unused, but setter is used for tracking)
  const [_currentParagraphId, setCurrentParagraphId] = createSignal<string | null>(null)

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
    setState: (id: string, state: any) => {
      props.onParagraphUpdate(id, { state })
    },
  }

  return (
    <SolidEditorWrapper
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
  )
}
