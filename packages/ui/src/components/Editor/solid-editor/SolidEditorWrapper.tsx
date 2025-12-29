import type { Paragraph } from '@mythweavers/shared'
import { EditorState, EditorView, type NodeViewMap, type Plugin, history, smartTypography } from '@writer/solid-editor'
import { createEffect, createMemo, createSignal } from 'solid-js'

import { editorContainer, sceneEditor } from '../scene-editor.css'
import {
  type ParagraphActionsConfig,
  createActiveParagraphPlugin,
  createAssignIdPlugin,
  createParagraphActionsDecorations,
  createParagraphStateNodeView,
} from '../solid-editor-plugins'
import { InlineMenu, type InlineMenuConfig } from './InlineMenu'
import { MentionView } from './MentionView'
import { docToParagraphs, getParagraphIdAtPos, paragraphsToDoc } from './paragraph-conversion'
import { storySchema } from './schema'

export interface SolidEditorWrapperProps {
  /** Current paragraphs to display */
  paragraphs: Paragraph[]

  /** Callback when paragraphs change from editing */
  onParagraphsChange: (paragraphs: Paragraph[], changedIds: string[]) => void

  /** Callback when a new paragraph is created */
  onParagraphCreate: (paragraph: Omit<Paragraph, 'id'>, afterId?: string) => string

  /** Callback when a paragraph is deleted */
  onParagraphDelete: (paragraphId: string) => void

  /** Callback when current paragraph selection changes */
  onParagraphSelect?: (paragraphId: string | null) => void

  /** Callback for paragraph actions (all methods are optional) */
  onParagraphAction?: Partial<{
    moveUp: (paragraphId: string) => void
    moveDown: (paragraphId: string) => void
    delete: (paragraphId: string) => void
    addAfter: (paragraphId: string) => void
    generateBetween: (paragraphId: string) => void
    spellCheck: (paragraphId: string) => void
    rewrite: (paragraphId: string) => void
    refineStyle: (paragraphId: string) => void
    addSensory: (paragraphId: string) => void
    setState: (paragraphId: string, state: Paragraph['state']) => void
    toggleInventory: (paragraphId: string) => void
    togglePlotpoint: (paragraphId: string) => void
    customRewrite: (paragraphId: string) => void
    convertPerspective: (paragraphId: string) => void
    splitScene: (paragraphId: string) => void
  }>

  /** Callback to accept AI suggestion */
  onSuggestionAccept?: (paragraphId: string, content: string) => void

  /** Callback to reject AI suggestion */
  onSuggestionReject?: (paragraphId: string) => void

  /** Whether protagonist is set (affects some actions) */
  isProtagonistSet?: boolean

  /** Inline menu configuration (formatting, translations) */
  inlineMenuConfig?: InlineMenuConfig

  /** Show debug overlay with cursor position and document structure */
  debug?: boolean | 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'
}

/**
 * Solid-editor based editor component
 * Replaces ProseMirrorEditor with the custom solid-editor implementation
 */
export function SolidEditorWrapper(props: SolidEditorWrapperProps) {
  const [state, setState] = createSignal<EditorState | null>(null)
  const [isFocused, setIsFocused] = createSignal(false)
  // Track paragraph IDs to detect structural changes vs content changes
  let lastParagraphIds: string[] = []

  // Create plugins (memoized to avoid recreating on every render)
  const editorPlugins = createMemo(
    () => [history(), smartTypography(), createActiveParagraphPlugin(), createAssignIdPlugin()] as Plugin[],
  )

  // Create nodeViews with paragraph state rendering
  const nodeViews = createMemo(
    (): NodeViewMap => ({
      mention: MentionView,
      paragraph: createParagraphStateNodeView(() => props.paragraphs),
    }),
  )

  // Create paragraph actions config from props
  const paragraphActionsConfig = createMemo(
    (): ParagraphActionsConfig => ({
      onMoveUp: props.onParagraphAction?.moveUp,
      onMoveDown: props.onParagraphAction?.moveDown,
      onDelete: props.onParagraphAction?.delete,
      onAddAfter: props.onParagraphAction?.addAfter,
      onGenerateBetween: props.onParagraphAction?.generateBetween,
      onSpellCheck: props.onParagraphAction?.spellCheck,
      onRewrite: props.onParagraphAction?.rewrite,
      onRefineStyle: props.onParagraphAction?.refineStyle,
      onAddSensory: props.onParagraphAction?.addSensory,
      onSetState: props.onParagraphAction?.setState,
      onToggleInventory: props.onParagraphAction?.toggleInventory,
      onTogglePlotpoint: props.onParagraphAction?.togglePlotpoint,
      onCustomRewrite: props.onParagraphAction?.customRewrite,
      onConvertPerspective: props.onParagraphAction?.convertPerspective,
      onSplitScene: props.onParagraphAction?.splitScene,
      isProtagonistSet: props.isProtagonistSet,
    }),
  )

  // Initialize state when paragraphs structurally change (new/removed paragraphs)
  // Content-only changes are handled by the editor itself
  createEffect(() => {
    const paragraphs = props.paragraphs
    const currentIds = paragraphs.map((p) => p.id)
    const idsChanged =
      currentIds.length !== lastParagraphIds.length || currentIds.some((id, i) => id !== lastParagraphIds[i])

    const currentState = state()

    // Only recreate state if this is initial load or paragraph structure changed
    if (!currentState || idsChanged) {
      lastParagraphIds = currentIds
      const doc = paragraphsToDoc(paragraphs)
      const newState = EditorState.create({
        doc,
        schema: storySchema,
        plugins: editorPlugins(),
      })
      setState(newState)
    }
  })

  // Handle state changes from the editor
  const handleStateChange = (newState: EditorState) => {
    setState(newState)

    // Convert doc back to paragraphs
    const { paragraphs: newParagraphs, changedIds } = docToParagraphs(newState.doc, props.paragraphs)

    if (changedIds.length > 0) {
      // Update lastParagraphIds so the effect doesn't recreate state
      lastParagraphIds = newParagraphs.map((p) => p.id)
      props.onParagraphsChange(newParagraphs, changedIds)
    }

    // Track selected paragraph
    const paragraphId = getParagraphIdAtPos(newState.doc, newState.selection.from)
    props.onParagraphSelect?.(paragraphId)
  }

  // Handle custom dispatch for keyboard shortcuts
  const handleDispatch = (tr: import('@writer/solid-editor').Transaction) => {
    const currentState = state()
    if (!currentState) return

    // Check for Enter key handling
    // This is simplified - full implementation would intercept beforeinput
    const newState = currentState.apply(tr)
    handleStateChange(newState)
  }

  // Create editor props with decorations for paragraph actions
  const editorProps = createMemo(() => ({
    decorations: createParagraphActionsDecorations(paragraphActionsConfig, isFocused),
  }))

  return (
    <div class={`${sceneEditor} ${editorContainer}`}>
      {/* Read state() inside JSX to maintain reactivity */}
      {state() && (
        <EditorView
          state={state()!}
          onStateChange={handleStateChange}
          dispatchTransaction={handleDispatch}
          nodeViews={nodeViews()}
          editable={true}
          autoFocus={true}
          placeholder="Start writing..."
          debug={props.debug}
          onFocusChange={setIsFocused}
          props={editorProps()}
        />
      )}
      {/* Inline formatting menu */}
      <InlineMenu state={state} dispatch={handleDispatch} config={props.inlineMenuConfig} isFocused={isFocused} />
    </div>
  )
}

export default SolidEditorWrapper
