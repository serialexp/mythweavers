import type { Paragraph } from '@mythweavers/shared'
import { toggleMark } from 'prosemirror-commands'
import { history, redo, undo } from 'prosemirror-history'
import { ellipsis, emDash, inputRules, smartQuotes } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import shortUUID from 'short-uuid'
import { createEffect, onCleanup } from 'solid-js'

import { createActiveParagraphPlugin } from '../prosemirror-plugins/active-paragraph'
import { assignIdPlugin } from '../prosemirror-plugins/assign-id'
import { type InlineMenuConfig, createInlineMenuPlugin } from '../prosemirror-plugins/inline-menu'
import { createParagraphActionsPlugin } from '../prosemirror-plugins/paragraph-actions'
import { createParagraphStatePlugin } from '../prosemirror-plugins/paragraph-state'
import { createSuggestionsPlugin } from '../prosemirror-plugins/suggestions'
import { editorContainer, sceneEditor } from '../scene-editor.css'
import { contentSchema } from '../schema'
import { docToParagraphs, getParagraphIdAtPos, getParagraphRange, paragraphsToDoc } from '../utils/paragraph-conversion'

const italic = toggleMark(contentSchema.marks.em)

export interface ProseMirrorEditorProps {
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

  /** Callback for paragraph actions */
  onParagraphAction?: {
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
  }

  /** Callback to accept AI suggestion */
  onSuggestionAccept?: (paragraphId: string, content: string) => void

  /** Callback to reject AI suggestion */
  onSuggestionReject?: (paragraphId: string) => void

  /** Whether protagonist is set (affects some actions) */
  isProtagonistSet?: boolean

  /** Inline menu configuration (formatting, translations) */
  inlineMenuConfig?: InlineMenuConfig
}

/**
 * Core ProseMirror editor component
 * Handles document editing, paragraph management, and user interactions
 */
