import { toggleMark } from 'prosemirror-commands'
import { history, redo, undo } from 'prosemirror-history'
import { ellipsis, emDash, inputRules, smartQuotes } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import shortUUID from 'short-uuid'
import { createEffect, createSignal, onCleanup } from 'solid-js'

import { assignIdPlugin } from './plugins/assign-id'
import { inlineMenuPlugin } from './plugins/inline-menu'
import { contentSchema } from './schema'
import './scene-editor.css'
import { createActiveParagraphPlugin } from './plugins/active-paragraph'
import { createParagraphActionsPlugin } from './plugins/paragraph-actions'
import { createParagraphStatePlugin } from './plugins/paragraph-state'
import { createSuggestionsPlugin } from './plugins/suggestions'
import {
  docToSceneParagraphs,
  getParagraphIdAtPos,
  getParagraphRange,
  sceneParagraphsToDoc,
} from './utils/paragraph-conversion'

import type { SceneParagraph } from '@writer/shared'
import { contentSchemaToText } from '../../lib/persistence/content-schema-to-html'
import { charactersState } from '../../lib/stores/characters'
import { locationsState } from '../../lib/stores/locations'
import {
  createSceneParagraph,
  moveParagraphDown,
  moveParagraphUp,
  removeSceneParagraph,
  scenesState,
  splitScene,
  updateSceneParagraphData,
  updateSceneSelectedParagraph,
} from '../../lib/stores/scenes'
import { findPathToNode } from '../../lib/stores/tree'
import { useAi } from '../../lib/use-ai'

import { setUIState, uiState } from '../../lib/stores/ui'
import { AudioButton } from '../AudioButton'
// Import the SolidJS UI components
import { InventoryActions } from '../InventoryActions'
import { PlotpointActions } from '../PlotPointActions'

const italic = toggleMark(contentSchema.marks.em)

