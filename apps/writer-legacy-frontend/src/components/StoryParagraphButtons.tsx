import { DropdownMenu } from '@kobalte/core/dropdown-menu'
import { BsSpellcheck } from 'solid-icons/bs'
import { FiMenu } from 'solid-icons/fi'
import { ImMagicWand } from 'solid-icons/im'
import { RiBuildingsAncientGateLine, RiSystemStarFill } from 'solid-icons/ri'
import { createSignal } from 'solid-js'
import type { Scene } from '../../../shared/src/schema.ts'
import type { HelpKind } from '../lib/ai-instructions'
import { contentSchemaToText } from '../lib/persistence/content-schema-to-html.ts'
import { splitScene, updateSceneParagraphData } from '../lib/stores/scenes.ts'
import { useAi } from '../lib/use-ai.ts'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '../solid-ui/dropdown-menu.tsx'
import { AudioButton } from './AudioButton.tsx'

export const StoryParagraphButtons = (props: {
  scene?: Scene
  paragraphId: string
}) => {
  const scene = props.scene

  const currentParagraph = scene?.paragraphs.find((p) => p.id === scene.selectedParagraph)
  const [_menuOpen, _setMenuOpen] = createSignal(false)
  const [rewriteOpen, setRewriteOpen] = createSignal(false)
  const [manualRewriteText, setManualRewriteText] = createSignal('')

  const manualRewrite = async (rewriteInstruction: string) => {
    if (!scene) return
    if (!currentParagraph) {
      return
    }
    updateSceneParagraphData(scene.id, currentParagraph.id, {
      extraLoading: true,
    })
    return useAi(
      'rewrite',
      `Instruction:\n${rewriteInstruction}\n\nParagraph:\n\n${
        typeof currentParagraph.text === 'string' ? currentParagraph.text : contentSchemaToText(currentParagraph.text)
      }`,
    ).then((res) => {
      updateSceneParagraphData(scene.id, currentParagraph.id, {
        extra: res,
        extraLoading: false,
      })
    })
  }

  const refineParagraph = async () => {
    if (!scene || !currentParagraph) return

    updateSceneParagraphData(scene.id, currentParagraph.id, {
      extraLoading: true,
    })

    try {
      const paragraphText =
        typeof currentParagraph.text === 'string' ? currentParagraph.text : contentSchemaToText(currentParagraph.text)

      const critique = await useAi('snowflake_critique_scene', paragraphText)
      const refinedContent = await useAi('snowflake_refine_scene_style', [
        { text: paragraphText, canCache: true },
        { text: critique, canCache: false },
      ])

      updateSceneParagraphData(scene.id, currentParagraph.id, {
        extra: refinedContent,
        extraLoading: false,
      })
    } catch (error) {
      console.error('Failed to refine paragraph:', error)
      updateSceneParagraphData(scene.id, currentParagraph.id, {
        extraLoading: false,
      })
    }
  }

  const help = (helpKind: HelpKind, extra = false, addInstructions = true) => {
    if (!scene) return
    if (!currentParagraph) {
      return
    }

    updateSceneParagraphData(scene.id, currentParagraph.id, {
      extraLoading: true,
    })

    const currentParagraphIndex = scene.paragraphs.findIndex((p) => p.id === currentParagraph.id)
    const lastParagraphs = scene.paragraphs.slice(Math.max(0, currentParagraphIndex - 6), currentParagraphIndex)
    const _nextParagraph = scene.paragraphs[currentParagraphIndex + 1]

    return useAi(
      helpKind,
      `Previous paragraphs:
      ${lastParagraphs
        .map((lastParagraph) =>
          typeof lastParagraph.text === 'string' ? lastParagraph.text : contentSchemaToText(lastParagraph.text),
        )
        .join('\n\n')}\n\n<paragraph>${
        typeof currentParagraph.text === 'string' ? currentParagraph.text : contentSchemaToText(currentParagraph.text)
      }</paragraph>`,
      addInstructions,
    )
      .then((res) => {
        if (extra) {
          updateSceneParagraphData(scene.id, currentParagraph.id, {
            extra: res ?? undefined,
          })
        } else {
          updateSceneParagraphData(scene.id, currentParagraph.id, {
            extra: res ?? undefined,
          })
        }
      })
      .finally(() => {
        updateSceneParagraphData(scene.id, currentParagraph.id, {
          extraLoading: false,
        })
      })
  }
  const [translationModalOpen, setTranslationModalOpen] = createSignal(false)
  const [translationText, setTranslationText] = createSignal(currentParagraph?.translation ?? '')

  const convertPerspective = async () => {
    if (!scene || !currentParagraph) return

    updateSceneParagraphData(scene.id, currentParagraph.id, {
      extraLoading: true,
    })

    try {
      const paragraphText =
        typeof currentParagraph.text === 'string' ? currentParagraph.text : contentSchemaToText(currentParagraph.text)

      const convertedContent = await useAi('snowflake_convert_perspective', paragraphText)

      updateSceneParagraphData(scene.id, currentParagraph.id, {
        extra: convertedContent,
        extraLoading: false,
      })
    } catch (error) {
      console.error('Failed to convert perspective:', error)
      updateSceneParagraphData(scene.id, currentParagraph.id, {
        extraLoading: false,
      })
    }
  }

  return scene && currentParagraph ? (
    <div class="flex flex-wrap justify-end w-32 gap-2 p-2">
      <button
        type="button"
        aria-label="rewrite"
        class="btn btn-xs"
        title="Rewrite the paragraph with AI, with a focus on spelling. This will show the suggestion next to the existing paragraph."
        onClick={() => {
          help('rewrite_spelling')
        }}
      >
        <ImMagicWand />
      </button>
      <button
        type="button"
        aria-label="rewrite"
        class="btn btn-xs"
        title="Rewrite the paragraph with AI. This will show the suggestion next to the existing paragraph."
        onClick={() => {
          help('rewrite')
        }}
      >
        <RiBuildingsAncientGateLine />
      </button>
      <AudioButton
        text={
          typeof currentParagraph.text === 'string' ? currentParagraph.text : contentSchemaToText(currentParagraph.text)
        }
      />
      <button
        type="button"
        aria-label="rewrite"
        class="btn btn-xs"
        title="Fix the grammar with AI, and keep as close to the original as possible. This will show the suggestion next to the existing paragraph."
        onClick={() => {
          help('rewrite_similar', true, false)
        }}
      >
        <BsSpellcheck />
      </button>
      <button
        type="button"
        aria-label="rewrite"
        class="btn btn-xs"
        title="Fix the grammar with AI, and keep as close to the original as possible. This will show the suggestion next to the existing paragraph."
        onClick={() => {
          setRewriteOpen(true)
        }}
      >
        <RiBuildingsAncientGateLine />
      </button>
      <button
        type="button"
        aria-label="refine"
        class="btn btn-xs"
        title="Critique and refine the paragraph to improve its style and flow."
        onClick={refineParagraph}
        disabled={currentParagraph.extraLoading}
      >
        {currentParagraph.extraLoading ? <span class="loading loading-spinner loading-xs" /> : <RiSystemStarFill />}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger type="button" class="btn btn-xs" aria-label="Options">
          <FiMenu />
        </DropdownMenuTrigger>

        <DropdownMenuPortal>
          <DropdownMenuContent class="dropdown-content menu flex-col bg-base-100 rounded-box">
            <DropdownMenuItem
              onClick={() => {
                splitScene(scene.id, currentParagraph.id)
              }}
            >
              <span class="font-bold">Split into new scene from here</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                updateSceneParagraphData(scene.id, currentParagraph.id, {
                  state: 'draft',
                })
              }}
            >
              <span class="font-bold">Draft</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                updateSceneParagraphData(scene.id, currentParagraph.id, {
                  state: 'revise',
                })
              }}
            >
              Revise
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                updateSceneParagraphData(scene.id, currentParagraph.id, {
                  state: 'ai',
                })
              }}
            >
              AI
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                updateSceneParagraphData(scene.id, currentParagraph.id, {
                  state: 'final',
                })
              }}
            >
              Finalized
            </DropdownMenuItem>
            <DropdownMenuItem onClick={convertPerspective}>Convert to First Person</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTranslationModalOpen(true)}>Translation</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>

      {rewriteOpen() && (
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="font-bold text-lg">Manual Rewrite</h3>
            <input
              type="text"
              value={manualRewriteText()}
              onInput={(e) => setManualRewriteText(e.currentTarget.value)}
              class="input input-bordered w-full"
            />
            <div class="modal-action">
              <button
                type="button"
                class="btn btn-success"
                onClick={() => {
                  manualRewrite(manualRewriteText())
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
      {translationModalOpen() && (
        <div class="modal">
          <div class="modal-box">
            <h3 class="font-bold text-lg">Translation</h3>
            <input
              type="text"
              value={translationText()}
              onInput={(e) => setTranslationText(e.currentTarget.value)}
              class="input input-bordered w-full"
            />
            <div class="modal-action">
              <button
                type="button"
                class="btn btn-success"
                onClick={() => {
                  updateSceneParagraphData(scene.id, currentParagraph.id, {
                    translation: translationText(),
                  })
                  setTranslationModalOpen(false)
                }}
              >
                Save
              </button>
              <button type="button" onClick={() => setTranslationModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  ) : null
}
