import shortUUID from 'short-uuid'
import { AiOutlineCheck, AiOutlineDelete } from 'solid-icons/ai'
import { For, createSignal } from 'solid-js'
import type { SceneParagraph } from '../../../shared/src/schema.ts'
import { contentSchemaToText } from '../lib/persistence/content-schema-to-html'
import { charactersState } from '../lib/stores/characters.ts'
import { updateEditorContent } from '../lib/stores/editor.ts'
import { locationsState } from '../lib/stores/locations.ts'
import { currentScene } from '../lib/stores/retrieval/current-scene.ts'
import {
  createSceneParagraph,
  scenesState,
  updateSceneParagraphData,
  updateSceneSelectedParagraph,
} from '../lib/stores/scenes.ts'
import { findPathToNode } from '../lib/stores/tree.ts'
import { uiState } from '../lib/stores/ui.ts'
import { useAi } from '../lib/use-ai'
import { AutoResizeTextarea } from './AutoResizeTextarea'
import { ParagraphActionButtons } from './ParagraphActionButtons'
import { ParagraphDetails } from './ParagraphDetails.tsx'
import { Row } from './Row'
import { Editor } from './editor/Editor.tsx'

const statusColor: Record<SceneParagraph['state'], string> = {
  draft: 'border-yellow-500',
  revise: 'border-red-500',
  sdt: 'border-blue-500',
  final: 'border-green-500',
  ai: 'border-purple-500',
}

