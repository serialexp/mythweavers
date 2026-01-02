import { saveService } from '../services/saveService'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import type { Message } from '../types/core'
import { generateMessageId } from './id'
import {
  type AggregatedMessageContent,
  type NodeContext,
  type ProposedStructure,
  parseMessageRange,
} from './llm/splitScenePrompt'

export type { AggregatedMessageContent, NodeContext, ProposedStructure }

export interface AggregationResult {
  messages: AggregatedMessageContent[]
  context: NodeContext
}

/**
 * Aggregate all content from a node
 */
export function aggregateNodeContent(nodeId: string): AggregationResult {
  const node = nodeStore.getNode(nodeId)
  if (!node) {
    throw new Error(`Node ${nodeId} not found`)
  }

  // Get all messages for this node, sorted by order
  const nodeMessages = messagesStore.messages
    .filter((msg) => msg.sceneId === nodeId)
    .sort((a, b) => a.order - b.order)

  if (nodeMessages.length === 0) {
    throw new Error(`Node "${node.title}" has no messages to split`)
  }

  // Aggregate content with paragraph splits
  const aggregated: AggregatedMessageContent[] = nodeMessages.map((msg, idx) => {
    // Split content into paragraphs (by double newline)
    const paragraphs = msg.content
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    // If no paragraphs found, treat entire content as one paragraph
    const finalParagraphs = paragraphs.length > 0 ? paragraphs : [msg.content.trim()]

    return {
      messageId: msg.id,
      messageNumber: idx + 1, // 1-indexed for LLM
      content: msg.content,
      order: msg.order,
      wordCount: msg.content.split(/\s+/).filter((w) => w.length > 0).length,
      paragraphs: finalParagraphs,
    }
  })

  return {
    messages: aggregated,
    context: {
      nodeId: node.id,
      title: node.title,
      parentId: node.parentId ?? null,
      type: node.type,
    },
  }
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate proposed structure before applying
 */
export function validateProposedStructure(
  proposed: ProposedStructure,
  originalMessages: AggregatedMessageContent[],
): ValidationResult {
  // Validate structure exists
  if (!proposed.structure || proposed.structure.length === 0) {
    return { valid: false, error: 'No chapters in proposed structure' }
  }

  // Track assigned messages and split messages
  const assignedFull = new Set<number>()
  const splitAfterMessages = new Map<number, number>() // mn -> p
  const splitBeforeMessages = new Map<number, number>() // mn -> p

  for (const chapter of proposed.structure) {
    // Validate chapter has scenes
    if (!chapter.scenes || chapter.scenes.length === 0) {
      return { valid: false, error: `Chapter "${chapter.title}" has no scenes` }
    }

    for (const scene of chapter.scenes) {
      // Validate scene has assignments
      if (!scene.messageAssignments || scene.messageAssignments.length === 0) {
        return { valid: false, error: `Scene "${scene.title}" has no message assignments` }
      }

      for (const assignment of scene.messageAssignments) {
        // Parse range or single message number
        const messageNumbers = parseMessageRange(assignment.mn)

        if (messageNumbers.length === 0) {
          return {
            valid: false,
            error: `Invalid message number format: ${assignment.mn}`,
          }
        }

        // Ranges can only be used with 'full'
        if (messageNumbers.length > 1 && assignment.sb !== 'full') {
          return {
            valid: false,
            error: `Ranges can only be used with sb:"full", not "${assignment.sb}"`,
          }
        }

        for (const msgNum of messageNumbers) {
          // Check message number is valid
          if (msgNum < 1 || msgNum > originalMessages.length) {
            return {
              valid: false,
              error: `Invalid message number ${msgNum} (must be 1-${originalMessages.length})`,
            }
          }

          const msg = originalMessages[msgNum - 1]

          if (assignment.sb === 'full') {
            // Check for duplicate full assignments
            if (assignedFull.has(msgNum)) {
              return {
                valid: false,
                error: `Message ${msgNum} assigned as 'full' multiple times`,
              }
            }
            // Check for conflicts with splits
            if (splitAfterMessages.has(msgNum) || splitBeforeMessages.has(msgNum)) {
              return {
                valid: false,
                error: `Message ${msgNum} cannot be both 'full' and split`,
              }
            }
            assignedFull.add(msgNum)
          } else if (assignment.sb === 'splitAfter') {
            // Check p is provided
            if (assignment.p === undefined || assignment.p === null) {
              return {
                valid: false,
                error: `Message ${msgNum} with splitAfter requires p`,
              }
            }

            // Check p is in range
            if (assignment.p < 0 || assignment.p >= msg.paragraphs.length) {
              return {
                valid: false,
                error: `Message ${msgNum} p ${assignment.p} is out of range (0-${msg.paragraphs.length - 1})`,
              }
            }

            // Check for conflicts with full assignment
            if (assignedFull.has(msgNum)) {
              return {
                valid: false,
                error: `Message ${msgNum} cannot be both 'full' and split`,
              }
            }

            // Record the split
            splitAfterMessages.set(msgNum, assignment.p)
          } else if (assignment.sb === 'splitBefore') {
            // Check p is provided
            if (assignment.p === undefined || assignment.p === null) {
              return {
                valid: false,
                error: `Message ${msgNum} with splitBefore requires p`,
              }
            }

            // Check p is in range
            if (assignment.p < 0 || assignment.p >= msg.paragraphs.length) {
              return {
                valid: false,
                error: `Message ${msgNum} p ${assignment.p} is out of range (0-${msg.paragraphs.length - 1})`,
              }
            }

            // Check for conflicts with full assignment
            if (assignedFull.has(msgNum)) {
              return {
                valid: false,
                error: `Message ${msgNum} cannot be both 'full' and split`,
              }
            }

            // Record the split
            splitBeforeMessages.set(msgNum, assignment.p)
          }
        }
      }
    }
  }

  // Ensure split messages have both parts
  for (const [msgNum, afterParagraph] of splitAfterMessages) {
    if (!splitBeforeMessages.has(msgNum)) {
      return {
        valid: false,
        error: `Message ${msgNum} has splitAfter but no corresponding splitBefore`,
      }
    }
    const beforeParagraph = splitBeforeMessages.get(msgNum)!
    // The splitBefore should be for a paragraph AFTER the splitAfter paragraph
    if (beforeParagraph <= afterParagraph) {
      return {
        valid: false,
        error: `Message ${msgNum}: splitBefore paragraph (${beforeParagraph}) should be after splitAfter paragraph (${afterParagraph})`,
      }
    }
  }

  for (const msgNum of splitBeforeMessages.keys()) {
    if (!splitAfterMessages.has(msgNum)) {
      return {
        valid: false,
        error: `Message ${msgNum} has splitBefore but no corresponding splitAfter`,
      }
    }
  }

  // Check all messages are assigned
  const allAssigned = new Set<number>([...assignedFull, ...splitAfterMessages.keys()])
  for (let i = 1; i <= originalMessages.length; i++) {
    if (!allAssigned.has(i)) {
      return {
        valid: false,
        error: `Message ${i} not assigned to any scene`,
      }
    }
  }

  return { valid: true }
}

/**
 * Apply the proposed structure to create new nodes and reassign messages
 */
export async function applyProposedStructure(
  nodeId: string,
  proposed: ProposedStructure,
): Promise<void> {
  const { messages: aggregatedMessages, context } = aggregateNodeContent(nodeId)

  // Validate before applying
  const validation = validateProposedStructure(proposed, aggregatedMessages)
  if (!validation.valid) {
    throw new Error(`Invalid structure: ${validation.error}`)
  }

  // Get the parent of the scene's parent (chapters go under arc/book, not under chapter)
  // Scene -> Chapter -> Arc/Book
  const sceneParentId = context.parentId // This is the chapter
  const chapterNode = sceneParentId ? nodeStore.getNode(sceneParentId) : null
  const chapterParentId = chapterNode?.parentId ?? null // This is the arc/book

  // Build message lookup by number (1-indexed)
  const messageByNumber = new Map<number, AggregatedMessageContent>()
  for (const msg of aggregatedMessages) {
    messageByNumber.set(msg.messageNumber, msg)
  }

  // Get original messages for metadata
  const originalMessages = messagesStore.messages
    .filter((msg) => msg.sceneId === nodeId)
    .sort((a, b) => a.order - b.order)
  const originalMessageById = new Map<string, Message>()
  for (const msg of originalMessages) {
    originalMessageById.set(msg.id, msg)
  }

  // Track which messages are split (need to be deleted after new ones are created)
  const splitMessageIds = new Set<string>()

  // Collect message moves for batch reorder (more efficient than individual updates)
  const messageMoveBatch: Array<{ messageId: string; sceneId: string; order: number }> = []

  // Process structure - create nodes and assign messages
  for (const chapter of proposed.structure) {
    // Create chapter node using addNode (handles store + saveService)
    // Chapters go under the arc/book (parent of the original chapter)
    const newChapterNode = nodeStore.addNode(chapterParentId, 'chapter', chapter.title)

    for (const scene of chapter.scenes) {
      // Create scene node under the new chapter
      const sceneNode = nodeStore.addNode(newChapterNode.id, 'scene', scene.title)

      let messageOrder = 0

      // Process message assignments
      for (const assignment of scene.messageAssignments) {
        // Expand ranges into individual message numbers
        const messageNumbers = parseMessageRange(assignment.mn)

        for (const msgNum of messageNumbers) {
          const aggregatedMsg = messageByNumber.get(msgNum)
          if (!aggregatedMsg) {
            console.error(`[applyProposedStructure] Message ${msgNum} not found`)
            continue
          }

          const originalMsg = originalMessageById.get(aggregatedMsg.messageId)
          if (!originalMsg) {
            console.error(`[applyProposedStructure] Original message ${aggregatedMsg.messageId} not found`)
            continue
          }

          if (assignment.sb === 'full') {
            // Move entire message to new scene - update store immediately, batch the save
            const newOrder = messageOrder++
            messagesStore.updateMessageNoSave(aggregatedMsg.messageId, {
              sceneId: sceneNode.id,
              order: newOrder,
            })
            messageMoveBatch.push({
              messageId: aggregatedMsg.messageId,
              sceneId: sceneNode.id,
              order: newOrder,
            })
          } else if (assignment.sb === 'splitAfter') {
            // Create new message with content up to paragraph p
            const splitIdx = assignment.p!
            const beforeContent = aggregatedMsg.paragraphs.slice(0, splitIdx + 1).join('\n\n')

            const newMsg: Message = {
              id: generateMessageId(),
              role: 'assistant',
              content: beforeContent,
              timestamp: new Date(),
              order: messageOrder++,
              sceneId: sceneNode.id,
              isQuery: false,
              instruction: originalMsg.instruction,
            }

            messagesStore.appendMessage(newMsg)
            splitMessageIds.add(aggregatedMsg.messageId)
          } else if (assignment.sb === 'splitBefore') {
            // Create new message with content from paragraph p onward
            const splitIdx = assignment.p!
            const afterContent = aggregatedMsg.paragraphs.slice(splitIdx).join('\n\n')

            const newMsg: Message = {
              id: generateMessageId(),
              role: 'assistant',
              content: afterContent,
              timestamp: new Date(),
              order: messageOrder++,
              sceneId: sceneNode.id,
              isQuery: false,
            }

            messagesStore.appendMessage(newMsg)
            splitMessageIds.add(aggregatedMsg.messageId)
          }
        }
      }
    }
  }

  // Batch save all message moves in a single API call
  const storyId = currentStoryStore.id
  if (storyId && messageMoveBatch.length > 0) {
    saveService.reorderMessages(storyId, messageMoveBatch)
  }

  // Delete original split messages
  for (const msgId of splitMessageIds) {
    messagesStore.deleteMessage(msgId)
  }

  // Delete the original node
  nodeStore.deleteNode(nodeId)
}

/**
 * Get statistics about a node's content for display
 */
export function getNodeContentStats(nodeId: string): {
  messageCount: number
  wordCount: number
  paragraphCount: number
} {
  const nodeMessages = messagesStore.messages
    .filter((msg) => msg.sceneId === nodeId)
    .sort((a, b) => a.order - b.order)

  let wordCount = 0
  let paragraphCount = 0

  for (const msg of nodeMessages) {
    wordCount += msg.content.split(/\s+/).filter((w) => w.length > 0).length
    paragraphCount += msg.content.split(/\n\n+/).filter((p) => p.trim().length > 0).length
  }

  return {
    messageCount: nodeMessages.length,
    wordCount,
    paragraphCount,
  }
}
