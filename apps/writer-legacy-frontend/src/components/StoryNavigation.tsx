import type { Node } from '@writer/shared'
import {
  AiFillPlusCircle,
  AiOutlineClockCircle,
  AiOutlineCloudUpload,
  AiOutlineMinus,
  AiOutlinePlus,
} from 'solid-icons/ai'
import { For, Show } from 'solid-js'
import { createArc } from '../lib/stores/arcs'
import { createBook } from '../lib/stores/books'
import { chaptersState, createChapter } from '../lib/stores/chapters'
import { createScene, scenesState } from '../lib/stores/scenes'
import { isEffectivelyNonStory, setTreeItemOpen, treeState, updateNode } from '../lib/stores/tree'
import { setSelectedEntity, uiState } from '../lib/stores/ui'

const renderNode = (node: Node & { isDndShadowItem?: boolean }) => {
  const chapter = chaptersState.chapters[node.id]
  const scene = scenesState.scenes[node.id]
  const isNonStory = isEffectivelyNonStory(node.id)

  const getIcon = (baseIcon: string) => {
    if (node.nodeType === 'context') return '📋'
    if (node.nodeType === 'non-story') return '📌'
    return baseIcon
  }

  const dndEvent = (e) => {
    console.log(e)
    updateNode(node.id, {
      children: e.detail.items.filter((i) => e.detail.info.trigger !== 'finalize' || !i.isDndShadowItem),
    })
  }

  return (
    <div class="flex flex-col">
      <div
        class="flex flex-row gap-2 items-center cursor-pointer py-0.5 px-2"
        classList={{
          'bg-gray-100': uiState.selectedEntity === node.type && uiState.currentId === node.id,
          'pl-6': node.type === 'arc',
          'pl-12': node.type === 'chapter',
          'pl-18': node.type === 'scene',
          'opacity-50': node.isDndShadowItem === true,
          'italic text-gray-600': isNonStory,
        }}
        onClick={() => {
          setSelectedEntity(node.type, node.id)
        }}
      >
        {node.type !== 'scene' ? (
          <div
            class="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              setTreeItemOpen(node.id, !node.isOpen)
            }}
          >
            {node.isOpen ? <AiOutlineMinus /> : <AiOutlinePlus />}
          </div>
        ) : null}
        <span class="font-bold">
          {node.type === 'book'
            ? getIcon('📚')
            : node.type === 'arc'
              ? getIcon('🏹')
              : node.type === 'chapter'
                ? getIcon('📖')
                : node.type === 'scene'
                  ? getIcon('📝')
                  : ''}
        </span>
        <span>{node.name}</span>
        {node.type === 'chapter' ? (
          <>
            {chapter?.visibleFrom ? (
              <div class="ml-auto">
                {new Date(chapter.visibleFrom) < new Date() ? <AiOutlineCloudUpload /> : <AiOutlineClockCircle />}
              </div>
            ) : null}
          </>
        ) : null}
        {node.type === 'scene' ? (
          <>
            <span class="ml-auto text-xs">{scene?.words}w</span>
            <span class="flex">
              <div>{scene?.hasAI ? '🤖' : '🧑'}</div>
            </span>
          </>
        ) : null}
        {['book', 'chapter', 'arc'].includes(node.type) ? (
          <button
            class={node.type !== 'chapter' || !chapter?.visibleFrom ? 'ml-auto' : ''}
            type="button"
            onClick={() => {
              if (node.type === 'chapter') {
                createScene(node.id)
              } else if (node.type === 'arc') {
                createChapter(node.id)
              } else if (node.type === 'book') {
                createArc(node.id)
              }
            }}
          >
            <AiFillPlusCircle />
          </button>
        ) : null}
      </div>
      <Show when={node.isOpen && node.children}>
        <div
          class="flex flex-col min-h-2"
          use:dndzone={{
            items: () => node.children,
            type: node.type,
            flipDurationMs: 0,
            centreDraggedOnCursor: true,
          }}
          on:consider={dndEvent}
          on:finalize={dndEvent}
        >
          <For each={node.children}>{renderNode}</For>
        </div>
      </Show>
    </div>
  )
}

export const StoryNavigation = () => {
  // const closestContainerOrItem = (draggable, droppables, context) => {
  //   const closestContainer = closestCenter(
  //     draggable,
  //     droppables.filter((droppable) => isContainer(droppable.id)),
  //     context,
  //   );
  //   if (closestContainer) {
  //     const containerItemIds = containers[closestContainer.id];
  //     const closestItem = closestCenter(
  //       draggable,
  //       droppables.filter((droppable) =>
  //         containerItemIds.includes(droppable.id),
  //       ),
  //       context,
  //     );
  //     if (!closestItem) {
  //       return closestContainer;
  //     }

  //     if (getContainer(draggable.id) !== closestContainer.id) {
  //       const isLastItem =
  //         containerItemIds.indexOf(closestItem.id as number) ===
  //         containerItemIds.length - 1;

  //       if (isLastItem) {
  //         const belowLastItem =
  //           draggable.transformed.center.y > closestItem.transformed.center.y;

  //         if (belowLastItem) {
  //           return closestContainer;
  //         }
  //       }
  //     }
  //     return closestItem;
  //   }
  // };

  // const move = (draggable, droppable, onlyWhenChangingContainer = true) => {
  //   const draggableContainer = getContainer(draggable.id);
  //   const droppableContainer = isContainer(droppable.id)
  //     ? droppable.id
  //     : getContainer(droppable.id);

  //   if (
  //     draggableContainer != droppableContainer ||
  //     !onlyWhenChangingContainer
  //   ) {
  //     const containerItemIds = containers[droppableContainer];
  //     let index = containerItemIds.indexOf(droppable.id);
  //     if (index === -1) index = containerItemIds.length;

  //     batch(() => {
  //       setContainers(draggableContainer, (items) =>
  //         items.filter((item) => item !== draggable.id),
  //       );
  //       setContainers(droppableContainer, (items) => [
  //         ...items.slice(0, index),
  //         draggable.id,
  //         ...items.slice(index),
  //       ]);
  //     });
  //   }
  // };

  // const onDragOver = ({ draggable, droppable }) => {
  // if (draggable && droppable) {
  //   move(draggable, droppable);
  // }
  // };

  // const onDragEnd = ({ draggable, droppable }) => {
  // if (draggable && droppable) {
  //   move(draggable, droppable, false);
  // }
  // };
  const dndEvent = (e) => {
    console.log(e)
    //setTreeState("structure", e.items);
  }

  return (
    <div
      class="w-1/5 min-w-[350px] flex flex-col z-10 overflow-y-auto border-r border-gray-200"
      use:dndzone={{
        items: () => treeState.structure,
        type: 'book',
        flipDurationMs: 0,
      }}
      on:consider={dndEvent}
      on:finalize={dndEvent}
    >
      <For each={treeState.structure}>{renderNode}</For>

      <button
        type="button"
        class="flex items-center gap-2 mt-6 justify-center py-2 border-t border-gray-200 hover:bg-gray-50"
        onClick={createBook}
      >
        <AiFillPlusCircle />
        <span>New Book</span>
      </button>
    </div>
  )
}