export const SceneEditor = (props: { sceneId: string }) => {
  let containerRef: HTMLDivElement | undefined
  let view: EditorView | undefined
  const [lastKnownParagraphs, setLastKnownParagraphs] = createSignal<SceneParagraph[]>([])
  let isInternalUpdate = false // Flag to prevent circular updates

  // UI state signals
  const [currentParagraphId, setCurrentParagraphId] = createSignal<string | null>(null)
  const [showInventory, setShowInventory] = createSignal(false)
  const [showPlotpoint, setShowPlotpoint] = createSignal(false)
  const [rewriteModalOpen, setRewriteModalOpen] = createSignal(false)
  const [rewriteInstructions, setRewriteInstructions] = createSignal('')
  const [translationModalOpen, setTranslationModalOpen] = createSignal(false)
  const [translationText, setTranslationText] = createSignal('')
  const [generateBetweenModalOpen, setGenerateBetweenModalOpen] = createSignal(false)
  const [generateBetweenText, setGenerateBetweenText] = createSignal('')
  const [isGenerating, setIsGenerating] = createSignal(false)

  const scene = () => scenesState.scenes[props.sceneId]

  // Helper function to update paragraph attributes in the editor
  const updateParagraphAttrs = (paragraphId: string, attrs: { extra?: string | null; extraLoading?: boolean }) => {
    if (!view) {
      console.log('updateParagraphAttrs: no view available')
      return
    }

    const tr = view.state.tr
    let updated = false

    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'paragraph' && node.attrs.id === paragraphId) {
        const newAttrs = {
          ...node.attrs,
          extra: attrs.extra !== undefined ? attrs.extra : node.attrs.extra,
          extraLoading:
            attrs.extraLoading !== undefined ? (attrs.extraLoading ? 'true' : null) : node.attrs.extraLoading,
        }
        console.log(`updateParagraphAttrs: updating paragraph ${paragraphId}`, {
          oldAttrs: node.attrs,
          newAttrs,
        })
        tr.setNodeMarkup(pos, null, newAttrs)
        updated = true
        return false // Stop iteration
      }
    })

    if (updated) {
      console.log(`updateParagraphAttrs: dispatching transaction for paragraph ${paragraphId}`)
      view.dispatch(tr)
    } else {
      console.log(`updateParagraphAttrs: paragraph ${paragraphId} not found in document`)
    }
  }

  // Get current paragraph text for audio button
  const currentParagraphText = () => {
    const paragraphId = currentParagraphId()
    if (!paragraphId) return ''

    const currentScene = scene()
    const paragraph = currentScene?.paragraphs.find((p) => p.id === paragraphId)
    if (!paragraph) return ''

    return typeof paragraph.text === 'string' ? paragraph.text : contentSchemaToText(paragraph.text)
  }

  const help = async (
    helpKind:
      | 'rewrite_spelling'
      | 'rewrite'
      | 'snowflake_refine_scene_style'
      | 'snowflake_convert_perspective'
      | 'add_sensory_details',
    paragraphId: string,
    customInstructions?: string,
  ) => {
    const currentScene = scene()
    if (!currentScene) return

    console.log(`Starting AI help: ${helpKind} for paragraph ${paragraphId}`)

    // Show loading state in store and document
    updateSceneParagraphData(props.sceneId, paragraphId, {
      extraLoading: true,
    })
    updateParagraphAttrs(paragraphId, { extraLoading: true })

    try {
      const currentParagraph = currentScene.paragraphs.find((p) => p.id === paragraphId)
      if (!currentParagraph) return

      const currentParagraphText =
        typeof currentParagraph.text === 'string' ? currentParagraph.text : contentSchemaToText(currentParagraph.text)

      const currentParagraphIndex = currentScene.paragraphs.findIndex((p) => p.id === paragraphId)

      // Get context paragraphs
      const previousParagraphs = []
      for (let i = 1; i <= 5; i++) {
        const prevIndex = currentParagraphIndex - i
        if (prevIndex >= 0) {
          const prevParagraph = currentScene.paragraphs[prevIndex]
          const prevContent =
            typeof prevParagraph.text === 'string' ? prevParagraph.text : contentSchemaToText(prevParagraph.text)
          previousParagraphs.push(prevContent)
        }
      }

      const nextParagraph = currentScene.paragraphs[currentParagraphIndex + 1]
      const nextParagraphContent = nextParagraph
        ? typeof nextParagraph.text === 'string'
          ? nextParagraph.text
          : contentSchemaToText(nextParagraph.text)
        : ''

      // Build character context
      const characterLines: string[] = []
      if (currentScene.protagonistId) {
        const protagonist = charactersState.characters[currentScene.protagonistId]
        if (protagonist) {
          characterLines.push(
            `<perspective>${protagonist.firstName}'s ${currentScene.perspective ?? 'third'}-person perspective</perspective>`,
          )

          const protagonistDetails = [
            `Name: ${protagonist.firstName} ${protagonist.lastName || ''}`,
            `Personality: ${protagonist.personality || 'Not provided'}`,
            `Personality Quirks: ${protagonist.personalityQuirks || 'Not provided'}`,
            `Likes: ${protagonist.likes || 'Not provided'}`,
            `Dislikes: ${protagonist.dislikes || 'Not provided'}`,
            `Background: ${protagonist.background || 'Not provided'}`,
            `Distinguishing Features: ${protagonist.distinguishingFeatures || 'Not provided'}`,
            `Age: ${protagonist.age || 'Not provided'}`,
            `Gender: ${protagonist.gender || 'Not provided'}`,
            `Sexual Orientation: ${protagonist.sexualOrientation || 'Not provided'}`,
          ]
            .filter((line) => !line.endsWith('Not provided'))
            .join('\n')

          if (protagonistDetails) {
            characterLines.push(`<protagonist_details>${protagonistDetails}</protagonist_details>`)
          }

          if (protagonist.writingStyle) {
            characterLines.push(`<protagonist_writing_style>${protagonist.writingStyle}</protagonist_writing_style>`)
          }
        }
      }

      for (const charId of currentScene?.characterIds ?? []) {
        const char = charactersState.characters[charId]
        if (!char) continue
        const charText = `${[char.firstName, char.middleName, char.lastName]
          .filter(Boolean)
          .join(' ')}: ${char.personality}`
        characterLines.push(`<present_character>${charText}</present_character>`)
      }

      for (const charId of currentScene?.referredCharacterIds ?? []) {
        const char = charactersState.characters[charId]
        if (!char) continue
        const charText = `${[char.firstName, char.middleName, char.lastName]
          .filter(Boolean)
          .join(' ')}: ${char.personality}`
        characterLines.push(`<referred_character>${charText}</referred_character>`)
      }

      const previousParagraphsXml = previousParagraphs
        .map((content, index) => `<previous_paragraph_${index + 1}>${content}</previous_paragraph_${index + 1}>`)
        .join('\n')

      const characterContextXml = characterLines.join('\n')

      let formattedText = `<current_paragraph>${currentParagraphText}</current_paragraph>
<next_paragraph>${nextParagraphContent}</next_paragraph>`

      // Add custom instructions if provided
      if (customInstructions) {
        formattedText += `\n<custom_instructions>${customInstructions}</custom_instructions>`
      }

      const result = await useAi(helpKind, [
        {
          text: characterContextXml,
          canCache: characterContextXml.length > 0,
        },
        {
          text: previousParagraphsXml,
          canCache: previousParagraphsXml.length > 0,
        },
        {
          text: formattedText,
          canCache: false,
        },
      ])

      console.log(`AI help completed: ${helpKind}, result length: ${result?.length || 0}`)

      // Show suggestion in store and document
      updateSceneParagraphData(props.sceneId, paragraphId, {
        extra: result,
        extraLoading: false,
      })
      updateParagraphAttrs(paragraphId, { extra: result, extraLoading: false })
    } catch (error) {
      console.error(`Failed to ${helpKind}:`, error)
      updateSceneParagraphData(props.sceneId, paragraphId, {
        extraLoading: false,
      })
      updateParagraphAttrs(paragraphId, { extraLoading: false })
    }
  }

  // Custom rewrite handler
  const handleCustomRewrite = () => {
    const paragraphId = currentParagraphId()
    if (!paragraphId || !rewriteInstructions().trim()) return

    help('rewrite', paragraphId, rewriteInstructions())
    setRewriteModalOpen(false)
    setRewriteInstructions('')
  }

  // Translation handler
  const handleSaveTranslation = () => {
    const paragraphId = currentParagraphId()
    if (!paragraphId) return

    updateSceneParagraphData(props.sceneId, paragraphId, {
      translation: translationText(),
    })
    setTranslationModalOpen(false)
    setTranslationText('')
  }

  // Generate between handler
  const generateBetween = async () => {
    const paragraphId = currentParagraphId()
    const currentScene = scene()
    if (!paragraphId || !currentScene) return

    // Store the generate text in UI state for reuse
    setUIState('generateBetweenText', generateBetweenText())

    const paragraphIndex = currentScene.paragraphs.findIndex((p) => p.id === paragraphId)
    if (paragraphIndex === -1) return

    // Get context from surrounding paragraphs
    const previousParagraphs = currentScene.paragraphs.slice(0, paragraphIndex + 1)
    const nextParagraphs = currentScene.paragraphs.slice(paragraphIndex + 1, paragraphIndex + 4)

    // Build character and location context
    const characterLines: string[] = []
    if (currentScene.protagonistId) {
      const protagonist = charactersState.characters[currentScene.protagonistId]
      if (protagonist) {
        characterLines.push(
          `<perspective>${protagonist.firstName}'s ${currentScene.perspective ?? 'third'} person perspective - ${protagonist.summary}</perspective>`,
        )
      }
    }
    for (const charId of currentScene?.characterIds ?? []) {
      const char = charactersState.characters[charId]
      if (!char) continue
      const charText = `${[char.firstName, char.middleName, char.lastName].filter(Boolean).join(' ')}: ${char.summary}`
      characterLines.push(`<present_character>${charText}</present_character>`)
    }
    for (const charId of currentScene?.referredCharacterIds ?? []) {
      const char = charactersState.characters[charId]
      if (!char) continue
      const charText = `${[char.firstName, char.middleName, char.lastName].filter(Boolean).join(' ')}: ${char.summary}`
      characterLines.push(`<referred_character>${charText}</referred_character>`)
    }

    const locationLines: string[] = []
    if (currentScene?.locationId) {
      locationLines.push(
        `<current_location>${locationsState.locations[currentScene.locationId].description}</current_location>`,
      )
    }

    // Get chapter context
    const [_bookNode, arcNode, chapterNode] = findPathToNode(props.sceneId)
    const previousChapter =
      chapterNode?.children?.[0]?.id === currentScene.id
        ? arcNode?.children?.[arcNode.children.findIndex((c) => c.id === chapterNode.id) - 1]
        : null

    const chapterContext = [
      '<chapter_info>',
      `<current_chapter>${chapterNode.name}</current_chapter>`,
      previousChapter ? `<previous_chapter>${previousChapter.name}</previous_chapter>` : '',
      '</chapter_info>',
    ]
      .filter(Boolean)
      .join('\n')

    const sceneContext = {
      text: [
        chapterContext,
        '<scene_setup>',
        characterLines.join('\n'),
        locationLines.join('\n'),
        '</scene_setup>',
      ].join('\n'),
      canCache: true,
    }

    setIsGenerating(true)
    try {
      const result = await useAi('generate_between', [
        sceneContext,
        {
          text: [
            '<previous_content>',
            previousParagraphs
              .map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text)))
              .join('\n\n'),
            '</previous_content>',
            '<next_content>',
            nextParagraphs.map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text))).join('\n\n'),
            '</next_content>',
          ].join('\n'),
          canCache: false,
        },
        {
          text: `<instructions>Write content that bridges these sections with the following happening: ${generateBetweenText()}</instructions>`,
          canCache: false,
        },
      ])

      const paragraphs = result.split('\n\n')
      let afterId = paragraphId
      for (const paragraph of paragraphs) {
        const newId = shortUUID.generate()
        createSceneParagraph(
          props.sceneId,
          {
            id: newId,
            text: paragraph,
            state: 'ai',
            comments: [],
          },
          afterId,
        )
        afterId = newId
      }
      setGenerateBetweenModalOpen(false)
      setGenerateBetweenText('')

      // Force editor to update with new paragraphs
      if (view) {
        const currentView = view // Capture view reference
        setTimeout(() => {
          const updatedScene = scenesState.scenes[props.sceneId]
          if (updatedScene && currentView) {
            const newDoc = sceneParagraphsToDoc(updatedScene.paragraphs)
            const newState = EditorState.create({
              doc: newDoc,
              schema: contentSchema,
              plugins: currentView.state.plugins,
            })
            currentView.updateState(newState)
            setLastKnownParagraphs(updatedScene.paragraphs)
          }
        }, 100)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  onCleanup(() => {
    if (view) {
      view.destroy()
    }
  })

  createEffect(() => {
    const currentScene = scene()
    if (!currentScene || !containerRef) return

    // Initialize view if it doesn't exist
    if (!view) {
      const editorNode = document.createElement('div')
      editorNode.className = 'scene-editor'
      editorNode.style.cssText = `
        min-height: 200px;
        padding: 16px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: white;
        font-family: inherit;
        line-height: 1.6;
      `
      containerRef.appendChild(editorNode)

      const doc = sceneParagraphsToDoc(currentScene.paragraphs)

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

              // Get the current paragraph node and its position
              const paragraphRange = getParagraphRange(state.doc, currentParagraphId)
              if (!paragraphRange) return false

              const _resolvedPos = state.doc.resolve($head.pos)
              const currentParagraphNode = state.doc.nodeAt(paragraphRange.from)
              if (!currentParagraphNode) return false

              // Calculate position within the paragraph (excluding the paragraph node itself)
              const posInParagraph = $head.pos - paragraphRange.from - 1

              // Get text before and after cursor
              const fullText = currentParagraphNode.textContent
              const textBefore = fullText.slice(0, posInParagraph)
              const textAfter = fullText.slice(posInParagraph)

              // Create new paragraph ID for the split
              const newParagraphId = shortUUID.generate()

              // Start transaction
              const tr = state.tr

              // If we're at the end of the paragraph, just create a new empty paragraph after
              if (textAfter === '') {
                // Insert a new empty paragraph after the current one
                const newParagraph = state.schema.nodes.paragraph.create({ id: newParagraphId }, [])
                tr.insert(paragraphRange.to, newParagraph)

                // Move cursor to the new paragraph
                tr.setSelection(TextSelection.create(tr.doc, paragraphRange.to + 1))
              } else {
                // We need to split the paragraph
                // First, update the current paragraph to only have the text before cursor
                const beforeParagraph = state.schema.nodes.paragraph.create(
                  currentParagraphNode.attrs,
                  textBefore ? [state.schema.text(textBefore)] : [],
                )

                // Create the new paragraph with text after cursor
                const afterParagraph = state.schema.nodes.paragraph.create(
                  { id: newParagraphId },
                  textAfter ? [state.schema.text(textAfter)] : [],
                )

                // Replace the current paragraph with both new paragraphs
                tr.replaceWith(paragraphRange.from, paragraphRange.to, [beforeParagraph, afterParagraph])

                // Position cursor at start of new paragraph
                tr.setSelection(TextSelection.create(tr.doc, paragraphRange.from + beforeParagraph.nodeSize + 1))
              }

              // Dispatch the transaction
              dispatch(tr)

              // The dispatchTransaction handler will sync the new paragraph to the store
              return true
            },

            'Control-Enter': () => {
              const selection = view?.state.selection
              if (selection && view) {
                const paragraphId = getParagraphIdAtPos(view.state.doc, selection.from)
                if (paragraphId) {
                  createSceneParagraph(
                    props.sceneId,
                    {
                      id: shortUUID.generate(),
                      text: '',
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
                  // Find the position of the previous paragraph before deletion
                  const currentScene = scene()
                  if (currentScene) {
                    const currentParagraphs = currentScene.paragraphs
                    const currentIndex = currentParagraphs.findIndex((p) => p.id === paragraphId)

                    // Delete the paragraph
                    removeSceneParagraph(props.sceneId, paragraphId)

                    // Set cursor to end of previous paragraph if it exists
                    if (currentIndex > 0) {
                      const previousParagraphId = currentParagraphs[currentIndex - 1].id
                      // Use setTimeout to wait for the document to update
                      setTimeout(() => {
                        if (view) {
                          const previousRange = getParagraphRange(view.state.doc, previousParagraphId)
                          if (previousRange) {
                            // Position cursor at the end of the previous paragraph (before the closing tag)
                            const endPos = previousRange.to - 1
                            const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, endPos))
                            view.dispatch(tr)
                            view.focus()
                          }
                        }
                      }, 50)
                    }
                  }
                }
              }
              return true
            },
            Delete: (_state, dispatch) => {
              if (!dispatch) return false

              // Let ProseMirror handle all delete operations by default
              return false
            },
            Backspace: (state, dispatch) => {
              if (!dispatch) return false

              const { $from, $to, empty } = state.selection

              // Check if we have a full paragraph selection
              let isFullParagraphSelected = false
              if (!empty) {
                // Get the paragraph boundaries
                const $pos = state.doc.resolve($from.pos)
                const paragraph = $pos.node()
                if (paragraph && paragraph.type.name === 'paragraph') {
                  const paragraphStart = $pos.before()
                  const paragraphEnd = paragraphStart + paragraph.nodeSize

                  // Check if selection spans the entire paragraph content
                  isFullParagraphSelected = $from.pos <= paragraphStart + 1 && $to.pos >= paragraphEnd - 1
                }
              }

              // Log current paragraph ID before any action
              const currentParagraphId = getParagraphIdAtPos(state.doc, $from.pos)
              console.log('Backspace pressed in paragraph:', {
                paragraphId: currentParagraphId,
                empty,
                selectionFrom: $from.pos,
                selectionTo: $to.pos,
                isFullParagraphSelected,
                selectionDirection: $from.pos < $to.pos ? 'forward' : 'backward',
              })

              // If full paragraph is selected, handle it specially
              if (isFullParagraphSelected) {
                const paragraphRange = getParagraphRange(state.doc, currentParagraphId)
                if (paragraphRange) {
                  // Just clear the paragraph content, don't let ProseMirror create a new one
                  const tr = state.tr
                  // Delete content but keep the paragraph node
                  tr.delete(paragraphRange.from + 1, paragraphRange.to - 1)
                  dispatch(tr)
                  return true // Prevent default behavior
                }
              }

              // Only handle backspace at the beginning of a paragraph
              if (empty && $from.parentOffset === 0) {
                const currentParagraphId = getParagraphIdAtPos(state.doc, $from.pos)
                if (!currentParagraphId) return false

                const currentScene = scene()
                if (!currentScene) return false

                const paragraphIndex = currentScene.paragraphs.findIndex((p) => p.id === currentParagraphId)

                // Get the current paragraph node to check if it's empty
                const paragraphRange = getParagraphRange(state.doc, currentParagraphId)
                if (!paragraphRange) return false

                const paragraphNode = state.doc.nodeAt(paragraphRange.from)
                if (!paragraphNode) return false

                // If this is the first paragraph
                if (paragraphIndex <= 0) {
                  // Only prevent default if paragraph is empty (nothing to merge with)
                  if (paragraphNode.textContent === '') {
                    return true // Prevent backspace on empty first paragraph
                  }
                  // Otherwise let default handle it (deleting content)
                  return false
                }

                // If the paragraph is empty, delete it and merge with previous
                if (paragraphNode.textContent === '') {
                  const previousParagraphId = currentScene.paragraphs[paragraphIndex - 1].id
                  const previousRange = getParagraphRange(state.doc, previousParagraphId)
                  if (!previousRange) return false

                  // Delete the empty paragraph
                  const tr = state.tr
                  tr.delete(paragraphRange.from, paragraphRange.to)

                  // Move cursor to end of previous paragraph
                  tr.setSelection(TextSelection.create(tr.doc, previousRange.to - 1))
                  dispatch(tr)

                  return true
                }

                // Otherwise, let ProseMirror handle the paragraph merge
                return false
              }

              return false // Let default backspace handle normal deletion
            },
          }),
          inlineMenuPlugin,
          assignIdPlugin,
          inputRules({ rules: smartQuotes.concat([emDash, ellipsis]) }),
          createParagraphStatePlugin(() => scene()?.paragraphs || []),
          createActiveParagraphPlugin(),
          createSuggestionsPlugin(
            (paragraphId: string, content: string) => {
              // Accept suggestion
              updateSceneParagraphData(props.sceneId, paragraphId, {
                text: content,
                extra: '',
                extraLoading: false,
              })
              updateParagraphAttrs(paragraphId, {
                extra: null,
                extraLoading: false,
              })
            },
            (paragraphId: string) => {
              // Reject suggestion
              updateSceneParagraphData(props.sceneId, paragraphId, {
                extra: '',
                extraLoading: false,
              })
              updateParagraphAttrs(paragraphId, {
                extra: null,
                extraLoading: false,
              })
            },
          ),
          createParagraphActionsPlugin({
            onMoveUp: (paragraphId) => moveParagraphUp(props.sceneId, paragraphId),
            onMoveDown: (paragraphId) => moveParagraphDown(props.sceneId, paragraphId),
            onDelete: (paragraphId) => removeSceneParagraph(props.sceneId, paragraphId),
            onAddAfter: (paragraphId) =>
              createSceneParagraph(
                props.sceneId,
                {
                  id: shortUUID.generate(),
                  text: '',
                  state: 'draft',
                  comments: [],
                },
                paragraphId,
              ),
            onGenerateBetween: async (paragraphId) => {
              setCurrentParagraphId(paragraphId)
              // Load existing generate between text if available
              if (uiState.generateBetweenText) {
                setGenerateBetweenText(uiState.generateBetweenText)
              }
              setGenerateBetweenModalOpen(true)
            },
            onSpellCheck: (paragraphId) => help('rewrite_spelling', paragraphId),
            onRewrite: (paragraphId) => help('rewrite', paragraphId),
            onRefineStyle: (paragraphId) => help('snowflake_refine_scene_style', paragraphId),
            onAddSensory: (paragraphId) => help('add_sensory_details', paragraphId),
            onSetState: (paragraphId, state) => updateSceneParagraphData(props.sceneId, paragraphId, { state }),
            isProtagonistSet: !!currentScene.protagonistId,
            // New callbacks for SolidJS components
            onToggleInventory: (paragraphId) => {
              setCurrentParagraphId(paragraphId)
              setShowInventory((prev) => !prev)
              setShowPlotpoint(false) // Close other popover
            },
            onTogglePlotpoint: (paragraphId) => {
              setCurrentParagraphId(paragraphId)
              setShowPlotpoint((prev) => !prev)
              setShowInventory(false) // Close other popover
            },
            onCustomRewrite: (paragraphId) => {
              setCurrentParagraphId(paragraphId)
              setRewriteModalOpen(true)
            },
            onTranslation: (paragraphId) => {
              setCurrentParagraphId(paragraphId)
              // Load existing translation if any
              const currentScene = scene()
              const paragraph = currentScene?.paragraphs.find((p) => p.id === paragraphId)
              if (paragraph?.translation) {
                setTranslationText(paragraph.translation)
              }
              setTranslationModalOpen(true)
            },
            onConvertPerspective: (paragraphId) => help('snowflake_convert_perspective', paragraphId),
            onSplitScene: (paragraphId) => splitScene(props.sceneId, paragraphId),
          }),
        ],
      })

      view = new EditorView(editorNode, {
        state,
        dispatchTransaction(transaction) {
          console.log('Transaction:', {
            docChanged: transaction.docChanged,
            steps: transaction.steps.length,
            stepTypes: transaction.steps.map((s) => s.toJSON().stepType),
          })

          const newState = view!.state.apply(transaction)
          view!.updateState(newState)

          if (transaction.docChanged) {
            // Set flag to prevent external updates while we're updating from editor
            isInternalUpdate = true

            // Debug logging for deletion
            const oldParaIds = []
            state.doc.descendants((node, _pos) => {
              if (node.type.name === 'paragraph' && node.attrs.id) {
                oldParaIds.push(node.attrs.id)
              }
            })

            const newParaIds = []
            newState.doc.descendants((node, _pos) => {
              if (node.type.name === 'paragraph' && node.attrs.id) {
                newParaIds.push(node.attrs.id)
              }
            })

            if (oldParaIds.length !== newParaIds.length || !oldParaIds.every((id, i) => id === newParaIds[i])) {
              console.log('Paragraph IDs changed:', {
                before: oldParaIds,
                after: newParaIds,
                added: newParaIds.filter((id) => !oldParaIds.includes(id)),
                removed: oldParaIds.filter((id) => !newParaIds.includes(id)),
              })
            }

            // Convert document back to paragraphs and update store
            const { paragraphs, changedIds } = docToSceneParagraphs(newState.doc, lastKnownParagraphs())

            // Debug: Log when we have selection deletion
            if (!state.selection.empty && transaction.selection.empty) {
              console.log('Selection deleted', {
                oldParagraphs: lastKnownParagraphs().length,
                newParagraphs: paragraphs.length,
                paragraphs: paragraphs.map((p) => ({ id: p.id, text: p.text })),
              })
            }

            // First, check if there are any new paragraphs in the document that aren't in the store
            const currentScene = scene()
            let newParagraphIds: string[] = []

            if (currentScene) {
              const storeIds = new Set(currentScene.paragraphs.map((p) => p.id))
              const docIds = new Set(paragraphs.map((p) => p.id))

              // Find paragraphs that exist in the document but not in the store
              newParagraphIds = Array.from(docIds).filter((id) => !storeIds.has(id))

              // Add new paragraphs to the store
              for (const newId of newParagraphIds) {
                const newParagraph = paragraphs.find((p) => p.id === newId)
                if (newParagraph) {
                  const paragraphIndex = paragraphs.findIndex((p) => p.id === newId)

                  // Check if this is a duplicate of an emptied paragraph
                  let _isDuplicate = false
                  if (paragraphIndex > 0) {
                    const prevParagraph = paragraphs[paragraphIndex - 1]
                    const prevStoreP = currentScene.paragraphs.find((p) => p.id === prevParagraph.id)

                    // If previous paragraph just became empty and new paragraph has similar content
                    // as what the previous paragraph had, this is a duplicate
                    if (
                      prevParagraph.text === '' &&
                      prevStoreP &&
                      typeof prevStoreP.text === 'string' &&
                      prevStoreP.text.trim() !== '' &&
                      newParagraph.text.includes(prevStoreP.text.substring(0, 50))
                    ) {
                      _isDuplicate = true
                      console.log('Preventing duplicate paragraph creation - removing the empty one instead')

                      // Remove the empty paragraph from the document
                      const emptyParagraphRange = getParagraphRange(newState.doc, prevParagraph.id)
                      if (emptyParagraphRange) {
                        const tr = newState.tr
                        tr.delete(emptyParagraphRange.from, emptyParagraphRange.to)

                        // Apply the transaction to remove the empty paragraph
                        setTimeout(() => {
                          if (view) {
                            view.dispatch(tr)
                          }
                        }, 0)
                      }

                      continue // Skip creating this paragraph
                    }
                  }

                  let afterId: string | undefined

                  if (paragraphIndex > 0) {
                    afterId = paragraphs[paragraphIndex - 1].id
                  }

                  createSceneParagraph(
                    props.sceneId,
                    {
                      id: newId,
                      text: newParagraph.text,
                      state: 'draft',
                      comments: [],
                      extra: newParagraph.extra,
                      extraLoading: newParagraph.extraLoading,
                    },
                    afterId,
                  )
                }
              }

              // Find paragraphs that were removed from the document
              const removedIds = Array.from(storeIds).filter((id) => !docIds.has(id))
              for (const removedId of removedIds) {
                removeSceneParagraph(props.sceneId, removedId)
              }
            }

            // Handle changed paragraphs
            for (const paragraphId of changedIds) {
              const paragraph = paragraphs.find((p) => p.id === paragraphId)
              if (paragraph) {
                // Check if this paragraph exists in the store
                const existsInStore = currentScene?.paragraphs.some((p) => p.id === paragraphId)

                if (existsInStore) {
                  // Check if paragraph became empty and there's a new paragraph after it
                  const paragraphIndex = paragraphs.findIndex((p) => p.id === paragraphId)
                  const nextParagraph = paragraphs[paragraphIndex + 1]

                  if (paragraph.text === '' && nextParagraph && newParagraphIds.includes(nextParagraph.id)) {
                    // This might be the duplicate paragraph issue
                    console.log('Detected potential duplicate paragraph scenario', {
                      emptyParagraphId: paragraphId,
                      newParagraphId: nextParagraph.id,
                      newParagraphText: nextParagraph.text,
                    })
                  }

                  // Update existing paragraph
                  updateSceneParagraphData(props.sceneId, paragraphId, {
                    text: paragraph.text,
                  })
                }
              }
            }

            setLastKnownParagraphs(paragraphs)

            // Reset flag after a short delay to allow store updates to complete
            setTimeout(() => {
              isInternalUpdate = false
            }, 50)
          }

          // Handle selection changes for paragraph tracking
          if (transaction.selectionSet) {
            const paragraphId = getParagraphIdAtPos(newState.doc, newState.selection.from)
            if (paragraphId) {
              setCurrentParagraphId(paragraphId)
              updateSceneSelectedParagraph(props.sceneId, paragraphId)
            }
          }
        },
      })

      setLastKnownParagraphs(currentScene.paragraphs)
    } else {
      // Update existing view if paragraphs changed externally (not from editor input)
      const currentParagraphs = currentScene.paragraphs
      const lastParagraphs = lastKnownParagraphs()

      // Check if document structure changed (text content or paragraph count)
      const paragraphsChanged =
        currentParagraphs.length !== lastParagraphs.length ||
        JSON.stringify(currentParagraphs.map((p) => ({ id: p.id, text: p.text }))) !==
          JSON.stringify(lastParagraphs.map((p) => ({ id: p.id, text: p.text })))

      // Always update if we're not in an internal update and paragraphs changed
      if (paragraphsChanged && !isInternalUpdate) {
        console.log('Scene editor: Syncing editor with store changes', {
          isInternalUpdate,
          currentCount: currentParagraphs.length,
          lastCount: lastParagraphs.length,
        })

        const newDoc = sceneParagraphsToDoc(currentParagraphs)
        const newState = EditorState.create({
          doc: newDoc,
          schema: contentSchema,
          plugins: view.state.plugins,
          selection: view.state.selection,
        })
        view.updateState(newState)
        setLastKnownParagraphs(currentParagraphs)
      } else if (paragraphsChanged && isInternalUpdate) {
        // If paragraphs changed but we're in internal update, it might be external changes
        // Schedule a check after internal update completes
        setTimeout(() => {
          if (!isInternalUpdate) {
            const latestParagraphs = scene()?.paragraphs || []
            const currentLastKnown = lastKnownParagraphs()

            if (
              latestParagraphs.length !== currentLastKnown.length ||
              JSON.stringify(latestParagraphs.map((p) => ({ id: p.id, text: p.text }))) !==
                JSON.stringify(currentLastKnown.map((p) => ({ id: p.id, text: p.text })))
            ) {
              console.log('Scene editor: Delayed sync after internal update')
              const newDoc = sceneParagraphsToDoc(latestParagraphs)
              const newState = EditorState.create({
                doc: newDoc,
                schema: contentSchema,
                plugins: view.state.plugins,
                selection: view.state.selection,
              })
              view.updateState(newState)
              setLastKnownParagraphs(latestParagraphs)
            }
          }
        }, 200)
      }
    }
  })

  return (
    <div>
      <div ref={containerRef} />

      {/* Floating Inventory Actions */}
      {showInventory() && (
        <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-base-100 shadow-lg rounded-lg p-4 border border-gray-200">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-lg">Inventory Actions</h3>
            <button type="button" class="btn btn-sm btn-ghost" onClick={() => setShowInventory(false)}>
              ✕
            </button>
          </div>
          <InventoryActions />
        </div>
      )}

      {/* Floating Plotpoint Actions */}
      {showPlotpoint() && (
        <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-base-100 shadow-lg rounded-lg p-4 border border-gray-200">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-lg">Plot Point Actions</h3>
            <button type="button" class="btn btn-sm btn-ghost" onClick={() => setShowPlotpoint(false)}>
              ✕
            </button>
          </div>
          <PlotpointActions onClose={() => setShowPlotpoint(false)} />
        </div>
      )}

      {/* Audio Button - Fixed position when paragraph is selected */}
      {currentParagraphId() && currentParagraphText() && (
        <div class="fixed top-4 right-4 z-40">
          <AudioButton text={currentParagraphText()} />
        </div>
      )}

      {/* Custom Rewrite Modal */}
      {rewriteModalOpen() && (
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="font-bold text-lg">Custom Rewrite</h3>
            <input
              type="text"
              value={rewriteInstructions()}
              onInput={(e) => setRewriteInstructions(e.currentTarget.value)}
              class="input input-bordered w-full mt-4"
              placeholder="Enter rewrite instructions..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCustomRewrite()
                }
              }}
            />
            <div class="modal-action">
              <button
                type="button"
                class="btn btn-success"
                onClick={handleCustomRewrite}
                disabled={!rewriteInstructions().trim()}
              >
                Submit
              </button>
              <button
                type="button"
                class="btn"
                onClick={() => {
                  setRewriteModalOpen(false)
                  setRewriteInstructions('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Translation Modal */}
      {translationModalOpen() && (
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="font-bold text-lg">Translation</h3>
            <input
              type="text"
              value={translationText()}
              onInput={(e) => setTranslationText(e.currentTarget.value)}
              class="input input-bordered w-full mt-4"
              placeholder="Enter translation..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSaveTranslation()
                }
              }}
            />
            <div class="modal-action">
              <button type="button" class="btn btn-success" onClick={handleSaveTranslation}>
                Save
              </button>
              <button
                type="button"
                class="btn"
                onClick={() => {
                  setTranslationModalOpen(false)
                  setTranslationText('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Between Modal */}
      {generateBetweenModalOpen() && (
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="font-bold text-lg">Generate Content</h3>
            <p class="py-4">What should happen in the generated content?</p>
            <textarea
              class="textarea textarea-bordered w-full"
              rows={5}
              value={generateBetweenText()}
              onInput={(e) => setGenerateBetweenText(e.currentTarget.value)}
              placeholder="Describe what should happen in this section..."
            />
            <div class="modal-action">
              <button
                type="button"
                class="btn btn-primary"
                onClick={generateBetween}
                disabled={isGenerating() || !generateBetweenText().trim()}
              >
                {isGenerating() ? <span class="loading loading-spinner" /> : 'Generate'}
              </button>
              <button
                type="button"
                class="btn"
                onClick={() => {
                  setGenerateBetweenModalOpen(false)
                  setGenerateBetweenText('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
