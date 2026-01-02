import type { Message } from '../types/core'
import { generateMessageId } from './id'

// Claude chat API response types (from browser network tab)
export interface ClaudeChatContentItem {
  type: 'text' | 'thinking'
  text?: string
  thinking?: string
  start_timestamp?: string
  stop_timestamp?: string
}

export interface ClaudeChatMessage {
  uuid: string
  text: string
  content: ClaudeChatContentItem[]
  sender: 'human' | 'assistant'
  created_at: string
  updated_at: string
  attachments: unknown[]
  files: unknown[]
  parent_message_uuid?: string // Required for branch detection
}

export interface ClaudeConversation {
  uuid: string
  name: string
  summary: string
  created_at: string
  updated_at: string
  account?: { uuid: string }
  chat_messages: ClaudeChatMessage[]
  current_leaf_message_uuid?: string // Required for branch detection
}

export type ClaudeChatExport = ClaudeConversation[]

/**
 * Check if a conversation has the branch information needed for correct import
 */
export function conversationHasBranchInfo(conv: ClaudeConversation): boolean {
  if (!conv.current_leaf_message_uuid) {
    return false
  }
  if (conv.chat_messages.length > 0) {
    const firstMsg = conv.chat_messages[0]
    if (!('parent_message_uuid' in firstMsg)) {
      return false
    }
  }
  return true
}

/**
 * Build the chat URL to view the conversation
 */
export function buildChatUrl(conversationUuid: string): string {
  return `https://claude.ai/chat/${conversationUuid}`
}

/**
 * URL to get the user's organization IDs
 */
export const ORGANIZATIONS_API_URL = 'https://claude.ai/api/organizations'

/**
 * Build the API URL to fetch the full conversation with branch info
 */
export function buildConversationApiUrl(orgUuid: string, conversationUuid: string): string {
  return `https://claude.ai/api/organizations/${orgUuid}/chat_conversations/${conversationUuid}?tree=True&rendering_mode=messages&render_all_tools=true&consistency=eventual`
}

/**
 * Build error message with direct link to fetch proper format
 */
function buildExportFormatError(conv?: { uuid?: string; account?: { uuid?: string } }): string {
  const baseMessage = `Invalid Claude chat format: missing branch information.

The official Claude export doesn't include the data needed to detect conversation branches (edits/restarts). This can cause abandoned messages to be imported.`

  if (conv?.uuid && conv?.account?.uuid) {
    const apiUrl = buildConversationApiUrl(conv.account.uuid, conv.uuid)
    return `${baseMessage}

To get the correct format, visit this URL while logged into Claude:
${apiUrl}

Then save the page as JSON (Ctrl+S or Cmd+S) and import that file instead.`
  }

  return `${baseMessage}

To get the correct format:
1. Open your Claude conversation in a browser
2. Open Developer Tools (F12) → Network tab
3. Refresh the page
4. Find the request to the conversation endpoint (look for your conversation UUID)
5. Right-click → Copy → Copy Response
6. Save as a JSON file and import that instead

The API response includes 'parent_message_uuid' and 'current_leaf_message_uuid' fields needed to trace the active conversation branch.`
}

/**
 * Parse a Claude chat export JSON file.
 * Accepts either:
 * - A single conversation object (from API response)
 * - An array of conversations (from official export)
 *
 * Does NOT validate branch info here - that's checked at import time.
 */
export function parseClaudeChatExport(jsonString: string): ClaudeChatExport {
  const data = JSON.parse(jsonString)

  // Handle single conversation (API response format)
  if (!Array.isArray(data) && data.uuid && data.chat_messages) {
    return [data as ClaudeConversation]
  }

  // Handle array of conversations (official export format)
  if (!Array.isArray(data)) {
    throw new Error('Invalid Claude chat export: expected a conversation object or array of conversations')
  }

  // Validate basic structure
  for (const conv of data) {
    if (!conv.uuid || !Array.isArray(conv.chat_messages)) {
      throw new Error('Invalid Claude chat export: conversation missing required fields')
    }
  }

  return data as ClaudeChatExport
}

/**
 * Get the set of message UUIDs that are on the active branch
 * by tracing from current_leaf_message_uuid back through parent_message_uuid
 */
