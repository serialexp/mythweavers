import { paragraphsToText, type Paragraph, type ParagraphInventoryAction } from '@mythweavers/shared'
import { SceneEditor } from '@mythweavers/ui'
import type { EditorCharacter, EditorScene } from '@mythweavers/ui'
import { Component, Show, createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js'
import { saveService } from '../services/saveService'
import { charactersStore } from '../stores/charactersStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { contentToParagraphs } from '../utils/contentToParagraphs'
import { generateMessageId } from '../utils/id'
import { ParagraphScriptModal } from './ParagraphScriptModal'

interface SceneEditorWrapperProps {
  messageId: string
  /** Whether the editor is editable (false during streaming) */
  editable?: boolean
}

/**
 * Wrapper component that connects the @mythweavers/ui SceneEditor
 * to the Story app's stores and state management
 *
 * Displays paragraphs for a SINGLE message.
 * During streaming, shows content as read-only paragraphs.
 * When editable, allows user modifications with auto-save on blur/paragraph switch.
 */
export const SceneEditorWrapper: Component<SceneEditorWrapperProps> = (props) => {
  const [selectedParagraphId, setSelectedParagraphId] = createSignal<string | null>(null)
  const [editingScriptParagraphId, setEditingScriptParagraphId] = createSignal<string | null>(null)

  // Track edited paragraphs (null = no edits yet, use source paragraphs)
  const [editedParagraphs, setEditedParagraphs] = createSignal<Paragraph[] | null>(null)

  // Track if we have unsaved changes
  const [isDirty, setIsDirty] = createSignal(false)

  // Auto-save timer (saves after 3 seconds of inactivity)
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
  const AUTO_SAVE_DELAY = 3000

  const clearAutoSaveTimer = () => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
      autoSaveTimer = null
    }
  }

  const scheduleAutoSave = () => {
    clearAutoSaveTimer()
    autoSaveTimer = setTimeout(() => {
      if (isDirty()) {
        console.log('[SceneEditorWrapper] Auto-saving after inactivity...')
        saveChanges()
      }
    }, AUTO_SAVE_DELAY)
  }

  // Clean up timer on unmount
  onCleanup(() => {
    clearAutoSaveTimer()
    // Save any pending changes when unmounting
    if (isDirty()) {
      saveChanges()
    }
  })

  // Get the message from the store (reactive)
  const message = createMemo(() => {
    return messagesStore.messages.find((m) => m.id === props.messageId)
  })

  // Get the scene node (if the message belongs to a scene)
  const scene = createMemo(() => {
    const msg = message()
    if (!msg?.sceneId) return null
    const node = nodeStore.nodes[msg.sceneId]
    return node?.type === 'scene' ? node : null
  })

  // Source paragraphs from the message - reactive to updates during streaming
  const sourceParagraphs = createMemo((): Paragraph[] => {
    const msg = message()
    if (!msg) return []

    // Use existing paragraphs if available (post-generation)
    if (msg.paragraphs && msg.paragraphs.length > 0) {
      return msg.paragraphs as Paragraph[]
    }

    // Convert content to paragraphs (during streaming or when paragraphs not yet created)
    if (msg.content) {
      return contentToParagraphs(msg.content, props.messageId)
    }

    return []
  })

  // Current paragraphs: edited if user has made changes, otherwise source
  const currentParagraphs = createMemo(() => editedParagraphs() ?? sourceParagraphs())

  // Reset edited paragraphs when source changes (e.g., after streaming completes)
  createEffect(
    on(sourceParagraphs, () => {
      // Only reset if we don't have unsaved changes
      if (!isDirty()) {
        setEditedParagraphs(null)
      }
    }),
  )

  // Convert characters to editor format
  const editorCharacters = createMemo((): Record<string, EditorCharacter> => {
    const chars: Record<string, EditorCharacter> = {}
    charactersStore.characters.forEach((char) => {
      chars[char.id] = {
        id: char.id,
        firstName: char.firstName || 'Unknown',
        lastName: char.lastName || undefined,
        summary: char.description || undefined,
      }
    })
    return chars
  })

  // Build the scene object for the editor
  const editorScene = createMemo((): EditorScene => {
    const s = scene()
    return {
      id: props.messageId,
      paragraphs: currentParagraphs(),
      protagonistId: s?.viewpointCharacterId || undefined,
      characterIds: s?.activeCharacterIds || [],
      perspective: (s?.perspective?.toLowerCase() as 'first' | 'third') || undefined,
    }
  })

  // Save changes to the backend
  const saveChanges = async () => {
    // Clear any pending auto-save since we're saving now
    clearAutoSaveTimer()

    const msg = message()
    const edited = editedParagraphs()
    if (!msg || !edited || !isDirty()) return

    const revisionId = msg.currentMessageRevisionId
    if (!revisionId) {
      console.warn('[SceneEditorWrapper] No revision ID - cannot save paragraphs')
      return
    }

    console.log('[SceneEditorWrapper] Saving changes...')

    try {
      // Save paragraphs to backend with diffing
      const original = msg.paragraphs || []
      const result = await saveService.saveParagraphs(revisionId, original as Paragraph[], edited)
      console.log(
        `[SceneEditorWrapper] Saved: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
      )

      // Update local message store with new paragraphs and flattened content
      // Use NoSave variant since we already saved paragraphs directly above
      const flattenedContent = paragraphsToText(edited)
      messagesStore.updateMessageNoSave(props.messageId, {
        content: flattenedContent,
        paragraphs: edited,
      })

      // Clear dirty state
      setIsDirty(false)
      setEditedParagraphs(null)
    } catch (error) {
      console.error('[SceneEditorWrapper] Failed to save paragraphs:', error)
    }
  }

  // Handle paragraph changes from the editor
  const handleParagraphsChange = (newParagraphs: Paragraph[]) => {
    console.log('[SceneEditorWrapper] Paragraphs changed:', newParagraphs.length)
    setEditedParagraphs(newParagraphs)
    setIsDirty(true)
    // Schedule auto-save after inactivity
    scheduleAutoSave()
  }

  // Handle paragraph selection change - save if switching paragraphs with unsaved changes
  const handleSelectedParagraphChange = (paragraphId: string) => {
    const prevId = selectedParagraphId()
    if (prevId && prevId !== paragraphId && isDirty()) {
      saveChanges()
    }
    setSelectedParagraphId(paragraphId)
  }

  // Handle blur - save any pending changes
  const handleBlur = () => {
    if (isDirty()) {
      saveChanges()
    }
  }

  const handleParagraphCreate = (_paragraph: Omit<Paragraph, 'id'>, afterId?: string): string => {
    const newId = generateMessageId()
    console.log('[SceneEditorWrapper] Creating paragraph:', newId, afterId)
    return newId
  }

  const handleParagraphDelete = (paragraphId: string) => {
    console.log('[SceneEditorWrapper] Deleting paragraph:', paragraphId)
    // Remove the paragraph from editedParagraphs
    const current = editedParagraphs() ?? sourceParagraphs()
    const newParagraphs = current.filter((p) => p.id !== paragraphId)
    setEditedParagraphs(newParagraphs)
    setIsDirty(true)
    // Schedule auto-save after inactivity
    scheduleAutoSave()
  }

  const handleParagraphUpdate = (paragraphId: string, data: Partial<Paragraph>) => {
    console.log('[SceneEditorWrapper] Updating paragraph:', paragraphId, data)
  }

  const handleEditScript = (paragraphId: string) => {
    setEditingScriptParagraphId(paragraphId)
  }

  const editingParagraph = createMemo(() => {
    const id = editingScriptParagraphId()
    if (!id) return null
    return currentParagraphs().find((p) => p.id === id) || null
  })

  const handleSaveScript = async (
    paragraphId: string,
    script: string | null,
    inventoryActions: ParagraphInventoryAction[] | null,
  ) => {
    const storyId = currentStoryStore.id
    if (!storyId) return

    try {
      await saveService.saveParagraphScriptAndInventory(storyId, paragraphId, script, inventoryActions)
      console.log('[SceneEditorWrapper] Saved paragraph script and inventory:', paragraphId)
    } catch (error) {
      console.error('[SceneEditorWrapper] Failed to save paragraph script/inventory:', error)
    }
  }

  return (
    <>
      <SceneEditor
        scene={editorScene()}
        characters={editorCharacters()}
        locations={{}}
        sceneId={props.messageId}
        editable={props.editable ?? true}
        onParagraphsChange={handleParagraphsChange}
        onParagraphCreate={handleParagraphCreate}
        onParagraphDelete={handleParagraphDelete}
        onParagraphUpdate={handleParagraphUpdate}
        onSelectedParagraphChange={handleSelectedParagraphChange}
        onParagraphEditScript={handleEditScript}
        onBlur={handleBlur}
      />

      <Show when={editingParagraph() && message()}>
        <ParagraphScriptModal
          paragraph={editingParagraph()!}
          message={message()!}
          onClose={() => setEditingScriptParagraphId(null)}
          onSave={handleSaveScript}
        />
      </Show>
    </>
  )
}
