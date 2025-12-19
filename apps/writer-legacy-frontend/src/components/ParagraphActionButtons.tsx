import type { ContentNode, Scene } from '@writer/shared'
import shortUUID from 'short-uuid'
import { BsSpellcheck } from 'solid-icons/bs'
import { FiArrowDown, FiArrowUp, FiEye, FiMenu } from 'solid-icons/fi'
import { RiBuildingsAncientGateLine, RiSystemStarFill } from 'solid-icons/ri'
import { TbBuildingStore, TbTimeline } from 'solid-icons/tb'
import { createSignal } from 'solid-js'
import { contentSchemaToText } from '../lib/persistence/content-schema-to-html'
import { charactersState } from '../lib/stores/characters'
import {
  createSceneParagraph,
  moveParagraphDown,
  moveParagraphUp,
  removeSceneParagraph,
  scenesState,
  splitScene,
  updateSceneParagraphData,
} from '../lib/stores/scenes'
import { useAi } from '../lib/use-ai'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '../solid-ui/dropdown-menu'
import { AudioButton } from './AudioButton'
import { InventoryActions } from './InventoryActions'
import { PlotpointActions } from './PlotPointActions'

interface ParagraphActionButtonsProps {
  sceneId: string
  paragraphId: string
  scene?: Scene
  text: string | ContentNode
  onGenerateBetween: () => void
  aiCharacters?: string
  humanCharacters?: string
}