function getActiveBranchUuids(conversation: ClaudeConversation): Set<string> {
  const activeBranch = new Set<string>()
  const messagesByUuid = new Map(conversation.chat_messages.map((m) => [m.uuid, m]))

  // Trace from leaf to root
  let uuid: string | undefined = conversation.current_leaf_message_uuid
  const rootUuid = '00000000-0000-4000-8000-000000000000'

  while (uuid && uuid !== rootUuid) {
    activeBranch.add(uuid)
    const msg = messagesByUuid.get(uuid)
    uuid = msg?.parent_message_uuid
  }

  return activeBranch
}

/**
 * Convert a Claude conversation to MythWeavers messages.
 * Only includes messages on the active branch (excludes abandoned edits/restarts).
 * Throws if conversation lacks branch info.
 */
export function convertToStoryMessages(conversation: ClaudeConversation): Message[] {
  // Validate branch info at import time
  if (!conversationHasBranchInfo(conversation)) {
    throw new Error(buildExportFormatError(conversation))
  }

  const messages: Message[] = []
  const activeBranch = getActiveBranchUuids(conversation)

  // Filter to only active branch messages, maintaining order
  const activeMessages = conversation.chat_messages.filter((m) => activeBranch.has(m.uuid))

  // Sort by created_at to ensure correct order
  activeMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  console.log('[convertToStoryMessages] Conversion details:', {
    totalMessages: conversation.chat_messages.length,
    activeBranchSize: activeBranch.size,
    activeMessagesCount: activeMessages.length,
    humanCount: activeMessages.filter(m => m.sender === 'human').length,
    assistantCount: activeMessages.filter(m => m.sender === 'assistant').length,
  })

  for (let i = 0; i < activeMessages.length; i++) {
    const msg = activeMessages[i]

    if (msg.sender === 'assistant') {
      // Find preceding human message for instruction
      const humanMsg = i > 0 && activeMessages[i - 1].sender === 'human' ? activeMessages[i - 1] : null

      // Extract text and thinking from content array
      const textContent = msg.content.find((c) => c.type === 'text')?.text || msg.text
      const thinkContent = msg.content.find((c) => c.type === 'thinking')?.thinking

      // Extract instruction from human message (check both text field and content array)
      const instruction = humanMsg
        ? humanMsg.content.find((c) => c.type === 'text')?.text || humanMsg.text
        : null

      console.log(`[convertToStoryMessages] Assistant message ${i}:`, {
        hasHumanPredecessor: !!humanMsg,
        instruction: instruction ? instruction.substring(0, 50) + '...' : instruction,
      })

      messages.push({
        id: generateMessageId(),
        role: 'assistant',
        content: textContent,
        instruction,
        think: thinkContent,
        timestamp: new Date(msg.created_at),
        order: messages.length,
      })
    } else if (msg.sender === 'human') {
      // Check if next message is assistant response - if so, skip (will be paired)
      const nextMsg = activeMessages[i + 1]
      if (!nextMsg || nextMsg.sender !== 'assistant') {
        // Orphaned human message - include with empty content
        // Extract text from content array or text field
        const humanText = msg.content.find((c) => c.type === 'text')?.text || msg.text
        messages.push({
          id: generateMessageId(),
          role: 'assistant',
          content: '',
          instruction: humanText,
          timestamp: new Date(msg.created_at),
          order: messages.length,
        })
      }
    }
  }

  return messages
}

/**
 * Get a summary of a conversation for display
 */
export function getConversationSummary(conversation: ClaudeConversation) {
  const hasBranchInfo = conversationHasBranchInfo(conversation)
  const chatUrl = buildChatUrl(conversation.uuid)

  if (!hasBranchInfo) {
    return {
      id: conversation.uuid,
      name: conversation.name || 'Untitled',
      createdAt: new Date(conversation.created_at),
      updatedAt: new Date(conversation.updated_at),
      messageCount: conversation.chat_messages.length,
      activeMessageCount: null as number | null,
      hasAbandonedBranches: null as boolean | null,
      needsApiFetch: true,
      chatUrl,
    }
  }

  const activeBranch = getActiveBranchUuids(conversation)

  return {
    id: conversation.uuid,
    name: conversation.name || 'Untitled',
    createdAt: new Date(conversation.created_at),
    updatedAt: new Date(conversation.updated_at),
    messageCount: conversation.chat_messages.length,
    activeMessageCount: activeBranch.size as number | null,
    hasAbandonedBranches: (activeBranch.size < conversation.chat_messages.length) as boolean | null,
    needsApiFetch: false,
    chatUrl,
  }
}
