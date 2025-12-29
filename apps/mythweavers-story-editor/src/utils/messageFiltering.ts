import { createMemo } from 'solid-js'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { settingsStore } from '../stores/settingsStore'
import { Message } from '../types/core'

/**
 * Consolidated function to get the messages that should be displayed
 * This handles all filtering logic in one place:
 * - Event message visibility based on settings
 * - Chapter/node filtering based on selected node
 * - Any other visibility rules
 */
export function getDisplayMessages(): Message[] {
  console.log('[getDisplayMessages] Recalculating display messages...')

  // First, get base visible messages (handles event message filtering)
  const showEvents = settingsStore.showEventMessages
  const allMessages = messagesStore.messages.filter((msg) => {
    // Optionally hide event messages based on setting
    if (msg.type === 'event' && !showEvents) return false

    return true
  })

  // Then apply chapter/node filtering
  const selectedNode = nodeStore.getSelectedNode()

  console.log('[getDisplayMessages] Selected node:', selectedNode?.id, 'type:', selectedNode?.type)
  console.log('[getDisplayMessages] Total messages:', messagesStore.messages.length)

  if (!selectedNode || (selectedNode.type !== 'chapter' && selectedNode.type !== 'scene')) {
    // If no chapter/scene is selected, return empty array
    // This prevents showing all messages when nothing is selected
    console.log('[getDisplayMessages] No chapter/scene selected, returning empty array')
    return []
  }

  // Filter messages based on selected node type
  const filteredMessages = allMessages.filter((msg) => {
    // For scenes: filter by sceneId
    if (selectedNode.type === 'scene') {
      return msg.sceneId === selectedNode.id
    }

    // For chapters: filter by chapterId or nodeId (legacy)
    // Include messages that belong to this chapter via chapterId
    if (msg.sceneId === selectedNode.id) {
      return true
    }

    // Include messages that belong to this chapter via nodeId
    if (msg.sceneId === selectedNode.id) {
      return true
    }

    return false
  })

  // Sort messages by their order within the node
  const sortedMessages = filteredMessages.sort((a, b) => a.order - b.order)

  console.log(
    '[getDisplayMessages] Filtered messages for node',
    selectedNode.id,
    ':',
    sortedMessages.length,
    'messages',
  )

  console.log(
    '[getDisplayMessages] First few message IDs:',
    sortedMessages.slice(0, 3).map((m) => ({
      id: m.id,
      nodeId: m.sceneId,
      chapterId: m.sceneId,
      order: m.order,
    })),
  )

  return sortedMessages
}

/**
 * Create a reactive memo for the display messages
 */
export const createDisplayMessagesMemo = () => createMemo(() => getDisplayMessages())
