// ABOUTME: Component for managing which characters and context items are active in a chapter
// ABOUTME: Allows selecting/deselecting entities and copying from previous chapter

import { Badge, Button, Modal, Stack } from '@mythweavers/ui'
import { BsCheck, BsFiles } from 'solid-icons/bs'
import { Component, For, Show, createEffect, createSignal } from 'solid-js'
import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { nodeStore } from '../stores/nodeStore'
import { Node } from '../types/core'
import { getCharacterDisplayName } from '../utils/character'
import * as styles from './ChapterContextManager.css'

interface ChapterContextManagerProps {
  isOpen: boolean
  onClose: () => void
  chapterNode: Node
}

export const ChapterContextManager: Component<ChapterContextManagerProps> = (props) => {
  const [selectedCharacterIds, setSelectedCharacterIds] = createSignal<string[]>([])
  const [selectedContextItemIds, setSelectedContextItemIds] = createSignal<string[]>([])

  // Reset state when modal opens or chapter node changes
  createEffect(() => {
    if (props.isOpen) {
      setSelectedCharacterIds(props.chapterNode.activeCharacterIds || [])
      setSelectedContextItemIds(props.chapterNode.activeContextItemIds || [])
    }
  })

  const toggleCharacter = (characterId: string) => {
    setSelectedCharacterIds((prev) => {
      if (prev.includes(characterId)) {
        return prev.filter((id) => id !== characterId)
      }
      return [...prev, characterId]
    })
  }

  const toggleContextItem = (itemId: string) => {
    setSelectedContextItemIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId)
      }
      return [...prev, itemId]
    })
  }

  const copyFromPreviousChapter = () => {
    // Find the previous chapter in story order
    const allChapters = nodeStore.nodesArray.filter((n) => n.type === 'chapter').sort((a, b) => a.order - b.order)
    const currentIndex = allChapters.findIndex((ch) => ch.id === props.chapterNode.id)

    if (currentIndex > 0) {
      const previousChapter = allChapters[currentIndex - 1]
      setSelectedCharacterIds(previousChapter.activeCharacterIds || [])
      setSelectedContextItemIds(previousChapter.activeContextItemIds || [])
    }
  }

  const handleSave = () => {
    // Preserve plot-type items
    const currentIds = props.chapterNode.activeContextItemIds || []
    const plotIds = currentIds.filter((id) => {
      const item = contextItemsStore.contextItems.find((i) => i.id === id)
      return item && item.type === 'plot'
    })

    nodeStore.updateNode(props.chapterNode.id, {
      activeCharacterIds: selectedCharacterIds(),
      activeContextItemIds: [...plotIds, ...selectedContextItemIds()],
    })
    props.onClose()
  }

  // Check if there's a previous chapter
  const hasPreviousChapter = () => {
    const allChapters = nodeStore.nodesArray.filter((n) => n.type === 'chapter').sort((a, b) => a.order - b.order)
    const currentIndex = allChapters.findIndex((ch) => ch.id === props.chapterNode.id)
    return currentIndex > 0
  }

  return (
    <Modal
      open={props.isOpen}
      onClose={props.onClose}
      title={`Active Characters & Context - ${props.chapterNode.title}`}
      size="md"
    >
      <Stack gap="md" style={{ padding: '1rem' }}>
        <Show when={hasPreviousChapter()}>
          <Button variant="secondary" onClick={copyFromPreviousChapter}>
            <BsFiles /> Copy from Previous Chapter
          </Button>
        </Show>

        <div>
          <h4 class={styles.sectionHeader}>Characters</h4>
          <div class={styles.listContainer}>
            <For each={charactersStore.characters}>
              {(character) => (
                <label class={styles.itemLabel}>
                  <input
                    type="checkbox"
                    checked={selectedCharacterIds().includes(character.id)}
                    onChange={() => toggleCharacter(character.id)}
                  />
                  <span class={styles.itemText}>
                    {getCharacterDisplayName(character)}
                    <Show when={character.isMainCharacter}>
                      <Badge variant="primary" size="sm">
                        protagonist
                      </Badge>
                    </Show>
                  </span>
                </label>
              )}
            </For>
            <Show when={charactersStore.characters.length === 0}>
              <p class={styles.emptyMessage}>No characters defined yet</p>
            </Show>
          </div>
        </div>

        <div>
          <h4 class={styles.sectionHeader}>Context Items</h4>
          <div class={styles.listContainer}>
            <For each={contextItemsStore.contextItems.filter((item) => !item.isGlobal && item.type !== 'plot')}>
              {(item) => (
                <label class={styles.itemLabel}>
                  <input
                    type="checkbox"
                    checked={selectedContextItemIds().includes(item.id)}
                    onChange={() => toggleContextItem(item.id)}
                  />
                  <span class={styles.itemText}>
                    {item.name}
                    <Badge variant="secondary" size="sm">
                      {item.type}
                    </Badge>
                  </span>
                </label>
              )}
            </For>
            <Show
              when={
                contextItemsStore.contextItems.filter((item) => !item.isGlobal && item.type !== 'plot').length === 0
              }
            >
              <p class={styles.emptyMessage}>No non-global context items defined yet</p>
            </Show>
          </div>
          <Show when={contextItemsStore.contextItems.filter((item) => item.isGlobal).length > 0}>
            <p class={styles.globalNote}>Note: Global context items are always active and don't need to be selected.</p>
          </Show>
        </div>
      </Stack>

      <div class={styles.footer}>
        <Button variant="secondary" onClick={props.onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          <BsCheck /> Save
        </Button>
      </div>
    </Modal>
  )
}