export function ProseMirrorEditor(props: ProseMirrorEditorProps) {
  let containerRef: HTMLDivElement | undefined
  let view: EditorView | undefined
  let isInternalUpdate = false

  onCleanup(() => {
    if (view) {
      view.destroy()
    }
  })

  // Initialize or update editor
  createEffect(() => {
    const paragraphs = props.paragraphs

    if (!containerRef) return

    // Initialize view if it doesn't exist
    if (!view) {
      const editorNode = document.createElement('div')
      editorNode.className = `${sceneEditor} ${editorContainer}`
      containerRef.appendChild(editorNode)

      const doc = paragraphsToDoc(paragraphs)

      const state = EditorState.create({
        doc,
        schema: contentSchema,
        plugins: [
          history(),
          keymap({
            'Mod-z': undo,
            'Mod-y': redo,
            'Mod-i': italic,
            Enter: (state, dispatch) => {
              if (!dispatch) return false

              const { $head, $anchor } = state.selection
              if (!$head.sameParent($anchor)) return false

              const currentParagraphId = getParagraphIdAtPos(state.doc, $head.pos)
              if (!currentParagraphId) return false

              const paragraphRange = getParagraphRange(state.doc, currentParagraphId)
              if (!paragraphRange) return false

              const currentParagraphNode = state.doc.nodeAt(paragraphRange.from)
              if (!currentParagraphNode) return false

              const posInParagraph = $head.pos - paragraphRange.from - 1
              const fullText = currentParagraphNode.textContent
              const textBefore = fullText.slice(0, posInParagraph)
              const textAfter = fullText.slice(posInParagraph)

              const newParagraphId = shortUUID.generate()
              const tr = state.tr

              if (textAfter === '') {
                // Insert new empty paragraph after current one
                const newParagraph = state.schema.nodes.paragraph.create({ id: newParagraphId }, [])
                tr.insert(paragraphRange.to, newParagraph)
                tr.setSelection(TextSelection.create(tr.doc, paragraphRange.to + 1))
              } else {
                // Split the paragraph
                const beforeParagraph = state.schema.nodes.paragraph.create(
                  currentParagraphNode.attrs,
                  textBefore ? [state.schema.text(textBefore)] : [],
                )
                const afterParagraph = state.schema.nodes.paragraph.create(
                  { id: newParagraphId },
                  textAfter ? [state.schema.text(textAfter)] : [],
                )
                tr.replaceWith(paragraphRange.from, paragraphRange.to, [beforeParagraph, afterParagraph])
                tr.setSelection(TextSelection.create(tr.doc, paragraphRange.from + beforeParagraph.nodeSize + 1))
              }

              dispatch(tr)
              return true
            },
            'Control-Enter': () => {
              const selection = view?.state.selection
              if (selection && view) {
                const paragraphId = getParagraphIdAtPos(view.state.doc, selection.from)
                if (paragraphId && props.onParagraphCreate) {
                  props.onParagraphCreate(
                    {
                      body: '',
                      state: 'draft',
                      comments: [],
                    },
                    paragraphId,
                  )
                }
              }
              return true
            },
            'Control-Backspace': () => {
              const selection = view?.state.selection
              if (selection && view) {
                const paragraphId = getParagraphIdAtPos(view.state.doc, selection.from)
                if (paragraphId) {
                  props.onParagraphDelete(paragraphId)
                }
              }
              return true
            },
            Backspace: (state, dispatch) => {
              if (!dispatch) return false

              const { $from, $to, empty } = state.selection

              // Check if full paragraph is selected
              let isFullParagraphSelected = false
              if (!empty) {
                const $pos = state.doc.resolve($from.pos)
                const paragraph = $pos.node()
                if (paragraph && paragraph.type.name === 'paragraph') {
                  const paragraphStart = $pos.before()
                  const paragraphEnd = paragraphStart + paragraph.nodeSize
                  isFullParagraphSelected = $from.pos <= paragraphStart + 1 && $to.pos >= paragraphEnd - 1
                }
              }

              if (isFullParagraphSelected) {
                const currentParagraphId = getParagraphIdAtPos(state.doc, $from.pos)
                if (currentParagraphId) {
                  const paragraphRange = getParagraphRange(state.doc, currentParagraphId)
                  if (paragraphRange) {
                    const tr = state.tr
                    tr.delete(paragraphRange.from + 1, paragraphRange.to - 1)
                    dispatch(tr)
                    return true
                  }
                }
              }

              // Handle backspace at paragraph start
              if (empty && $from.parentOffset === 0) {
                const currentParagraphId = getParagraphIdAtPos(state.doc, $from.pos)
                if (!currentParagraphId) return false

                const paragraphRange = getParagraphRange(state.doc, currentParagraphId)
                if (!paragraphRange) return false

                const paragraphNode = state.doc.nodeAt(paragraphRange.from)
                if (!paragraphNode) return false

                // If empty paragraph, delete it
                if (paragraphNode.textContent === '') {
                  const tr = state.tr
                  tr.delete(paragraphRange.from, paragraphRange.to)
                  dispatch(tr)
                  return true
                }
              }

              return false
            },
          }),
          createInlineMenuPlugin(props.inlineMenuConfig || {}),
          assignIdPlugin,
          inputRules({ rules: smartQuotes.concat([emDash, ellipsis]) }),
          createParagraphStatePlugin(() => paragraphs),
          createActiveParagraphPlugin(),
          createSuggestionsPlugin(
            (paragraphId: string, content: string) => {
              props.onSuggestionAccept?.(paragraphId, content)
            },
            (paragraphId: string) => {
              props.onSuggestionReject?.(paragraphId)
            },
          ),
          createParagraphActionsPlugin({
            onMoveUp: (id) => props.onParagraphAction?.moveUp(id),
            onMoveDown: (id) => props.onParagraphAction?.moveDown(id),
            onDelete: (id) => props.onParagraphAction?.delete(id),
            onAddAfter: (id) => props.onParagraphAction?.addAfter(id),
            onGenerateBetween: (id) => props.onParagraphAction?.generateBetween(id),
            onSpellCheck: (id) => props.onParagraphAction?.spellCheck(id),
            onRewrite: (id) => props.onParagraphAction?.rewrite(id),
            onRefineStyle: (id) => props.onParagraphAction?.refineStyle(id),
            onAddSensory: (id) => props.onParagraphAction?.addSensory(id),
            onSetState: (id, state) => props.onParagraphAction?.setState(id, state),
            isProtagonistSet: props.isProtagonistSet ?? false,
            onToggleInventory: (id) => props.onParagraphAction?.toggleInventory(id),
            onTogglePlotpoint: (id) => props.onParagraphAction?.togglePlotpoint(id),
            onCustomRewrite: (id) => props.onParagraphAction?.customRewrite(id),
            onConvertPerspective: (id) => props.onParagraphAction?.convertPerspective(id),
            onSplitScene: (id) => props.onParagraphAction?.splitScene(id),
          }),
        ],
      })

      view = new EditorView(editorNode, {
        state,
        dispatchTransaction(transaction) {
          const newState = view!.state.apply(transaction)
          view!.updateState(newState)

          if (transaction.docChanged) {
            isInternalUpdate = true

            const { paragraphs: newParagraphs, changedIds } = docToParagraphs(newState.doc, props.paragraphs)

            props.onParagraphsChange(newParagraphs, changedIds)

            setTimeout(() => {
              isInternalUpdate = false
            }, 50)
          }

          if (transaction.selectionSet) {
            const paragraphId = getParagraphIdAtPos(newState.doc, newState.selection.from)
            props.onParagraphSelect?.(paragraphId)
          }
        },
      })
    } else {
      // Update existing view if paragraphs changed externally
      if (!isInternalUpdate) {
        const currentParagraphs = props.paragraphs
        const paragraphsChanged =
          JSON.stringify(currentParagraphs.map((p) => ({ id: p.id, body: p.body, contentSchema: p.contentSchema }))) !==
          JSON.stringify(props.paragraphs.map((p) => ({ id: p.id, body: p.body, contentSchema: p.contentSchema })))

        if (paragraphsChanged) {
          const newDoc = paragraphsToDoc(currentParagraphs)
          const newState = EditorState.create({
            doc: newDoc,
            schema: contentSchema,
            plugins: view.state.plugins,
            selection: view.state.selection,
          })
          view.updateState(newState)
        }
      }
    }
  })

  return <div ref={containerRef} />
}
