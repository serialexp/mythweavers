import type { Paragraph } from '@mythweavers/shared'
import { SceneEditor } from '@mythweavers/ui'
import type { EditorCharacter, EditorScene } from '@mythweavers/ui'
import { Component, createMemo, createSignal } from 'solid-js'
import { charactersStore } from '../stores/charactersStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { generateMessageId } from '../utils/id'
// getCharacterDisplayName available if needed for character name formatting

interface SceneEditorWrapperProps {
  messageId: string
  onParagraphsUpdate?: (paragraphs: Paragraph[]) => void // Called when paragraphs change (doesn't save, just notifies parent)
}

/**
 * Wrapper component that connects the @mythweavers/ui SceneEditor
 * to the Story app's stores and state management
 *
 * Displays paragraphs for a SINGLE message
 */
export const SceneEditorWrapper: Component<SceneEditorWrapperProps> = (props) => {
  const [_selectedParagraphId, setSelectedParagraphId] = createSignal<string | null>(null)

  // Get the message
  const message = createMemo(() => {
    return messagesStore.messages.find((m) => m.id === props.messageId)
  })

  // Get the scene node (if the message belongs to a scene)
  const scene = createMemo(() => {
    const msg = message()
    if (!msg?.sceneId) return null
    // nodeStore.nodes is a Record<string, Node>, not an array
    const node = nodeStore.nodes[msg.sceneId]
    return node?.type === 'scene' ? node : null
  })

  // Get paragraphs from this specific message (initial state)
  const initialParagraphs = createMemo((): Paragraph[] => {
    const msg = message()
    return (msg?.paragraphs || []) as Paragraph[]
  })

  // Track current paragraph state (can be modified by editor)
  const [currentParagraphs, setCurrentParagraphs] = createSignal<Paragraph[]>(initialParagraphs())

  // Convert characters to editor format (Record<string, EditorCharacter>)
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

  // Convert scene to editor format (using message as the "scene")
  const editorScene = createMemo((): EditorScene => {
    const s = scene()
    return {
      id: props.messageId, // Use message ID as scene ID
      paragraphs: currentParagraphs(), // Use current (editable) state
      protagonistId: s?.viewpointCharacterId || undefined,
      characterIds: s?.activeCharacterIds || [],
      perspective: (s?.perspective?.toLowerCase() as 'first' | 'third') || undefined,
    }
  })

  // Callbacks
  const handleParagraphsChange = (paragraphs: Paragraph[]) => {
    console.log('[SceneEditorWrapper] Paragraphs changed:', paragraphs.length)
    // Update local state (doesn't save yet!)
    setCurrentParagraphs(paragraphs)
    // Notify parent component (Message.tsx) of the change
    props.onParagraphsUpdate?.(paragraphs)
  }

  const handleParagraphCreate = (_paragraph: Omit<Paragraph, 'id'>, afterId?: string): string => {
    const newId = generateMessageId()
    console.log('[SceneEditorWrapper] Creating paragraph:', newId, afterId)
    // TODO: Create message in messagesStore
    return newId
  }

  const handleParagraphDelete = (paragraphId: string) => {
    console.log('[SceneEditorWrapper] Deleting paragraph:', paragraphId)
    // TODO: Delete message from messagesStore
  }

  const handleParagraphUpdate = (paragraphId: string, data: Partial<Paragraph>) => {
    console.log('[SceneEditorWrapper] Updating paragraph:', paragraphId, data)
    // TODO: Update message in messagesStore
  }

  const handleSelectedParagraphChange = (paragraphId: string) => {
    setSelectedParagraphId(paragraphId)
  }

  return (
    <SceneEditor
      scene={editorScene()}
      characters={editorCharacters()}
      locations={{}}
      sceneId={props.messageId}
      onParagraphsChange={handleParagraphsChange}
      onParagraphCreate={handleParagraphCreate}
      onParagraphDelete={handleParagraphDelete}
      onParagraphUpdate={handleParagraphUpdate}
      onSelectedParagraphChange={handleSelectedParagraphChange}
    />
  )
}
