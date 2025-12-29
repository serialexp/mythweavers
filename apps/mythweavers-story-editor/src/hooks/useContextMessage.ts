import { createMemo } from 'solid-js'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'

/**
 * Hook that returns the appropriate message ID to use as context
 * based on the selected node or the last assistant message
 */
export function useContextMessage() {
  return createMemo(() => {
    const messages = messagesStore.messages
    const selectedNodeId = nodeStore.selectedNodeId

    // Find the message to use as context
    let contextMessageId: string | null = null

    if (selectedNodeId) {
      // Find the last message in the selected node
      const nodeMessages = messages.filter((m) => m.sceneId === selectedNodeId && m.role === 'assistant' && !m.isQuery)
      const lastNodeMessage = nodeMessages[nodeMessages.length - 1]

      if (lastNodeMessage) {
        contextMessageId = lastNodeMessage.id
      }
    }

    // If no node selected or no messages in node, use the last assistant message overall
    if (!contextMessageId) {
      const lastAssistantMessage = messages.filter((m) => m.role === 'assistant' && !m.isQuery).slice(-1)[0]

      if (lastAssistantMessage) {
        contextMessageId = lastAssistantMessage.id
      }
    }

    return contextMessageId
  })
}
