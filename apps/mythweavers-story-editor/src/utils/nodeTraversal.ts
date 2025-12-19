import { BranchOption, Message, Node } from '../types/core'
import { generateMessageId } from './id'

/**
 * Get all chapter nodes in story order.
 * Traverses the node hierarchy depth-first using each node's order value.
 */
export function getChaptersInStoryOrder(nodes: Node[]): Node[] {
  const result: Node[] = []

  if (nodes.length === 0) {
    return result
  }

  const childrenMap = new Map<string | null, Node[]>()
  nodes.forEach((node) => {
    const parentId = node.parentId || null
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(node)
  })

  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.order - b.order)
  }

  const traverse = (parentId: string | null) => {
    const children = childrenMap.get(parentId) || []
    for (const child of children) {
      if (child.type === 'chapter') {
        result.push(child)
      }
      traverse(child.id)
    }
  }

  traverse(null)

  return result
}

/**
 * Get all chapter nodes that come before the specified node in story order.
 * This includes all sibling chapters with lower order values and all chapters
 * in parent nodes (arcs/books) that come before the current node's parent.
 */
export function getChapterNodesBeforeNode(nodes: Node[], currentNodeId: string): Node[] {
  const result: Node[] = []
  const currentNode = nodes.find((n) => n.id === currentNodeId)
  if (!currentNode) return result

  // Build a map of parent to children for easy traversal
  const childrenMap = new Map<string | null, Node[]>()
  nodes.forEach((node) => {
    const parentId = node.parentId || null
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(node)
  })

  // Sort children by order
  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.order - b.order)
  }

  // Traverse the tree and collect all chapter nodes before the current one
  const traverse = (parentId: string | null, stopAtNode?: string): boolean => {
    const children = childrenMap.get(parentId) || []

    for (const child of children) {
      if (child.id === stopAtNode) {
        // Found the stop node, return true to indicate we should stop
        return true
      }

      if (child.id === currentNodeId) {
        // Found current node, stop traversing at this level
        return true
      }

      // If it's a chapter node, add it to results
      if (child.type === 'chapter') {
        result.push(child)
      }

      // Traverse children, and if we hit the stop node, stop
      if (traverse(child.id, currentNodeId)) {
        // If current node was found in children, stop processing siblings
        return true
      }
    }

    return false
  }

  // Start traversal from root
  traverse(null)

  return result
}

/**
 * Get all nodes (of any type) that come before and including the specified node in story order.
 * This is useful for processing scripts which may be attached to any node type.
 */
export function getAllNodesUpToNode(nodes: Node[], currentNodeId: string): Node[] {
  const result: Node[] = []
  const currentNode = nodes.find((n) => n.id === currentNodeId)
  if (!currentNode) return result

  // Build a map of parent to children for easy traversal
  const childrenMap = new Map<string | null, Node[]>()
  nodes.forEach((node) => {
    const parentId = node.parentId || null
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(node)
  })

  // Sort children by order
  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.order - b.order)
  }

  // Traverse the tree and collect all nodes up to and including the current one
  const traverse = (parentId: string | null): boolean => {
    const children = childrenMap.get(parentId) || []

    for (const child of children) {
      // Add the node to results
      result.push(child)

      if (child.id === currentNodeId) {
        // Found current node, stop traversing after adding it
        return true
      }

      // Traverse children, and if we hit the current node, stop
      if (traverse(child.id)) {
        // If current node was found in children, stop processing siblings
        return true
      }
    }

    return false
  }

  // Start traversal from root
  traverse(null)

  return result
}

/**
 * Get messages in story order up to and including the specified message.
 * This uses the node hierarchy to determine the correct order.
 *
 * @param messages - All messages in the story
 * @param nodes - All nodes in the story hierarchy
 * @param targetMessageId - The ID of the last message to include (process up to this point)
 * @returns Messages in story order from the beginning up to and including the target message
 */
