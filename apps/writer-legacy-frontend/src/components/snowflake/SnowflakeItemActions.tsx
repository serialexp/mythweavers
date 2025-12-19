import type { Node } from '@writer/shared'
import shortUUID from 'short-uuid'
import { AiOutlineClose } from 'solid-icons/ai'
import { BiSolidAddToQueue } from 'solid-icons/bi'
import { FaSolidChevronDown, FaSolidHeading, FaSolidTimeline, FaSolidUserGroup, FaSolidUserPlus } from 'solid-icons/fa'
import { RiDesignMagicFill, RiDesignQuillPenFill } from 'solid-icons/ri'
import { TbRefresh } from 'solid-icons/tb'
import { TbBulb } from 'solid-icons/tb'
import { TbMapPin } from 'solid-icons/tb'
import { TbActivity } from 'solid-icons/tb'
import { For, Show } from 'solid-js'
import { createSignal } from 'solid-js'
import { createArc } from '../../lib/stores/arcs'
import { arcsStore } from '../../lib/stores/arcs'
import { createChapter } from '../../lib/stores/chapters'
import { createSceneParagraph, scenesState, updateSceneData } from '../../lib/stores/scenes'
import { createScene } from '../../lib/stores/scenes'
import { findPathToNode, removeNode, treeState } from '../../lib/stores/tree'
import { ButtonTooltip } from './ButtonTooltip'
import { HighlightsPreview } from './HighlightsPreview'
import { RefinementPreview } from './RefinementPreview'
import { SceneVersions } from './SceneVersions'
import { extractArcHighlights } from './actions/extractArcHighlights'
import { extractCharacterActions } from './actions/extractCharacterActions'
import { extractCharactersFromScene } from './actions/extractCharactersFromScene'
import { extractLocationFromScene } from './actions/extractLocationFromScene'
import { foreshadowBook } from './actions/foreshadowBook'
import { generateFullSummary } from './actions/generateFullSummary'
import { generateProtagonist } from './actions/generateProtagonist'
import { generateSceneContent } from './actions/generateSceneContent'
import { generateSceneSummary } from './actions/generateSceneSummary'
import { generateTitle } from './actions/generateTitle'
import { refineBookSummary } from './actions/refineBookSummary'
import { LEVEL_DESCRIPTIONS, type RefinementLevel } from './constants'
import { loadingStates } from './store'
import { refinementPreview, setHighlightsPreview } from './store'
import { highlightsPreview } from './store'

type Props = {
  node: Node
  getExpandStatus: () => 'needs-summary' | 'needs-expansion' | 'ready' | null
  handleExpand: (node: Node, chapterCount?: number) => void
}

