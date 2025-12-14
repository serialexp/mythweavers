// ABOUTME: Component for managing which characters and context items are active in a chapter
// ABOUTME: Allows selecting/deselecting entities and copying from previous chapter

import { Component, Show, For, createSignal, createEffect } from 'solid-js'
import { Node } from '../types/core'
import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { nodeStore } from '../stores/nodeStore'
import { BsX, BsCheck, BsFiles } from 'solid-icons/bs'
import { getCharacterDisplayName } from '../utils/character'
import styles from './ChapterContextManager.module.css'

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
    setSelectedCharacterIds(prev => {
      if (prev.includes(characterId)) {
        return prev.filter(id => id !== characterId)
      } else {
        return [...prev, characterId]
      }
    })
  }

  const toggleContextItem = (itemId: string) => {
    setSelectedContextItemIds(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId)
      } else {
        return [...prev, itemId]
      }
    })
  }

  const copyFromPreviousChapter = () => {
    // Find the previous chapter in story order
    const allChapters = nodeStore.nodesArray.filter(n => n.type === 'chapter').sort((a, b) => a.order - b.order)
    const currentIndex = allChapters.findIndex(ch => ch.id === props.chapterNode.id)

    if (currentIndex > 0) {
      const previousChapter = allChapters[currentIndex - 1]
      setSelectedCharacterIds(previousChapter.activeCharacterIds || [])
      setSelectedContextItemIds(previousChapter.activeContextItemIds || [])
    }
  }

  const handleSave = () => {
    // Preserve plot-type items
    const currentIds = props.chapterNode.activeContextItemIds || [];
    const plotIds = currentIds.filter(id => {
      const item = contextItemsStore.contextItems.find(i => i.id === id);
      return item && item.type === 'plot';
    });

    nodeStore.updateNode(props.chapterNode.id, {
      activeCharacterIds: selectedCharacterIds(),
      activeContextItemIds: [...plotIds, ...selectedContextItemIds()]
    })
    props.onClose()
  }

  // Check if there's a previous chapter
  const hasPreviousChapter = () => {
    const allChapters = nodeStore.nodesArray.filter(n => n.type === 'chapter').sort((a, b) => a.order - b.order)
    const currentIndex = allChapters.findIndex(ch => ch.id === props.chapterNode.id)
    return currentIndex > 0
  }

  return (
    <Show when={props.isOpen}>
      <div class={styles.overlay} onClick={props.onClose}>
        <div class={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div class={styles.header}>
            <h3>Active Characters & Context - {props.chapterNode.title}</h3>
            <button class={styles.closeButton} onClick={props.onClose}>
              <BsX />
            </button>
          </div>

          <div class={styles.content}>
            <Show when={hasPreviousChapter()}>
              <button class={styles.copyButton} onClick={copyFromPreviousChapter}>
                <BsFiles /> Copy from Previous Chapter
              </button>
            </Show>

            <div class={styles.section}>
              <h4>Characters</h4>
              <div class={styles.itemList}>
                <For each={charactersStore.characters}>
                  {(character) => (
                    <label class={styles.item}>
                      <input
                        type="checkbox"
                        checked={selectedCharacterIds().includes(character.id)}
                        onChange={() => toggleCharacter(character.id)}
                      />
                      <span class={styles.itemName}>
                        {getCharacterDisplayName(character)}
                        <Show when={character.isMainCharacter}>
                          <span class={styles.badge}>(protagonist)</span>
                        </Show>
                      </span>
                    </label>
                  )}
                </For>
                <Show when={charactersStore.characters.length === 0}>
                  <p class={styles.empty}>No characters defined yet</p>
                </Show>
              </div>
            </div>

            <div class={styles.section}>
              <h4>Context Items</h4>
              <div class={styles.itemList}>
                <For each={contextItemsStore.contextItems.filter(item => !item.isGlobal && item.type !== 'plot')}>
                  {(item) => (
                    <label class={styles.item}>
                      <input
                        type="checkbox"
                        checked={selectedContextItemIds().includes(item.id)}
                        onChange={() => toggleContextItem(item.id)}
                      />
                      <span class={styles.itemName}>
                        {item.name}
                        <span class={styles.badge}>({item.type})</span>
                      </span>
                    </label>
                  )}
                </For>
                <Show when={contextItemsStore.contextItems.filter(item => !item.isGlobal && item.type !== 'plot').length === 0}>
                  <p class={styles.empty}>No non-global context items defined yet</p>
                </Show>
              </div>
              <Show when={contextItemsStore.contextItems.filter(item => item.isGlobal).length > 0}>
                <p class={styles.note}>
                  Note: Global context items are always active and don't need to be selected.
                </p>
              </Show>
            </div>
          </div>

          <div class={styles.footer}>
            <button class={styles.cancelButton} onClick={props.onClose}>
              Cancel
            </button>
            <button class={styles.saveButton} onClick={handleSave}>
              <BsCheck /> Save
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