export function getMessagesInStoryOrder(messages: Message[], nodes: Node[], targetMessageId: string): Message[] {
  const targetMessage = messages.find((m) => m.id === targetMessageId)
  if (!targetMessage) {
    throw new Error(
      `[getMessagesInStoryOrder] Target message not found: ${targetMessageId}. This should never happen - the target message must exist in the messages array.`,
    )
  }

  // If the target message doesn't have a nodeId, fall back to array order
  if (!targetMessage.nodeId) {
    console.warn('[getMessagesInStoryOrder] Target message has no nodeId, falling back to array order', {
      targetMessageId: targetMessageId,
      targetMessage: {
        id: targetMessage.id,
        type: targetMessage.type,
        role: targetMessage.role,
        nodeId: targetMessage.nodeId,
        chapterId: targetMessage.chapterId,
        content: `${targetMessage.content?.substring(0, 50)}...`,
        order: targetMessage.order,
        isQuery: targetMessage.isQuery,
        script: !!targetMessage.script,
      },
      allKeys: Object.keys(targetMessage),
    })
    const targetIndex = messages.findIndex((m) => m.id === targetMessageId)
    return targetIndex >= 0 ? messages.slice(0, targetIndex + 1) : []
  }

  // Get all nodes up to and including the target message's node
  const nodesInOrder = getAllNodesUpToNode(nodes, targetMessage.nodeId)
  const nodeIds = new Set(nodesInOrder.map((n) => n.id))

  // Filter messages to only those in the nodes we've traversed
  const messagesInNodes = messages.filter((m) => m.nodeId && nodeIds.has(m.nodeId))

  // Group messages by node
  const messagesByNode = new Map<string, Message[]>()
  messagesInNodes.forEach((msg) => {
    if (!msg.nodeId) return
    if (!messagesByNode.has(msg.nodeId)) {
      messagesByNode.set(msg.nodeId, [])
    }
    messagesByNode.get(msg.nodeId)!.push(msg)
  })

  // Sort messages within each node by order
  for (const nodeMessages of messagesByNode.values()) {
    nodeMessages.sort((a, b) => a.order - b.order)
  }

  // Build the final message list in story order
  const result: Message[] = []
  for (const node of nodesInOrder) {
    const nodeMessages = messagesByNode.get(node.id) || []

    if (node.id === targetMessage.nodeId) {
      // For the target node, only include messages up to and including the target
      for (const msg of nodeMessages) {
        result.push(msg)
        if (msg.id === targetMessageId) {
          break
        }
      }
      break
    }
    // For other nodes, include all messages
    result.push(...nodeMessages)
  }

  return result
}

/**
 * Calculate which messages and nodes are on the active path based on branch choices.
 * The active path starts from the beginning and follows branch choices until:
 * 1. A branch message with no choice selected (path stops here)
 * 2. The end of the story
 *
 * @param messages - All messages in the story
 * @param nodes - All nodes in the story
 * @param branchChoices - Record of branchMessageId -> selectedOptionId
 * @returns Sets of active message IDs and node IDs
 */
