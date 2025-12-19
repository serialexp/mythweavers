import type { Node } from '@writer/shared'
import { Show, createSignal } from 'solid-js'
import { For } from 'solid-js'
import { updateArc } from '../../lib/stores/arcs.js'
import { updateBookValue } from '../../lib/stores/books.js'
import { updateChapter } from '../../lib/stores/chapters.js'
import { addNotification } from '../../lib/stores/notifications.js'
import { scenesState, updateSceneData } from '../../lib/stores/scenes.js'
import { setTreeItemOpen, updateNode } from '../../lib/stores/tree.js'
import { CharacterList } from './CharacterList.jsx'
import { LocationList } from './LocationList.jsx'
import { RefinementPreview } from './RefinementPreview.jsx'
import { SnowflakeInput } from './SnowflakeInput.js'
import { SnowflakeItemActions } from './SnowflakeItemActions'
import { determineRefinementLevel } from './actions/determineRefinementLevel'
import { expandArc } from './actions/expandArc.js'
import { expandBook } from './actions/expandBook.js'
import { expandChapter } from './actions/expandChapter.js'
import { bookRefinements, setBookRefinements } from './store.js'

type SnowflakeItemProps = {
  node: Node
}

export const SnowflakeItem = (props: SnowflakeItemProps) => {
  const [isEditing, setIsEditing] = createSignal(false)
  const [editValue, setEditValue] = createSignal('')
  const [showHistory, setShowHistory] = createSignal(false)

  const handleSaveEdit = () => {
    const newTitle = editValue().trim()
    if (!newTitle) return

    // Update the appropriate store based on node type
    switch (props.node.type) {
      case 'book':
        updateBookValue(props.node.id, 'title', newTitle)
        break
      case 'arc':
        updateArc(props.node.id, { title: newTitle })
        break
      case 'chapter':
        updateChapter(props.node.id, { title: newTitle })
        break
      case 'scene':
        updateSceneData(props.node.id, { title: newTitle })
        break
    }

    setIsEditing(false)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  const handleStartEdit = () => {
    setEditValue(props.node.name)
    setIsEditing(true)
  }

  const getCurrentLevel = () => {
    if (!props.node.oneliner) return undefined
    return determineRefinementLevel(props.node)
  }

  const getExpandStatus = () => {
    const currentLevel = getCurrentLevel()
    if (!currentLevel) return 'needs-summary'

    if (props.node.type === 'book') {
      const hasChildren = props.node.children?.length
      if (hasChildren) return null
      if (currentLevel < 3) return 'needs-expansion'
      return 'ready'
    }

    if (props.node.type === 'chapter' && currentLevel >= 2) return 'ready'
    if (currentLevel < 3) return 'needs-expansion'
    return 'ready'
  }

  const handleExpand = (_node: Node, chapterCount = 12) => {
    switch (props.node.type) {
      case 'book':
        expandBook(props.node)
        break
      case 'arc':
        expandArc(props.node, chapterCount)
        break
      case 'chapter':
        expandChapter(props.node)
        break
    }
  }

  return (
    <div class="p-4 w-full">
      <div class="flex justify-between items-center mb-2">
        <div class="flex items-center gap-2">
          <Show when={props.node.children?.length}>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onClick={() => setTreeItemOpen(props.node.id, !props.node.isOpen)}
            >
              {props.node.isOpen ? '▼' : '▶'}
            </button>
          </Show>
          <Show
            when={isEditing()}
            fallback={
              <div class="text-sm font-bold" onClick={handleStartEdit}>
                {props.node.name}
              </div>
            }
          >
            <input
              type="text"
              class="input input-bordered input-sm"
              value={editValue()}
              onInput={(e) => setEditValue(e.currentTarget.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              autofocus
            />
          </Show>

          <Show when={getCurrentLevel() !== undefined}>
            <div
              class="badge badge-sm border"
              classList={{
                'badge-primary border-primary/20': getCurrentLevel() === 1,
                'badge-secondary border-secondary/20': getCurrentLevel() === 2,
                'badge-accent border-accent/20': getCurrentLevel() === 3,
              }}
              title={`Level ${getCurrentLevel()} Summary`}
            >
              L{getCurrentLevel()}
            </div>
          </Show>
        </div>
        <SnowflakeItemActions node={props.node} getExpandStatus={getExpandStatus} handleExpand={handleExpand} />
      </div>

      <div class="space-y-4">
        <Show when={props.node.isOpen}>
          <div class="flex items-center gap-2">
            <SnowflakeInput node={props.node} />

            {props.node.summaries?.length ? (
              <button
                type="button"
                class="btn btn-ghost btn-xs"
                onClick={() => setShowHistory((prev) => !prev)}
                title="Show summary history"
              >
                {showHistory() ? '↑' : '↓'}
              </button>
            ) : null}
          </div>
        </Show>

        <Show when={showHistory() && props.node.summaries?.length}>
          <div class="pl-4 border-l-2 border-gray-300 space-y-2">
            <For each={[...(props.node.summaries ?? [])].reverse()}>
              {(summary) => (
                <div class="text-sm flex justify-between items-start gap-2">
                  <div class="flex-1">
                    <div class="text-xs text-gray-500">
                      Level {summary.level} • {new Date(summary.timestamp).toLocaleString()}
                    </div>
                    <div>{summary.text}</div>
                  </div>
                  <div class="flex gap-1">
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      title="Revert to this version"
                      onClick={() => {
                        updateNode(props.node.id, { oneliner: summary.text })
                        addNotification({
                          type: 'success',
                          title: 'Summary Reverted',
                          message: 'Reverted to selected version.',
                        })
                      }}
                    >
                      ↺
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs text-error"
                      title="Remove from history"
                      onClick={() => {
                        updateNode(props.node.id, {
                          summaries: props.node.summaries?.filter((s) => s.timestamp !== summary.timestamp),
                        })
                        addNotification({
                          type: 'success',
                          title: 'Summary Removed',
                          message: 'Removed version from history.',
                        })
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <Show when={props.node.type === 'scene'}>
        <div class="text-xs text-gray-500">{scenesState.scenes[props.node.id]?.words ?? 0} words</div>
        <CharacterList node={props.node} />
        <LocationList node={props.node} />
      </Show>

      <Show when={bookRefinements[props.node.id]}>
        <RefinementPreview
          original={props.node.oneliner ?? ''}
          refined={bookRefinements[props.node.id].text}
          onAccept={() => {
            const summaries = [...(props.node.summaries ?? [])]
            const currentExists = summaries.some((s) => s.text === props.node.oneliner)

            if (bookRefinements[props.node.id].level > 1 && !currentExists && props.node.oneliner) {
              summaries.push({
                level: bookRefinements[props.node.id].level - 1,
                text: props.node.oneliner,
                timestamp: Date.now(),
              })
            }

            summaries.push({
              level: bookRefinements[props.node.id].level,
              text: bookRefinements[props.node.id].text,
              timestamp: Date.now(),
            })

            updateNode(props.node.id, {
              summaries,
              oneliner: bookRefinements[props.node.id].text,
            })
            setBookRefinements({ [props.node.id]: undefined })
            addNotification({
              type: 'success',
              title: 'Refinement Accepted',
              message: 'Summary has been updated and previous version saved.',
            })
          }}
          onReject={() => {
            setBookRefinements({ [props.node.id]: undefined })
            addNotification({
              type: 'info',
              title: 'Refinement Rejected',
              message: 'Keeping original summary.',
            })
          }}
        />
      </Show>
    </div>
  )
}
