import { type Paragraph, type ParagraphInventoryAction, paragraphsToText } from '@mythweavers/shared'
import { SceneEditor } from '@mythweavers/ui'
import type { EditorCharacter, EditorScene, InlineMenuConfig } from '@mythweavers/ui'
import { Component, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import { saveService } from '../services/saveService'
import { charactersStore } from '../stores/charactersStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { languageStore } from '../stores/languageStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { generateMessageId } from '../utils/id'
import { LLMClientFactory } from '../utils/llm'
import { resolveModel } from '../utils/llm/resolveModel'
import { buildRewriteUserPrompt, getRewritePreset } from '../utils/llm/rewritePresets'
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

  // When editor becomes non-editable (regeneration starts), clear local edits
  // so currentParagraphs falls through to sourceParagraphs from the store
  createEffect(() => {
    if (!(props.editable ?? true)) {
      setEditedParagraphs(null)
      setIsDirty(false)
      clearAutoSaveTimer()
    }
  })

  // Get the message from the store (reactive)
  const message = createMemo(() => {
    return messagesStore.messages.find((m) => m.id === props.messageId)
  })

  // When contentVersion bumps, clear local edits so the editor picks up the new store content
  let lastContentVersion = message()?.contentVersion ?? 0
  createEffect(() => {
    const version = message()?.contentVersion ?? 0
    if (version !== lastContentVersion) {
      lastContentVersion = version
      setEditedParagraphs(null)
      setIsDirty(false)
      clearAutoSaveTimer()
    }
  })

  // Get the scene node (if the message belongs to a scene)
  const scene = createMemo(() => {
    const msg = message()
    if (!msg?.sceneId) return null
    const node = nodeStore.nodes[msg.sceneId]
    return node?.type === 'scene' ? node : null
  })

  // Source paragraphs from the message - paragraphs are authoritative, no fallback to content
  const sourceParagraphs = createMemo((): Paragraph[] => {
    const msg = message()
    if (!msg) return []

    // Only use structured paragraphs - never parse from raw content
    if (msg.paragraphs && msg.paragraphs.length > 0) {
      return msg.paragraphs as Paragraph[]
    }

    return []
  })

  // Current paragraphs: edited if user has made changes, otherwise source
  const currentParagraphs = createMemo(() => editedParagraphs() ?? sourceParagraphs())

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

    // Snapshot what we're saving — if new edits arrive during the async save,
    // editedParagraphs() will be a different reference (handleParagraphsChange
    // always sets a new array).
    const savingParagraphs = edited

    console.log('[SceneEditorWrapper] Saving changes...')

    try {
      // Save paragraphs to backend with diffing
      const original = msg.paragraphs || []
      const result = await saveService.saveParagraphs(revisionId, original as Paragraph[], savingParagraphs)
      console.log(
        `[SceneEditorWrapper] Saved: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
      )

      // Update local message store with saved paragraphs and flattened content
      const flattenedContent = paragraphsToText(savingParagraphs)
      messagesStore.updateMessageNoSave(props.messageId, {
        content: flattenedContent,
        paragraphs: savingParagraphs,
      })

      // Only clear dirty state if NO new edits arrived during the save.
      // handleParagraphsChange always creates a new array reference, so
      // reference-equality tells us whether the user kept editing.
      if (editedParagraphs() === savingParagraphs) {
        setIsDirty(false)
        setEditedParagraphs(null)
      } else {
        // New edits arrived during save — keep dirty state, reschedule
        console.log('[SceneEditorWrapper] New edits arrived during save, keeping dirty state')
        scheduleAutoSave()
      }
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
    const current = editedParagraphs() ?? sourceParagraphs()
    const idx = current.findIndex((p) => p.id === paragraphId)
    if (idx === -1) {
      console.warn('[SceneEditorWrapper] Paragraph not found for update:', paragraphId)
      return
    }
    // Build a new array so Solid picks up the change reactively
    const next = current.slice()
    next[idx] = { ...next[idx], ...data }
    setEditedParagraphs(next)
    setIsDirty(true)
    scheduleAutoSave()
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

  // Translation state
  const [isTranslating, setIsTranslating] = createSignal(false)

  const handleTranslate = async (fromLang: string, toLang: string, selectedText: string): Promise<string> => {
    setIsTranslating(true)
    try {
      const resolved = resolveModel('translation')
      const client = LLMClientFactory.getClient(resolved.provider)
      let result = ''

      const generator = client.generate({
        model: resolved.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a translator. Return only the translated text, nothing else. Do not add quotes, explanations, or any other text.',
          },
          { role: 'user', content: `Translate the following text from ${fromLang} to ${toLang}:\n\n${selectedText}` },
        ],
        metadata: { callType: 'translation' },
      })

      for await (const event of generator) {
        if (event.type === 'chunk') {
          result += event.text
        }
      }

      return result.trim()
    } catch (error) {
      console.error('[SceneEditorWrapper] Translation failed:', error)
      return ''
    } finally {
      setIsTranslating(false)
    }
  }

  // Rewrite state
  const [isRewriting, setIsRewriting] = createSignal(false)

  const handleRewrite = async (
    presetId: string,
    selectedText: string,
    containingParagraph: string,
  ): Promise<string> => {
    // The InlineMenu passes preset IDs as opaque strings; we validate here.
    const preset = getRewritePreset(presetId)
    if (!preset) {
      console.warn('[SceneEditorWrapper] Unknown rewrite preset:', presetId)
      return ''
    }

    setIsRewriting(true)
    try {
      const resolved = resolveModel('rewrite:selection')
      const client = LLMClientFactory.getClient(resolved.provider)
      let result = ''

      const generator = client.generate({
        model: resolved.model,
        messages: [
          { role: 'system', content: preset.system },
          { role: 'user', content: buildRewriteUserPrompt(selectedText, containingParagraph) },
        ],
        metadata: { callType: 'rewrite:selection' },
      })

      for await (const event of generator) {
        if (event.type === 'chunk') {
          result += event.text
        }
      }

      // Strip surrounding whitespace and any stray quote wrapping the model
      // sometimes adds despite instructions.
      let cleaned = result.trim()
      if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith('“') && cleaned.endsWith('”'))) {
        cleaned = cleaned.slice(1, -1).trim()
      }
      return cleaned
    } catch (error) {
      console.error('[SceneEditorWrapper] Rewrite failed:', error)
      return ''
    } finally {
      setIsRewriting(false)
    }
  }

  const inlineMenuConfig = createMemo(
    (): InlineMenuConfig => ({
      languages: languageStore.languages.map((l) => ({
        id: l.id,
        name: l.name,
        label: l.label,
      })),
      primaryLanguageId: languageStore.defaultLanguageId,
      onTranslate: handleTranslate,
      isTranslating: isTranslating(),
      onRewrite: handleRewrite,
      isRewriting: isRewriting(),
    }),
  )

  return (
    <>
      <SceneEditor
        scene={editorScene()}
        characters={editorCharacters()}
        locations={{}}
        sceneId={props.messageId}
        editable={props.editable ?? true}
        contentVersion={message()?.contentVersion}
        onParagraphsChange={handleParagraphsChange}
        onParagraphCreate={handleParagraphCreate}
        onParagraphDelete={handleParagraphDelete}
        onParagraphUpdate={handleParagraphUpdate}
        onSelectedParagraphChange={handleSelectedParagraphChange}
        onParagraphEditScript={handleEditScript}
        onBlur={handleBlur}
        inlineMenuConfig={inlineMenuConfig()}
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