export function calculateActivePath(
  messages: Message[],
  nodes: Node[],
  branchChoices: Record<string, string>,
): { activeMessageIds: Set<string>; activeNodeIds: Set<string> } {
  const activeMessageIds = new Set<string>()
  const activeNodeIds = new Set<string>()

  if (messages.length === 0 || nodes.length === 0) {
    return { activeMessageIds, activeNodeIds }
  }

  // Get all nodes in story order
  const nodesInOrder = getAllNodesInStoryOrder(nodes)

  // Build a map of messages by node for quick lookup
  const messagesByNode = new Map<string, Message[]>()
  messages.forEach((msg) => {
    if (!msg.nodeId) return
    if (!messagesByNode.has(msg.nodeId)) {
      messagesByNode.set(msg.nodeId, [])
    }
    messagesByNode.get(msg.nodeId)!.push(msg)
  })

  // Sort messages within each node by order
  for (const nodeMessages of messagesByNode.values()) {
    nodeMessages.sort((a, b) => a.order - b.order)
  }

  // Track current position in the story
  let currentNodeIndex = 0
  let currentMessageIndex = 0

  // Track visited branches to detect loops
  const visitedBranches = new Set<string>()

  console.log('[calculateActivePath] Starting path calculation', {
    totalNodes: nodesInOrder.length,
    totalMessages: messages.length,
    branchChoices,
  })

  // Walk through the story in order
  while (currentNodeIndex < nodesInOrder.length) {
    const currentNode = nodesInOrder[currentNodeIndex]
    const nodeMessages = messagesByNode.get(currentNode.id) || []

    // Only chapter nodes have messages
    if (currentNode.type !== 'chapter' || nodeMessages.length === 0) {
      currentNodeIndex++
      continue
    }

    // Mark node as active
    activeNodeIds.add(currentNode.id)

    // Process messages in this node starting from currentMessageIndex
    while (currentMessageIndex < nodeMessages.length) {
      const message = nodeMessages[currentMessageIndex]

      // Mark message as active
      activeMessageIds.add(message.id)

      // Check if this is a branch message
      if (message.type === 'branch' && message.options && message.options.length > 0) {
        // Check for loop - if we've already visited this branch, stop
        if (visitedBranches.has(message.id)) {
          console.warn('[calculateActivePath] Loop detected at branch:', message.id)
          return { activeMessageIds, activeNodeIds }
        }
        visitedBranches.add(message.id)

        const selectedOptionId = branchChoices[message.id]

        if (!selectedOptionId) {
          // No choice selected - path stops here
          console.log('[calculateActivePath] Path stops at unselected branch:', message.id)
          return { activeMessageIds, activeNodeIds }
        }

        // Find the selected option
        const selectedOption = message.options.find((opt) => opt.id === selectedOptionId)

        if (!selectedOption) {
          console.warn('[calculateActivePath] Selected option not found:', selectedOptionId, 'in branch:', message.id)
          // Treat as if no choice selected - stop here
          return { activeMessageIds, activeNodeIds }
        }

        // Jump to the target of the branch
        const targetNodeIndex = nodesInOrder.findIndex((n) => n.id === selectedOption.targetNodeId)
        const targetNodeMessages = messagesByNode.get(selectedOption.targetNodeId) || []
        const targetMessageIndex = targetNodeMessages.findIndex((m) => m.id === selectedOption.targetMessageId)

        if (targetNodeIndex === -1) {
          console.warn('[calculateActivePath] Branch target node not found:', selectedOption.targetNodeId)
          return { activeMessageIds, activeNodeIds }
        }

        if (targetMessageIndex === -1) {
          console.warn('[calculateActivePath] Branch target message not found:', selectedOption.targetMessageId)
          return { activeMessageIds, activeNodeIds }
        }

        // Jump to target
        currentNodeIndex = targetNodeIndex
        currentMessageIndex = targetMessageIndex

        // Break out of message loop to process new node
        break
      }

      // Move to next message
      currentMessageIndex++
    }

    // If we've processed all messages in this node, move to next node
    if (currentMessageIndex >= nodeMessages.length) {
      currentNodeIndex++
      currentMessageIndex = 0
    }
  }

  console.log('[calculateActivePath] Finished path calculation', {
    activeMessages: activeMessageIds.size,
    activeNodes: activeNodeIds.size,
  })

  return { activeMessageIds, activeNodeIds }
}

/**
 * Get all nodes in story order starting from the root.
 */