export const Paragraph = (props: {
  sceneId: string
  paragraph: SceneParagraph
  identifyLocation?: boolean
}) => {
  const [generateBetweenOpen, setGenerateBetweenOpen] = createSignal(false)
  const [generateBetweenText, setGenerateBetweenText] = createSignal('')
  const [isGenerating, setIsGenerating] = createSignal(false)

  const generateBetween = async () => {
    const scene = scenesState.scenes[props.sceneId]
    if (!scene) return

    const paragraphIndex = scene.paragraphs.findIndex((p) => p.id === props.paragraph.id)

    // Get context from surrounding paragraphs
    const previousParagraphs = scene.paragraphs.slice(0, paragraphIndex + 1)
    const nextParagraphs = scene.paragraphs.slice(paragraphIndex + 1, paragraphIndex + 4)

    // Build character and location context
    const characterLines: string[] = []
    if (scene.protagonistId) {
      const protagonist = charactersState.characters[scene.protagonistId]
      if (protagonist) {
        characterLines.push(
          `<perspective>${protagonist.firstName}'s ${scene.perspective ?? 'third'} person perspective - ${protagonist.summary}</perspective>`,
        )
      }
    }
    for (const charId of scene?.characterIds ?? []) {
      const char = charactersState.characters[charId]
      if (!char) continue
      const charText = `${[char.firstName, char.middleName, char.lastName].filter(Boolean).join(' ')}: ${char.summary}`
      characterLines.push(`<present_character>${charText}</present_character>`)
    }
    for (const charId of scene?.referredCharacterIds ?? []) {
      const char = charactersState.characters[charId]
      if (!char) continue
      const charText = `${[char.firstName, char.middleName, char.lastName].filter(Boolean).join(' ')}: ${char.summary}`
      characterLines.push(`<referred_character>${charText}</referred_character>`)
    }

    const locationLines: string[] = []
    if (scene?.locationId) {
      locationLines.push(
        `<current_location>${locationsState.locations[scene.locationId].description}</current_location>`,
      )
    }

    // Get chapter context
    const [_bookNode, arcNode, chapterNode] = findPathToNode(props.sceneId)
    const previousChapter =
      chapterNode?.children?.[0]?.id === scene.id
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
      let afterId = props.paragraph.id
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
      setGenerateBetweenOpen(false)
      setGenerateBetweenText('')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      {props.identifyLocation ? (
        <div class="px-4 w-full breadcrumbs">
          <ul>
            <For each={findPathToNode(props.sceneId)}>{(node) => <li>{node.name}</li>}</For>
            <li>
              Paragraph {scenesState.scenes[props.sceneId].paragraphs.findIndex((p) => p.id === props.paragraph.id) + 1}
            </li>
          </ul>
        </div>
      ) : null}
      <Row
        id={`paragraph-${props.paragraph.id}`}
        selected={currentScene()?.selectedParagraph === props.paragraph.id}
        onMouseDown={() => {
          updateSceneSelectedParagraph(props.sceneId, props.paragraph.id)
        }}
        borderColor={statusColor[props.paragraph.state] ?? undefined}
        main={
          <>
            {uiState.selectedParagraphId === props.paragraph.id ? (
              <ParagraphActionButtons
                sceneId={props.sceneId}
                paragraphId={props.paragraph.id}
                scene={scenesState.scenes[props.sceneId]}
                text={props.paragraph.text}
                onGenerateBetween={() => setGenerateBetweenOpen(true)}
                aiCharacters={props.paragraph.aiCharacters?.toString()}
                humanCharacters={props.paragraph.humanCharacters?.toString()}
              />
            ) : null}
            <Editor
              paragraphId={props.paragraph.id}
              onChange={(data) => {
                console.log('onChange', data)
                updateSceneParagraphData(props.sceneId, props.paragraph.id, {
                  text: data,
                })
              }}
              defaultValue={props.paragraph.text}
            />
            {props.paragraph.translation ? (
              <div class="px-8 text-indent-1em font-noteworthy">{props.paragraph.translation}</div>
            ) : null}
          </>
        }
        buttons={null}
        extra={
          props.paragraph.extraLoading ? (
            <div class="flex flex-col p-2 gap-2 items-center justify-start h-full">
              <div class="skeleton h-4 w-full" />
              <div class="skeleton h-4 w-full" />
              <div class="skeleton h-4 w-full" />
            </div>
          ) : props.paragraph.extra ? (
            <>
              <div class="absolute top-4 right-2 flex gap-2 bg-opacity-80 border border-gray-200 bg-white p-2 rounded-full">
                <button
                  type="button"
                  class="hover:text-green-500"
                  onClick={() => {
                    const newContent = props.paragraph.extra
                    if (newContent) {
                      updateEditorContent(props.paragraph.id, newContent)
                    }
                    updateSceneParagraphData(props.sceneId, props.paragraph.id, {
                      text: newContent,
                      extra: '',
                    })
                  }}
                >
                  <AiOutlineCheck />
                </button>
                <button
                  type="button"
                  class="hover:text-red-500"
                  onClick={() => {
                    updateSceneParagraphData(props.sceneId, props.paragraph.id, {
                      extra: '',
                    })
                  }}
                >
                  <AiOutlineDelete />
                </button>
              </div>
              <AutoResizeTextarea
                onInput={(e) => {
                  updateSceneParagraphData(props.sceneId, props.paragraph.id, {
                    extra: e.currentTarget.value,
                  })
                }}
                value={props.paragraph.extra}
              />
            </>
          ) : null
        }
      />
      <Row
        borderColor={statusColor[props.paragraph.state] ?? undefined}
        selected={currentScene()?.selectedParagraph === props.paragraph.id}
        main={<ParagraphDetails sceneId={props.sceneId} paragraph={props.paragraph} />}
      />

      {/* Generate Between Modal */}
      {generateBetweenOpen() && (
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="font-bold text-lg">Generate Content</h3>
            <p class="py-4">What should happen in the generated content?</p>
            <textarea
              class="textarea textarea-bordered w-full"
              rows={5}
              value={generateBetweenText()}
              onChange={(e: { currentTarget: HTMLTextAreaElement }) => setGenerateBetweenText(e.currentTarget.value)}
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
                  setGenerateBetweenOpen(false)
                  setGenerateBetweenText('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