export const ParagraphActionButtons = (props: ParagraphActionButtonsProps) => {
  const [showInventory, setShowInventory] = createSignal(false)
  const [showPlotpoint, setShowPlotpoint] = createSignal(false)
  const [rewriteOpen, setRewriteOpen] = createSignal(false)
  const [manualRewriteText, setManualRewriteText] = createSignal('')
  const [translationModalOpen, setTranslationModalOpen] = createSignal(false)
  const [translationText, setTranslationText] = createSignal('')

  const help = async (
    helpKind:
      | 'rewrite_spelling'
      | 'rewrite'
      | 'snowflake_refine_scene_style'
      | 'snowflake_convert_perspective'
      | 'add_sensory_details',
  ) => {
    if (!props.scene) return

    updateSceneParagraphData(props.sceneId, props.paragraphId, {
      extraLoading: true,
    })

    try {
      // Get the current paragraph text
      const currentParagraphText = typeof props.text === 'string' ? props.text : contentSchemaToText(props.text)

      // Find the current paragraph index in the scene
      const currentParagraphIndex = props.scene.paragraphs.findIndex((p) => p.id === props.paragraphId)

      // Get previous and next paragraphs if they exist
      const previousParagraphs = []
      for (let i = 1; i <= 5; i++) {
        const prevIndex = currentParagraphIndex - i
        if (prevIndex >= 0) {
          const prevParagraph = props.scene.paragraphs[prevIndex]
          const prevContent =
            typeof prevParagraph.text === 'string' ? prevParagraph.text : contentSchemaToText(prevParagraph.text)
          previousParagraphs.push(prevContent)
        }
      }

      const nextParagraph = props.scene.paragraphs[currentParagraphIndex + 1]
      const nextParagraphContent = nextParagraph
        ? typeof nextParagraph.text === 'string'
          ? nextParagraph.text
          : contentSchemaToText(nextParagraph.text)
        : ''

      // Build character context
      const characterLines: string[] = []
      if (props.scene.protagonistId) {
        const protagonist = charactersState.characters[props.scene.protagonistId]
        if (protagonist) {
          characterLines.push(
            `<perspective>${protagonist.firstName}'s ${props.scene.perspective ?? 'third'}-person perspective</perspective>`,
          )

          // Add comprehensive character information for the protagonist
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
      for (const charId of props.scene?.characterIds ?? []) {
        const char = charactersState.characters[charId]
        if (!char) continue
        const charText = `${[char.firstName, char.middleName, char.lastName]
          .filter(Boolean)
          .join(' ')}: ${char.personality}`
        characterLines.push(`<present_character>${charText}</present_character>`)
      }
      for (const charId of props.scene?.referredCharacterIds ?? []) {
        const char = charactersState.characters[charId]
        if (!char) continue
        const charText = `${[char.firstName, char.middleName, char.lastName]
          .filter(Boolean)
          .join(' ')}: ${char.personality}`
        characterLines.push(`<referred_character>${charText}</referred_character>`)
      }

      // Format the text with XML tags for context
      const previousParagraphsXml = previousParagraphs
        .map((content, index) => `<previous_paragraph_${index + 1}>${content}</previous_paragraph_${index + 1}>`)
        .join('\n')

      const characterContextXml = characterLines.join('\n')

      const formattedText = `<current_paragraph>${currentParagraphText}</current_paragraph>
<next_paragraph>${nextParagraphContent}</next_paragraph>`

      // Pass the formatted text as a string to useAi
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
      updateSceneParagraphData(props.sceneId, props.paragraphId, {
        extra: result,
        extraLoading: false,
      })
    } catch (error) {
      console.error(`Failed to ${helpKind}:`, error)
      updateSceneParagraphData(props.sceneId, props.paragraphId, {
        extraLoading: false,
      })
    }
  }

  return (
    <>
      <div class="absolute top-[-0.5em] right-0 flex gap-2 z-10">
        {/* Primary Actions */}
        <div class="flex gap-1">
          <button
            type="button"
            class="btn btn-xs"
            onClick={() => moveParagraphUp(props.sceneId, props.paragraphId)}
            title="Move paragraph up"
          >
            <FiArrowUp />
          </button>
          <button
            type="button"
            class="btn btn-xs"
            onClick={() => moveParagraphDown(props.sceneId, props.paragraphId)}
            title="Move paragraph down"
          >
            <FiArrowDown />
          </button>
          <button
            type="button"
            class="btn btn-xs"
            onClick={props.onGenerateBetween}
            disabled={scenesState.scenes[props.sceneId].protagonistId === undefined}
            title="Generate content after this paragraph"
          >
            🪄
          </button>
        </div>

        {/* AI Writing Tools */}
        <div class="flex gap-1">
          <button
            type="button"
            class="btn btn-xs"
            onClick={() => help('rewrite_spelling')}
            disabled={scenesState.scenes[props.sceneId].protagonistId === undefined}
            title="Fix spelling and basic grammar"
          >
            <BsSpellcheck />
          </button>
          <button
            type="button"
            class="btn btn-xs"
            onClick={() => help('rewrite')}
            disabled={scenesState.scenes[props.sceneId].protagonistId === undefined}
            title="Rewrite with style improvements"
          >
            <RiBuildingsAncientGateLine />
          </button>
          <button
            type="button"
            class="btn btn-xs"
            onClick={() => help('snowflake_refine_scene_style')}
            disabled={scenesState.scenes[props.sceneId].protagonistId === undefined}
            title="Refine paragraph style"
          >
            <RiSystemStarFill />
          </button>
          <button
            type="button"
            class="btn btn-xs"
            onClick={() => help('add_sensory_details')}
            disabled={scenesState.scenes[props.sceneId].protagonistId === undefined}
            title="Add sensory details"
          >
            <FiEye />
          </button>
        </div>

        {/* Context Tools */}
        <div class="flex gap-1">
          <button
            type="button"
            class="btn btn-xs"
            onClick={() => setShowInventory((p) => !p)}
            title="Toggle inventory actions"
            classList={{ 'btn-primary': showInventory() }}
          >
            <TbBuildingStore />
          </button>
          <button
            type="button"
            class="btn btn-xs"
            onClick={() => setShowPlotpoint((p) => !p)}
            title="Toggle plotpoint actions"
            classList={{ 'btn-primary': showPlotpoint() }}
          >
            <TbTimeline />
          </button>
        </div>

        {/* Audio */}
        <AudioButton text={typeof props.text === 'string' ? props.text : contentSchemaToText(props.text)} />

        {/* More Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger class="btn btn-xs">
            <FiMenu />
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent class="dropdown-content menu bg-base-100 rounded-box">
              <DropdownMenuLabel>AI Assistance</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setRewriteOpen(true)}>Custom Rewrite...</DropdownMenuItem>
              <DropdownMenuItem onClick={() => help('snowflake_convert_perspective')}>
                Convert to First Person
              </DropdownMenuItem>

              <DropdownMenuLabel>Paragraph Tools</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setTranslationModalOpen(true)}>Translation</DropdownMenuItem>
              <DropdownMenuItem onClick={() => splitScene(props.sceneId, props.paragraphId)}>
                Split into New Scene
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => removeSceneParagraph(props.sceneId, props.paragraphId)}>
                Delete Paragraph
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  createSceneParagraph(
                    props.sceneId,
                    {
                      id: shortUUID.generate(),
                      text: '',
                      state: 'draft',
                      comments: [],
                    },
                    props.paragraphId,
                  )
                }
              >
                Add New Paragraph
              </DropdownMenuItem>

              <DropdownMenuLabel>Paragraph State</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => updateSceneParagraphData(props.sceneId, props.paragraphId, { state: 'draft' })}
              >
                Set as Draft
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => updateSceneParagraphData(props.sceneId, props.paragraphId, { state: 'revise' })}
              >
                Set as Revise
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => updateSceneParagraphData(props.sceneId, props.paragraphId, { state: 'ai' })}
              >
                Set as AI
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => updateSceneParagraphData(props.sceneId, props.paragraphId, { state: 'final' })}
              >
                Set as Final
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenu>

        <div class="text-xs text-gray-500">
          AI {props.aiCharacters} H {props.humanCharacters}
        </div>
      </div>

      {/* Modals and Popovers */}
      {showInventory() && (
        <div class="absolute left-2 ml-4 top-4 z-20 bg-base-100 shadow-lg rounded-lg p-4">
          <InventoryActions />
        </div>
      )}
      {showPlotpoint() && (
        <div class="absolute left-2 ml-4 top-4 z-20 bg-base-100 shadow-lg rounded-lg p-4">
          <PlotpointActions onClose={() => setShowPlotpoint(false)} />
        </div>
      )}

      {/* Rewrite Modal */}
      {rewriteOpen() && (
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="font-bold text-lg">Custom Rewrite</h3>
            <input
              type="text"
              value={manualRewriteText()}
              onInput={(e) => setManualRewriteText(e.currentTarget.value)}
              class="input input-bordered w-full"
              placeholder="Enter rewrite instructions..."
            />
            <div class="modal-action">
              <button
                type="button"
                class="btn btn-success"
                onClick={() => {
                  help('rewrite')
                  setRewriteOpen(false)
                }}
              >
                Submit
              </button>
              <button type="button" class="btn" onClick={() => setRewriteOpen(false)}>
                Close
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
              class="input input-bordered w-full"
              placeholder="Enter translation..."
            />
            <div class="modal-action">
              <button
                type="button"
                class="btn btn-success"
                onClick={() => {
                  updateSceneParagraphData(props.sceneId, props.paragraphId, {
                    translation: translationText(),
                  })
                  setTranslationModalOpen(false)
                }}
              >
                Save
              </button>
              <button type="button" class="btn" onClick={() => setTranslationModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