export function getAllNodesInStoryOrder(nodes: Node[]): Node[] {
  const result: Node[] = []

  // Build a map of parent to children
  const childrenMap = new Map<string | null, Node[]>()
  nodes.forEach((node) => {
    const parentId = node.parentId || null
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(node)
  })

  // Sort children by order
  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.order - b.order)
  }

  // Depth-first traversal
  const traverse = (parentId: string | null) => {
    const children = childrenMap.get(parentId) || []
    for (const child of children) {
      result.push(child)
      traverse(child.id)
    }
  }

  traverse(null)

  return result
}

/**
 * Find the next message after the current one, following branch choices.
 * Returns null if there is no next message (end of story or unselected branch).
 */
export function findNextMessageInPath(
  currentMessageId: string,
  messages: Message[],
  nodes: Node[],
  branchChoices: Record<string, string>,
): string | null {
  const currentMessage = messages.find((m) => m.id === currentMessageId)
  if (!currentMessage || !currentMessage.nodeId) return null

  // If current message is a branch, follow the selected option
  if (currentMessage.type === 'branch' && currentMessage.options && currentMessage.options.length > 0) {
    const selectedOptionId = branchChoices[currentMessage.id]

    if (!selectedOptionId) {
      // No choice selected - no next message
      return null
    }

    const selectedOption = currentMessage.options.find((opt) => opt.id === selectedOptionId)
    if (!selectedOption) {
      // Invalid option - no next message
      return null
    }

    // Return the target message
    return selectedOption.targetMessageId
  }

  // Get all messages in the current node, sorted by order
  const nodeMessages = messages.filter((m) => m.nodeId === currentMessage.nodeId).sort((a, b) => a.order - b.order)

  const currentIndex = nodeMessages.findIndex((m) => m.id === currentMessageId)

  // If there's a next message in the same node, return it
  if (currentIndex >= 0 && currentIndex < nodeMessages.length - 1) {
    return nodeMessages[currentIndex + 1].id
  }

  // Otherwise, move to the next node
  const nodesInOrder = getAllNodesInStoryOrder(nodes)
  const currentNodeIndex = nodesInOrder.findIndex((n) => n.id === currentMessage.nodeId)

  if (currentNodeIndex === -1) return null

  // Find next chapter node with messages
  for (let i = currentNodeIndex + 1; i < nodesInOrder.length; i++) {
    const nextNode = nodesInOrder[i]
    if (nextNode.type !== 'chapter') continue

    const nextNodeMessages = messages.filter((m) => m.nodeId === nextNode.id).sort((a, b) => a.order - b.order)

    if (nextNodeMessages.length > 0) {
      return nextNodeMessages[0].id
    }
  }

  // No next message found
  return null
}

/**
 * Detect if the given branch choices (or a new choice) would create a loop in the path.
 * A loop occurs when a branch points back to a message that's already on the active path.
 */
