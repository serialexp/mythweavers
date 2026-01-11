import type { BranchOption, Message } from '../types/core'
import { generateMessageId } from './id'

// Tree node for building the full conversation tree
export interface MessageTreeNode {
  message: ClaudeChatMessage
  children: MessageTreeNode[]
  isOnActiveBranch: boolean
}

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
        : undefined

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

/**
 * Build a full tree structure from a Claude conversation.
 * Returns root nodes (messages with no parent or root parent).
 */
export function buildMessageTree(conversation: ClaudeConversation): MessageTreeNode[] {
  const activeBranch = getActiveBranchUuids(conversation)
  const rootUuid = '00000000-0000-4000-8000-000000000000'

  // Build parent -> children map
  const childrenByParent = new Map<string, ClaudeChatMessage[]>()
  for (const msg of conversation.chat_messages) {
    const parentUuid = msg.parent_message_uuid || rootUuid
    if (!childrenByParent.has(parentUuid)) {
      childrenByParent.set(parentUuid, [])
    }
    childrenByParent.get(parentUuid)!.push(msg)
  }

  // Sort children by created_at
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }

  // Recursively build tree
  function buildNode(msg: ClaudeChatMessage): MessageTreeNode {
    const children = childrenByParent.get(msg.uuid) || []
    return {
      message: msg,
      children: children.map(buildNode),
      isOnActiveBranch: activeBranch.has(msg.uuid),
    }
  }

  // Get root nodes (children of the root UUID)
  const rootMessages = childrenByParent.get(rootUuid) || []
  return rootMessages.map(buildNode)
}

/**
 * Generate a label for a branch option based on its first message content.
 * Uses first 30 chars of the first message, or full content if branches have identical prefixes.
 */
function generateBranchLabel(
  branchNode: MessageTreeNode,
  allBranchNodes: MessageTreeNode[],
  branchIndex: number,
): string {
  // Get first message text (likely a human message after a fork)
  const msg = branchNode.message
  const textContent = msg.content.find((c) => c.type === 'text')?.text || msg.text || ''
  const first30 = textContent.slice(0, 30).trim()

  // Check if any other branch has the same first 30 chars
  const hasDuplicate = allBranchNodes.some((other, idx) => {
    if (idx === branchIndex) return false
    const otherText = other.message.content.find((c) => c.type === 'text')?.text || other.message.text || ''
    return otherText.slice(0, 30).trim() === first30
  })

  if (hasDuplicate) {
    // Use full content (truncated at 100 chars for sanity)
    const full = textContent.slice(0, 100).trim()
    return full.length < textContent.length ? `${full}...` : full
  }

  return first30.length < textContent.length ? `${first30}...` : first30
}

/**
 * A "scene segment" represents a linear chain of messages that will become a scene.
 */
export interface SceneSegment {
  id: string
  messages: Message[]
  branchMessage?: {
    id: string
    content: string
    options: BranchOption[]
  }
  parentSegmentId?: string
  branchOptionId?: string // Which option in parent's branch message leads here
}

/**
 * Result of converting a conversation with all branches preserved.
 */
export interface BranchConversionResult {
  segments: SceneSegment[]
  branchChoices: Record<string, string> // branchMessageId -> active optionId
}

/**
 * Convert a Claude conversation to story messages, preserving ALL branches.
 * Creates separate "segments" for each branch path, with branch messages at fork points.
 */
