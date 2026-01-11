// ABOUTME: Component for managing which characters and context items are active in a scene
// ABOUTME: Allows selecting/deselecting entities and copying from previous scene

import { Badge, Button, Modal, Stack } from '@mythweavers/ui'
import { BsCheck, BsFiles } from 'solid-icons/bs'
import { Component, For, Show, createEffect, createSignal } from 'solid-js'
import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { nodeStore } from '../stores/nodeStore'
import { Node } from '../types/core'
import { getAvatarInitial, getCharacterDisplayName } from '../utils/character'
import { getScenesInStoryOrder } from '../utils/nodeTraversal'
import * as styles from './ChapterContextManager.css'

const getTypeBadgeVariant = (type: string): 'info' | 'success' | 'warning' => {
  return type === 'theme' ? 'info' : type === 'location' ? 'success' : 'warning'
}

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

  const copyFromPreviousScene = () => {
    // Find the previous scene in story order
    const allScenes = getScenesInStoryOrder(nodeStore.nodesArray)
    const currentIndex = allScenes.findIndex((s) => s.id === props.chapterNode.id)

    if (currentIndex > 0) {
      const previousScene = allScenes[currentIndex - 1]
      setSelectedCharacterIds(previousScene.activeCharacterIds || [])
      setSelectedContextItemIds(previousScene.activeContextItemIds || [])
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

  // Check if there's a previous scene
  const hasPreviousScene = () => {
    const allScenes = getScenesInStoryOrder(nodeStore.nodesArray)
    const currentIndex = allScenes.findIndex((s) => s.id === props.chapterNode.id)
    return currentIndex > 0
  }

  const footerContent = (
    <>
      <Button variant="secondary" onClick={props.onClose}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSave}>
        <BsCheck /> Save
      </Button>
    </>
  )

  return (
    <Modal
      open={props.isOpen}
      onClose={props.onClose}
      title={`Active Characters & Context - ${props.chapterNode.title}`}
      size="md"
      footer={footerContent}
    >
      <Stack gap="md" style={{ padding: '1rem' }}>
        <Show when={hasPreviousScene()}>
          <Button variant="secondary" onClick={copyFromPreviousScene}>
            <BsFiles /> Copy from Previous Scene
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
                  <Show
                    when={character.profileImageData}
                    fallback={
                      <div class={styles.avatarPlaceholder}>
                        {getAvatarInitial(getCharacterDisplayName(character))}
                      </div>
                    }
                  >
                    <img
                      src={character.profileImageData!}
                      alt={getCharacterDisplayName(character)}
                      class={styles.avatar}
                    />
                  </Show>
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
                    <Badge variant={getTypeBadgeVariant(item.type)} size="sm">
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
    </Modal>
  )
}