export const SnowflakeItemActions = (props: Props) => {
  const [showVersions, setShowVersions] = createSignal(false)
  const [openDropdowns, setOpenDropdowns] = createSignal<Record<'expand' | 'refine', boolean>>({
    refine: false,
    expand: false,
  })

  const handleSelectVersion = (content: string) => {
    const paragraphs = content.split('\n\n').filter((p) => p.trim())

    // Clear existing paragraphs
    updateSceneData(props.node.id, {
      paragraphs: [],
      words: 0,
    })

    // Create new paragraphs from selected content
    for (const paragraph of paragraphs) {
      const paragraphId = shortUUID.generate()
      createSceneParagraph(props.node.id, {
        id: paragraphId,
        text: paragraph,
        state: 'ai',
        comments: [],
        plot_point_actions: [],
        modifiedAt: Date.now(),
      })
    }

    setShowVersions(false)
  }

  const handleInsertBefore = () => {
    switch (props.node.type) {
      case 'arc': {
        const [book, arc] = findPathToNode(props.node.id)
        createArc(book.id, arc.id)
        break
      }
      case 'chapter': {
        const [_book, arc, chapter] = findPathToNode(props.node.id)
        createChapter(arc.id, chapter.id)
        break
      }
      case 'scene': {
        const [_book, _arc, chapter, scene] = findPathToNode(props.node.id)
        createScene(chapter.id, scene.id)
        break
      }
      default:
        break
    }
  }

  return (
    <>
      <div class="flex items-center gap-2">
        <Show when={props.node.type !== 'book'}>
          <ButtonTooltip title={`Insert ${props.node.type} before this one`} onClick={handleInsertBefore}>
            <BiSolidAddToQueue />
          </ButtonTooltip>
        </Show>

        <div
          class="dropdown dropdown-end"
          classList={{
            'dropdown-open': openDropdowns().refine,
          }}
        >
          <ButtonTooltip
            title={props.node.oneliner ? 'Expand or refine this summary' : 'Add a summary first'}
            error={!props.node.oneliner}
            disabled={!props.node.oneliner}
            onClick={() => {
              setOpenDropdowns((c) => ({
                ...c,
                refine: !openDropdowns().refine,
              }))
            }}
          >
            {loadingStates[`${props.node.id}_refine`] ? (
              <span class="loading loading-spinner loading-xs" />
            ) : (
              <RiDesignMagicFill />
            )}
          </ButtonTooltip>
          <ul class="dropdown-content z-[5] menu p-2 shadow bg-base-100 rounded-box w-72">
            <For each={[1, 2, 3]}>
              {(level) => (
                <li class="relative group">
                  <button
                    type="button"
                    onClick={() => {
                      refineBookSummary(props.node, level as RefinementLevel)
                      setOpenDropdowns((c) => ({ ...c, refine: false }))
                    }}
                    disabled={loadingStates[`${props.node.id}_refine`]}
                    class="flex flex-col items-start"
                  >
                    <span class="font-bold">
                      {level === 1 ? 'Refine One-Liner' : level === 2 ? 'Expand to Paragraph' : 'Expand to Full Page'}
                    </span>
                    <span class="text-xs text-gray-500 whitespace-normal">
                      {LEVEL_DESCRIPTIONS[level as keyof typeof LEVEL_DESCRIPTIONS]}
                    </span>
                  </button>
                </li>
              )}
            </For>
          </ul>
        </div>

        <Show when={props.node.type === 'book'}>
          <ButtonTooltip
            title={props.node.oneliner ? 'Generate a protagonist for this book' : 'Add a summary first'}
            error={!props.node.oneliner}
            disabled={!props.node.oneliner}
            onClick={() => generateProtagonist(props.node)}
          >
            {loadingStates[`${props.node.id}_char`] ? (
              <span class="loading loading-spinner loading-xs" />
            ) : (
              <FaSolidUserPlus />
            )}
          </ButtonTooltip>
        </Show>

        <Show when={props.node.type !== 'scene' && props.node.type !== 'arc'}>
          <ButtonTooltip
            title={
              props.getExpandStatus() === 'needs-summary'
                ? 'Add a one-line summary first'
                : props.getExpandStatus() === 'needs-expansion'
                  ? 'Expand to full page (Level 3) before generating'
                  : `Generate ${props.node.type === 'book' ? 'arcs' : props.node.type === 'arc' ? 'chapters' : 'scenes'}`
            }
            error={props.getExpandStatus() !== 'ready'}
            disabled={props.getExpandStatus() !== 'ready'}
            onClick={() => props.handleExpand(props.node)}
          >
            {loadingStates[props.node.id] ? (
              <span class="loading loading-spinner loading-xs" />
            ) : (
              <FaSolidChevronDown />
            )}
          </ButtonTooltip>
        </Show>
        <Show when={props.node.type === 'arc'}>
          <div
            class="dropdown dropdown-end"
            classList={{
              'dropdown-open': openDropdowns().expand,
            }}
          >
            <ButtonTooltip
              title={
                props.getExpandStatus() === 'needs-summary'
                  ? 'Add a one-line summary first'
                  : props.getExpandStatus() === 'needs-expansion'
                    ? 'Expand to full page (Level 3) before generating'
                    : `Generate ${props.node.type === 'book' ? 'arcs' : props.node.type === 'arc' ? 'chapters' : 'scenes'}`
              }
              error={props.getExpandStatus() !== 'ready'}
              disabled={props.getExpandStatus() !== 'ready'}
              onClick={() =>
                setOpenDropdowns((c) => ({
                  ...c,
                  expand: !openDropdowns().expand,
                }))
              }
            >
              {loadingStates[props.node.id] ? (
                <span class="loading loading-spinner loading-xs" />
              ) : (
                <FaSolidChevronDown />
              )}
            </ButtonTooltip>
            <ul class="dropdown-content z-[5] menu p-2 shadow bg-base-100 rounded-box w-72">
              <For each={[8, 12, 16, 20]}>
                {(level) => (
                  <li class="relative group">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDropdowns((c) => ({ ...c, expand: false }))

                        props.handleExpand(props.node, level)
                      }}
                      disabled={loadingStates[props.node.id]}
                      class="flex flex-col items-start"
                    >
                      <span class="font-bold">Generate {level} chapters</span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </Show>

        <ButtonTooltip
          title={
            props.node.children?.length ? 'Generate a summary based on child elements' : 'Add some child elements first'
          }
          error={!props.node.children?.length}
          disabled={!props.node.children?.length}
          onClick={() => generateFullSummary(props.node)}
        >
          {loadingStates[`${props.node.id}_summary`] ? (
            <span class="loading loading-spinner loading-xs" />
          ) : (
            <TbRefresh />
          )}
        </ButtonTooltip>

        <Show when={props.node.type === 'book'}>
          <ButtonTooltip
            title={
              !props.node.summaries?.some((s) => s.level === 3)
                ? 'Expand to full page (Level 3) first'
                : props.node.id === treeState.structure[treeState.structure.length - 1].id
                  ? 'This is the last book in the series'
                  : 'Add foreshadowing for future books'
            }
            error={
              !props.node.summaries?.some((s) => s.level === 3) ||
              props.node.id === treeState.structure[treeState.structure.length - 1].id
            }
            disabled={
              !props.node.summaries?.some((s) => s.level === 3) ||
              props.node.id === treeState.structure[treeState.structure.length - 1].id
            }
            onClick={() => foreshadowBook(props.node)}
          >
            {loadingStates[`${props.node.id}_foreshadow`] ? (
              <span class="loading loading-spinner loading-xs" />
            ) : (
              <FaSolidTimeline />
            )}
          </ButtonTooltip>
        </Show>

        <Show when={props.node.type === 'scene'}>
          <ButtonTooltip
            title="Extract characters from scene content"
            onClick={() => extractCharactersFromScene(props.node)}
          >
            {loadingStates[`${props.node.id}_chars`] ? (
              <span class="loading loading-spinner loading-xs" />
            ) : (
              <FaSolidUserGroup />
            )}
          </ButtonTooltip>

          <ButtonTooltip
            title="Extract character actions from scene"
            onClick={() => extractCharacterActions(props.node)}
          >
            {loadingStates[`${props.node.id}_actions`] ? (
              <span class="loading loading-spinner loading-xs" />
            ) : (
              <TbActivity />
            )}
          </ButtonTooltip>

          <ButtonTooltip
            title="Extract location from scene content"
            onClick={async () => {
              const locationId = await extractLocationFromScene(props.node)
              if (locationId) {
                updateSceneData(props.node.id, { locationId })
              }
            }}
          >
            {loadingStates[`${props.node.id}_location`] ? (
              <span class="loading loading-spinner loading-xs" />
            ) : (
              <TbMapPin />
            )}
          </ButtonTooltip>

          <ButtonTooltip title="Re-summarize scene from content" onClick={() => generateSceneSummary(props.node)}>
            {loadingStates[`${props.node.id}_summary`] ? (
              <span class="loading loading-spinner loading-xs" />
            ) : (
              <TbRefresh />
            )}
          </ButtonTooltip>

          <ButtonTooltip
            title={
              !props.node.oneliner
                ? 'Add a summary first'
                : scenesState.scenes[props.node.id]?.generationApproaches?.length
                  ? 'Compare generated versions'
                  : 'Generate scene content'
            }
            error={!props.node.oneliner}
            disabled={!props.node.oneliner}
            onClick={() => {
              const scene = scenesState.scenes[props.node.id]
              if (scene?.generationApproaches?.length) {
                setShowVersions(true)
              } else {
                generateSceneContent(props.node)
              }
            }}
          >
            {loadingStates[`${props.node.id}_content`] ? (
              <span class="loading loading-spinner loading-xs" />
            ) : (
              <RiDesignQuillPenFill />
            )}
          </ButtonTooltip>
        </Show>

        <ButtonTooltip title="Generate a title based on the content" onClick={() => generateTitle(props.node)}>
          {loadingStates[`${props.node.id}_title`] ? (
            <span class="loading loading-spinner loading-xs" />
          ) : (
            <FaSolidHeading />
          )}
        </ButtonTooltip>

        <ButtonTooltip title={`Remove this ${props.node.type}`} onClick={() => removeNode(props.node.id)}>
          <AiOutlineClose />
        </ButtonTooltip>

        <Show when={props.node.type === 'arc'}>
          <ButtonTooltip
            title={
              arcsStore.arcs[props.node.id]?.highlights?.length
                ? 'View arc highlights'
                : 'Extract key highlights from this arc'
            }
            onClick={() => {
              if (arcsStore.arcs[props.node.id]?.highlights?.length) {
                setHighlightsPreview(props.node.id)
              } else {
                // Extract new highlights
                extractArcHighlights(props.node)
              }
            }}
          >
            {loadingStates[`${props.node.id}_highlights`] ? (
              <span class="loading loading-spinner loading-xs" />
            ) : (
              <TbBulb />
            )}
          </ButtonTooltip>
        </Show>
      </div>

      <Show when={showVersions()}>
        <SceneVersions
          node={props.node}
          versions={scenesState.scenes[props.node.id]?.generationApproaches}
          onSelect={handleSelectVersion}
          onClose={() => setShowVersions(false)}
        />
      </Show>

      <Show when={refinementPreview()}>
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="font-bold text-lg mb-4">
              Review Generated Summary (Level {refinementPreview()!.level})
              <div class="text-sm font-normal opacity-75">
                {refinementPreview()!.level === 1
                  ? 'One-line summary'
                  : refinementPreview()!.level === 2
                    ? 'One-paragraph summary'
                    : 'Full-page summary'}
              </div>
            </h3>
            <RefinementPreview
              original={refinementPreview()!.original}
              refined={refinementPreview()!.refined}
              onAccept={refinementPreview()!.onAccept}
              onReject={refinementPreview()!.onReject}
            />
          </div>
        </div>
      </Show>

      <Show when={highlightsPreview()}>
        <HighlightsPreview
          arc={arcsStore.arcs[highlightsPreview()!]}
          node={props.node}
          onClose={() => setHighlightsPreview(null)}
        />
      </Show>
    </>
  )
}