export function detectPathLoop(
  messages: Message[],
  nodes: Node[],
  branchChoices: Record<string, string>,
  newChoice?: { branchMessageId: string; optionId: string },
): boolean {
  // Create a copy of branch choices with the new choice applied
  const choicesToTest = { ...branchChoices }
  if (newChoice) {
    choicesToTest[newChoice.branchMessageId] = newChoice.optionId
  }

  // Track visited messages as we traverse
  const visitedMessages = new Set<string>()

  // Get all nodes in story order
  const nodesInOrder = getAllNodesInStoryOrder(nodes)

  // Build a map of messages by node
  const messagesByNode = new Map<string, Message[]>()
  messages.forEach((msg) => {
    if (!msg.nodeId) return
    if (!messagesByNode.has(msg.nodeId)) {
      messagesByNode.set(msg.nodeId, [])
    }
    messagesByNode.get(msg.nodeId)!.push(msg)
  })

  // Sort messages within each node by order
  for (const nodeMessages of messagesByNode.values()) {
    nodeMessages.sort((a, b) => a.order - b.order)
  }

  // Track current position
  let currentNodeIndex = 0
  let currentMessageIndex = 0
  let iterations = 0
  const maxIterations = messages.length * 2 // Safety limit

  // Walk through the story
  while (currentNodeIndex < nodesInOrder.length && iterations < maxIterations) {
    iterations++

    const currentNode = nodesInOrder[currentNodeIndex]
    const nodeMessages = messagesByNode.get(currentNode.id) || []

    if (currentNode.type !== 'chapter' || nodeMessages.length === 0) {
      currentNodeIndex++
      continue
    }

    while (currentMessageIndex < nodeMessages.length) {
      const message = nodeMessages[currentMessageIndex]

      // Check if we've already visited this message (loop detected!)
      if (visitedMessages.has(message.id)) {
        console.warn('[detectPathLoop] Loop detected at message:', message.id)
        return true
      }

      visitedMessages.add(message.id)

      // Check if this is a branch message
      if (message.type === 'branch' && message.options && message.options.length > 0) {
        const selectedOptionId = choicesToTest[message.id]

        if (!selectedOptionId) {
          // No choice - path ends, no loop
          return false
        }

        const selectedOption = message.options.find((opt) => opt.id === selectedOptionId)
        if (!selectedOption) {
          // Invalid option - path ends, no loop
          return false
        }

        // Jump to target
        const targetNodeIndex = nodesInOrder.findIndex((n) => n.id === selectedOption.targetNodeId)
        const targetNodeMessages = messagesByNode.get(selectedOption.targetNodeId) || []
        const targetMessageIndex = targetNodeMessages.findIndex((m) => m.id === selectedOption.targetMessageId)

        if (targetNodeIndex === -1 || targetMessageIndex === -1) {
          // Invalid target - path ends, no loop
          return false
        }

        currentNodeIndex = targetNodeIndex
        currentMessageIndex = targetMessageIndex
        break
      }

      currentMessageIndex++
    }

    if (currentMessageIndex >= nodeMessages.length) {
      currentNodeIndex++
      currentMessageIndex = 0
    }
  }

  if (iterations >= maxIterations) {
    console.warn('[detectPathLoop] Max iterations reached - likely a loop')
    return true
  }

  return false
}

/**
 * Preview what would be active/inactive if a branch choice was changed.
 * This allows showing the user what will happen before they commit to the choice.
 */
export function getPathPreview(
  branchMessageId: string,
  optionId: string,
  messages: Message[],
  nodes: Node[],
  currentBranchChoices: Record<string, string>,
): { activeMessageIds: Set<string>; activeNodeIds: Set<string> } {
  // Create a copy with the new choice
  const previewChoices = { ...currentBranchChoices, [branchMessageId]: optionId }

  // Calculate the new path
  return calculateActivePath(messages, nodes, previewChoices)
}

/**
 * Get the target message of a branch option.
 */
export function getBranchTarget(option: BranchOption, messages: Message[]): Message | null {
  return messages.find((m) => m.id === option.targetMessageId) || null
}

/**
 * Helper: Create a branch option that targets the first message of a node.
 */
export function createBranchOptionToNode(
  label: string,
  targetNodeId: string,
  messages: Message[],
  description?: string,
): BranchOption | null {
  // Find the first message in the target node
  const targetMessages = messages.filter((m) => m.nodeId === targetNodeId).sort((a, b) => a.order - b.order)

  if (targetMessages.length === 0) {
    console.warn('[createBranchOptionToNode] No messages found in target node:', targetNodeId)
    return null
  }

  return {
    id: generateMessageId(),
    label,
    targetNodeId,
    targetMessageId: targetMessages[0].id,
    description,
  }
}

/**
 * Helper: Create a branch option that targets a specific message in the same chapter.
 */
export function createBranchOptionInChapter(
  label: string,
  targetMessageId: string,
  currentNodeId: string,
  description?: string,
): BranchOption {
  return {
    id: generateMessageId(),
    label,
    targetNodeId: currentNodeId,
    targetMessageId,
    description,
  }
}