export function convertToStoryMessagesWithBranches(
  conversation: ClaudeConversation,
): BranchConversionResult {
  if (!conversationHasBranchInfo(conversation)) {
    throw new Error('Conversation lacks branch info - cannot convert with branches')
  }

  const tree = buildMessageTree(conversation)
  const segments: SceneSegment[] = []
  const branchChoices: Record<string, string> = {}

  // Helper to convert a Claude message to our Message format
  function convertMessage(
    claudeMsg: ClaudeChatMessage,
    humanMsg: ClaudeChatMessage | null,
    order: number,
  ): Message {
    const textContent = claudeMsg.content.find((c) => c.type === 'text')?.text || claudeMsg.text
    const thinkContent = claudeMsg.content.find((c) => c.type === 'thinking')?.thinking
    const instruction = humanMsg
      ? humanMsg.content.find((c) => c.type === 'text')?.text || humanMsg.text
      : undefined

    return {
      id: generateMessageId(),
      role: 'assistant',
      content: textContent,
      instruction,
      think: thinkContent,
      timestamp: new Date(claudeMsg.created_at),
      order,
    }
  }

  // Process a linear chain of nodes, stopping at fork points.
  // Returns the last node processed (might have children that are forks).
  function processLinearChain(
    nodes: MessageTreeNode[],
    segmentId: string,
    parentSegmentId?: string,
    branchOptionId?: string,
  ): void {
    const messages: Message[] = []
    let currentNodes = nodes
    let lastNodeWithFork: MessageTreeNode | null = null

    // Process nodes linearly until we hit a fork
    while (currentNodes.length > 0) {
      if (currentNodes.length > 1) {
        // Fork point - stop here and create branch message
        lastNodeWithFork = { message: currentNodes[0].message, children: currentNodes, isOnActiveBranch: false }
        break
      }

      const node = currentNodes[0]
      const msg = node.message

      if (msg.sender === 'assistant') {
        // Standalone assistant message without human context
        messages.push(convertMessage(msg, null, messages.length))
      } else if (msg.sender === 'human') {
        // Check if next is assistant - if so, pair them
        if (node.children.length === 1 && node.children[0].message.sender === 'assistant') {
          const assistantNode = node.children[0]
          messages.push(convertMessage(assistantNode.message, msg, messages.length))
          currentNodes = assistantNode.children
          continue
        } else if (node.children.length > 1) {
          // Fork after human message - create orphaned human, then handle fork
          messages.push({
            id: generateMessageId(),
            role: 'assistant',
            content: '',
            instruction: msg.content.find((c) => c.type === 'text')?.text || msg.text,
            timestamp: new Date(msg.created_at),
            order: messages.length,
          })
          lastNodeWithFork = node
          break
        } else {
          // Orphaned human message
          messages.push({
            id: generateMessageId(),
            role: 'assistant',
            content: '',
            instruction: msg.content.find((c) => c.type === 'text')?.text || msg.text,
            timestamp: new Date(msg.created_at),
            order: messages.length,
          })
        }
      }

      currentNodes = node.children
    }

    // Create the segment
    const segment: SceneSegment = {
      id: segmentId,
      messages,
      parentSegmentId,
      branchOptionId,
    }

    // If we stopped at a fork, create branch message and recurse
    if (lastNodeWithFork && lastNodeWithFork.children.length > 1) {
      const branchMessageId = generateMessageId()
      const options: BranchOption[] = []

      // Create options for each branch
      for (let i = 0; i < lastNodeWithFork.children.length; i++) {
        const childNode = lastNodeWithFork.children[i]
        const optionId = generateMessageId()
        const childSegmentId = generateMessageId()

        const label = generateBranchLabel(childNode, lastNodeWithFork.children, i)

        options.push({
          id: optionId,
          label,
          targetNodeId: '', // Will be filled by importer with actual scene ID
          targetMessageId: '', // Will be filled by importer
        })

        // Track active branch choice
        if (childNode.isOnActiveBranch) {
          branchChoices[branchMessageId] = optionId
        }

        // Recursively process this branch
        processLinearChain([childNode], childSegmentId, segmentId, optionId)
      }

      segment.branchMessage = {
        id: branchMessageId,
        content: 'Choose a version:',
        options,
      }
    }

    segments.push(segment)
  }

  // Start processing from root
  if (tree.length > 0) {
    processLinearChain(tree, generateMessageId())
  }

  return { segments, branchChoices }
}
