import { batch } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { saveService } from '../services/saveService'
import { Node, NodeType } from '../types/core'
import { generateMessageId } from '../utils/id'
import { currentStoryStore } from './currentStoryStore'

// Lightweight tree structure with only IDs
export interface TreeNode {
  id: string
  children: TreeNode[]
}

interface NodeState {
  nodes: Record<string, Node> // Hash map - single source of truth
  tree: TreeNode[] // Lightweight, ID-only structure
  selectedNodeId: string | null
  expandedNodes: Set<string>
  loading: boolean
}

const [nodeState, setNodeState] = createStore<NodeState>({
  nodes: {},
  tree: [],
  selectedNodeId: null,
  expandedNodes: new Set(),
  loading: false,
})

// Build lightweight tree from node hash map
function buildTree(nodes: Record<string, Node>): TreeNode[] {
  const nodeValues = Object.values(nodes) // Cache to avoid creating array twice
  const treeNodeMap = new Map<string, TreeNode>()
  const tree: TreeNode[] = []

  // First pass: create TreeNode for each node
  for (let i = 0; i < nodeValues.length; i++) {
    const node = nodeValues[i]
    treeNodeMap.set(node.id, { id: node.id, children: [] })
  }

  // Second pass: build tree structure
  for (let i = 0; i < nodeValues.length; i++) {
    const node = nodeValues[i]
    const treeNode = treeNodeMap.get(node.id)!
    if (node.parentId) {
      const parent = treeNodeMap.get(node.parentId)
      if (parent) {
        parent.children.push(treeNode)
      }
    } else {
      tree.push(treeNode)
    }
  }

  // Sort children by order
  const sortChildren = (treeNodes: TreeNode[]) => {
    treeNodes.sort((a, b) => nodes[a.id].order - nodes[b.id].order)
    for (let i = 0; i < treeNodes.length; i++) {
      const treeNode = treeNodes[i]
      if (treeNode.children.length > 0) {
        sortChildren(treeNode.children)
      }
    }
  }

  sortChildren(tree)
  return tree
}

type IncomingNode = Omit<Node, 'createdAt' | 'updatedAt' | 'activeCharacterIds' | 'activeContextItemIds'> & {
  createdAt: string | Date
  updatedAt: string | Date
  activeCharacterIds?: string[] | string | null
  activeContextItemIds?: string[] | string | null
}

function parseIdArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string')
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === 'string')
      }
    } catch {
      // Ignore JSON parse errors and fall through to return empty array
    }
  }

  return []
}

function normalizeIncomingNode(node: IncomingNode): Node {
  // Only scene nodes have content, so default to 2 (full) for scenes, 0 for others
  const includeInFull = node.includeInFull ?? (node.type === 'scene' ? 2 : 0)
  const expanded = node.expanded ?? true

  return {
    ...node,
    includeInFull,
    expanded,
    activeCharacterIds: parseIdArray(node.activeCharacterIds),
    activeContextItemIds: parseIdArray(node.activeContextItemIds),
    createdAt: node.createdAt instanceof Date ? node.createdAt : new Date(node.createdAt),
    updatedAt: node.updatedAt instanceof Date ? node.updatedAt : new Date(node.updatedAt),
  }
}

function collectNodeAndDescendantIds(nodes: Record<string, Node>, nodeId: string): Set<string> {
  const result = new Set<string>()
  const childrenByParent = new Map<string | null, string[]>()

  Object.values(nodes).forEach((node) => {
    const parentKey = node.parentId ?? null
    const siblings = childrenByParent.get(parentKey)
    if (siblings) {
      siblings.push(node.id)
    } else {
      childrenByParent.set(parentKey, [node.id])
    }
  })

  const stack: string[] = [nodeId]

  while (stack.length > 0) {
    const currentId = stack.pop()
    if (!currentId || result.has(currentId)) {
      continue
    }

    if (!nodes[currentId]) {
      continue
    }

    result.add(currentId)

    const children = childrenByParent.get(currentId)
    if (children) {
      stack.push(...children)
    }
  }

  return result
}

// Get all ancestor IDs for a node
function getAncestorIds(nodes: Record<string, Node>, nodeId: string): string[] {
  const node = nodes[nodeId]
  if (!node || !node.parentId) return []
  return [node.parentId, ...getAncestorIds(nodes, node.parentId)]
}

// Node Store API
export const nodeStore = {
  // Getters
  get state() {
    return nodeState
  },
  get nodes() {
    return nodeState.nodes
  },
  get nodesArray() {
    return Object.values(nodeState.nodes)
  },
  get tree() {
    return nodeState.tree
  },
  get selectedNodeId() {
    return nodeState.selectedNodeId
  },
  get loading() {
    return nodeState.loading
  },

  // Get selected node
  getSelectedNode(): Node | null {
    if (!nodeState.selectedNodeId) return null
    return nodeState.nodes[nodeState.selectedNodeId] || null
  },

  // Get node by ID
  getNode(id: string): Node | null {
    return nodeState.nodes[id] || null
  },

  // Initialize nodes from server data
  setNodes(nodes: Node[]) {
    // Setting nodes

    // Check for duplicate IDs
    const idCounts = new Map<string, number>()
    nodes.forEach((node) => {
      idCounts.set(node.id, (idCounts.get(node.id) || 0) + 1)
    })
    const duplicates = Array.from(idCounts.entries()).filter(([_, count]) => count > 1)
    if (duplicates.length > 0) {
      // WARNING: Duplicate node IDs found
    }

    batch(() => {
      // Convert array to hash map and set defaults
      const nodesMap: Record<string, Node> = {}
      nodes.forEach((node) => {
        // Set default includeInFull value if undefined
        // Only scene nodes have content, so default to 2 (full) for scenes, 0 for others
        if (node.includeInFull === undefined) {
          node.includeInFull = node.type === 'scene' ? 2 : 0
        }

        // Parse JSON string fields into arrays
        if (typeof node.activeCharacterIds === 'string') {
          try {
            node.activeCharacterIds = JSON.parse(node.activeCharacterIds)
          } catch (_e) {
            node.activeCharacterIds = []
          }
        }
        if (typeof node.activeContextItemIds === 'string') {
          try {
            node.activeContextItemIds = JSON.parse(node.activeContextItemIds)
          } catch (_e) {
            node.activeContextItemIds = []
          }
        }

        // Ensure arrays are never null or undefined
        if (!Array.isArray(node.activeCharacterIds)) {
          node.activeCharacterIds = []
        }
        if (!Array.isArray(node.activeContextItemIds)) {
          node.activeContextItemIds = []
        }

        nodesMap[node.id] = node
      })

      setNodeState('nodes', nodesMap)
      const tree = buildTree(nodesMap)
      // Built tree structure
      setNodeState('tree', tree)

      // Restore expanded state for all nodes
      const expanded = new Set<string>()
      nodes.forEach((node) => {
        if (node.expanded !== false) {
          expanded.add(node.id)
        }
      })
      setNodeState('expandedNodes', expanded)
    })
  },

  // Select a node
  selectNode(nodeId: string | null) {
    setNodeState('selectedNodeId', nodeId)

    // Save the selected node ID to the server/local storage
    const storyId = currentStoryStore.id
    if (storyId) {
      saveService.saveStorySettings(storyId, { selectedNodeId: nodeId })
    }

    // If selecting a chapter node, also set it as the selected chapter
    if (nodeId) {
      const node = nodeState.nodes[nodeId]
      if (node && node.type === 'chapter') {
        // Chapter selection is now handled through node selection
      }

      // Auto-expand ancestors when selecting
      const ancestors = getAncestorIds(nodeState.nodes, nodeId)
      batch(() => {
        ancestors.forEach((id) => {
          setNodeState('expandedNodes', (prev) => new Set([...prev, id]))
        })
      })
    } else {
      // Deselecting node
    }
  },

  // Toggle node expansion in tree
  toggleExpanded(nodeId: string) {
    setNodeState('expandedNodes', (prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  },

  // Check if node is expanded
  isExpanded(nodeId: string): boolean {
    return nodeState.expandedNodes.has(nodeId)
  },

  // Add a new node
  addNode(parentId: string | null, type: NodeType, title = `New ${type}`): Node {
    const id = generateMessageId()
    // Creating new node

    const siblings = Object.values(nodeState.nodes).filter((n) =>
      parentId ? n.parentId === parentId : !n.parentId && n.type === 'book',
    )

    const newNode: Node = {
      id,
      storyId: '', // Will be set by server
      parentId,
      type,
      title,
      order: siblings.length,
      expanded: true,
      isOpen: true,
      // Only scenes have content, so default to 2 (full content) for scenes, 0 for others
      includeInFull: type === 'scene' ? 2 : 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    batch(() => {
      setNodeState('nodes', id, newNode)
      setNodeState('tree', buildTree(nodeState.nodes))

      // Expand parent if adding child
      if (parentId) {
        setNodeState('expandedNodes', (prev) => new Set([...prev, parentId]))
      }
    })

    // Always trigger save through saveService (it handles storage mode internally)
    if (currentStoryStore.isInitialized) {
      saveService.saveNode(currentStoryStore.id, newNode.id, newNode, 'insert')
    }

    return newNode
  },

  // Insert a new node before another node
  insertNodeBefore(beforeNodeId: string, type: NodeType, title = `New ${type}`): Node | null {
    const beforeNode = nodeState.nodes[beforeNodeId]
    if (!beforeNode) {
      // Cannot insert before node: not found
      return null
    }

    const id = generateMessageId()
    // Inserting new node

    const newNode: Node = {
      id,
      storyId: '', // Will be set by server
      parentId: beforeNode.parentId,
      type,
      title,
      order: beforeNode.order, // Take the position of the node we're inserting before
      expanded: true,
      isOpen: true,
      // Only scenes have content, so default to 2 (full content) for scenes, 0 for others
      includeInFull: type === 'scene' ? 2 : 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const affectedNodeIds = new Set<string>()

    batch(() => {
      // Shift all siblings at or after this position
      const siblings = Object.values(nodeState.nodes).filter(
        (n) => n.parentId === beforeNode.parentId && n.order >= beforeNode.order,
      )
      siblings.forEach((sibling) => {
        setNodeState('nodes', sibling.id, 'order', sibling.order + 1)
        affectedNodeIds.add(sibling.id)
      })

      // Add the new node
      setNodeState('nodes', id, newNode)
      setNodeState('tree', buildTree(nodeState.nodes))

      // Expand parent if it exists
      if (newNode.parentId) {
        setNodeState('expandedNodes', (prev) => new Set([...prev, newNode.parentId!]))
      }
    })

    // Always trigger save through saveService (it handles storage mode internally)
    if (currentStoryStore.isInitialized) {
      // Save new node first
      saveService.saveNode(currentStoryStore.id, newNode.id, newNode, 'insert')

      // Save all reordered nodes (excluding the new node which is already being inserted)
      const nodesToSave = Object.values(nodeState.nodes).filter((n) => affectedNodeIds.has(n.id))

      if (nodesToSave.length > 0) {
        saveService.saveNodesBulk(currentStoryStore.id, nodesToSave)
      }
    }

    return newNode
  },

  // Update a node
  updateNode(nodeId: string, updates: Partial<Node>) {
    this.updateNodeNoSave(nodeId, updates)

    // Always trigger save through saveService (it handles storage mode internally)
    if (currentStoryStore.isInitialized) {
      const node = nodeState.nodes[nodeId]
      if (node) {
        // Debounce saves for title updates
        const debounce = updates.title !== undefined
        saveService.saveNode(currentStoryStore.id, nodeId, node, 'update', debounce)
      }
    }
  },

  updateNodeNoSave(nodeId: string, updates: Partial<Node>) {
    batch(() => {
      // Update node in hash map
      Object.keys(updates).forEach((key) => {
        setNodeState('nodes', nodeId, key as keyof Node, updates[key as keyof Node] as any)
      })
      if (updates.parentId || updates.order) {
        setNodeState('tree', buildTree(nodeState.nodes))
      }
    })
  },

  upsertNodeFromServer(nodeData: IncomingNode) {
    const existing = nodeState.nodes[nodeData.id]
    const normalized = normalizeIncomingNode(nodeData)

    batch(() => {
      setNodeState('nodes', normalized.id, normalized)
      setNodeState('tree', buildTree(nodeState.nodes))
      setNodeState('expandedNodes', (prev) => {
        const next = new Set(prev)

        if (normalized.expanded === false) {
          next.delete(normalized.id)
        } else {
          next.add(normalized.id)
        }

        if (!existing && normalized.parentId) {
          next.add(normalized.parentId)
        }

        return next
      })
    })
  },

  // Delete a node and its children
  // If permanent is true, hard delete (no recovery); otherwise soft delete
  deleteNode(nodeId: string, permanent = false) {
    // Get node data BEFORE deleting from local state (needed for save)
    const node = nodeState.nodes[nodeId]
    if (!node) {
      return
    }

    const removedNodeIds = this.deleteNodeNoSave(nodeId)
    if (removedNodeIds.size === 0) {
      return
    }

    // Always trigger save through saveService (it handles storage mode internally)
    // Only save the root node deletion - backend will handle deleting descendants
    if (currentStoryStore.isInitialized) {
      const nodeWithPermanent = permanent ? { ...node, permanent } : node
      saveService.saveNode(currentStoryStore.id, nodeId, nodeWithPermanent, 'delete')
    }
  },

  deleteNodeNoSave(nodeId: string): Set<string> {
    const nodesToDelete = collectNodeAndDescendantIds(nodeState.nodes, nodeId)
    if (nodesToDelete.size === 0) {
      return nodesToDelete
    }

    const nextExpanded = new Set(nodeState.expandedNodes)
    nodesToDelete.forEach((id) => nextExpanded.delete(id))

    batch(() => {
      nodesToDelete.forEach((id) => {
        setNodeState('nodes', id, undefined!)
      })

      setNodeState('tree', buildTree(nodeState.nodes))
      setNodeState('expandedNodes', nextExpanded)

      if (nodeState.selectedNodeId && nodesToDelete.has(nodeState.selectedNodeId)) {
        setNodeState('selectedNodeId', null)
      }
    })

    return nodesToDelete
  },

  // Move a node to a new parent/position
  moveNode(nodeId: string, newParentId: string | null, newOrder: number) {
    const node = nodeState.nodes[nodeId]
    if (!node) return

    // Prevent moving a node to its own descendant
    if (newParentId) {
      const ancestors = getAncestorIds(nodeState.nodes, newParentId)
      if (ancestors.includes(nodeId)) return
    }

    const oldParentId = node.parentId

    batch(() => {
      // Update the moved node
      setNodeState('nodes', nodeId, 'parentId', newParentId)
      setNodeState('nodes', nodeId, 'order', newOrder)

      // Update orders of siblings in the new parent
      const newSiblings = Object.values(nodeState.nodes).filter((n) => n.parentId === newParentId && n.id !== nodeId)
      newSiblings.sort((a, b) => a.order - b.order)
      newSiblings.forEach((sibling, index) => {
        const targetOrder = index >= newOrder ? index + 1 : index
        if (sibling.order !== targetOrder) {
          setNodeState('nodes', sibling.id, 'order', targetOrder)
        }
      })

      // If moving between parents, reorder old parent's children to close gaps
      if (oldParentId !== newParentId) {
        const oldSiblings = Object.values(nodeState.nodes).filter((n) => n.parentId === oldParentId && n.id !== nodeId)
        oldSiblings.sort((a, b) => a.order - b.order)
        oldSiblings.forEach((sibling, index) => {
          if (sibling.order !== index) {
            setNodeState('nodes', sibling.id, 'order', index)
          }
        })
      }

      setNodeState('tree', buildTree(nodeState.nodes))
    })

    // Always trigger save through saveService (it handles storage mode internally)
    // Use bulk reorder endpoint to update all nodes in affected parent(s) in a single request
    if (currentStoryStore.isInitialized) {
      const allNodesInNewParent = Object.values(nodeState.nodes).filter((n) => n.parentId === newParentId)
      const nodesToReorder = [...allNodesInNewParent]

      // Also include nodes in old parent if moving between parents
      if (oldParentId !== newParentId) {
        const allNodesInOldParent = Object.values(nodeState.nodes).filter((n) => n.parentId === oldParentId)
        nodesToReorder.push(...allNodesInOldParent)
      }

      if (nodesToReorder.length > 0) {
        const reorderItems = nodesToReorder.map((n) => ({
          nodeId: n.id,
          nodeType: n.type as 'book' | 'arc' | 'chapter' | 'scene',
          parentId: n.parentId ?? null,
          order: n.order,
        }))
        saveService.reorderNodes(currentStoryStore.id, reorderItems)
      }
    }
  },

  // Set loading state
  setLoading(loading: boolean) {
    setNodeState('loading', loading)
  },

  // Clear all nodes
  clear() {
    batch(() => {
      setNodeState('nodes', reconcile({}))
      setNodeState('tree', [])
      setNodeState('selectedNodeId', null)
      setNodeState('expandedNodes', new Set())
    })
  },

  // Update children of a specific node (for drag and drop)
  updateNodeChildren(parentId: string, newChildren: TreeNode[], shouldSave = true) {
    // Updating node children
    const affectedNodeIds = new Set<string>()

    batch(() => {
      // First, get all the child IDs from the new order
      const childIds = newChildren.map((child) => child.id)

      // Update the order and parentId of the children based on their new positions
      childIds.forEach((childId, index) => {
        setNodeState('nodes', childId, 'parentId', parentId)
        setNodeState('nodes', childId, 'order', index)
        affectedNodeIds.add(childId)
      })

      // Rebuild the tree
      setNodeState('tree', buildTree(nodeState.nodes))
    })

    // Always trigger save through saveService (it handles storage mode internally)
    if (shouldSave && currentStoryStore.isInitialized) {
      const nodesToSave = Object.values(nodeState.nodes).filter((n) => affectedNodeIds.has(n.id))
      if (nodesToSave.length > 0) {
        saveService.saveNodesBulk(currentStoryStore.id, nodesToSave)
      }
    }
  },

  // Update root level nodes (for drag and drop)
  updateRootNodes(newRootNodes: TreeNode[], shouldSave = true) {
    // Updating root nodes
    const affectedNodeIds = new Set<string>()

    batch(() => {
      // Get all the node IDs from the new order
      const nodeIds = newRootNodes.map((node) => node.id)

      // Update the order of root nodes based on their new positions
      nodeIds.forEach((nodeId, index) => {
        setNodeState('nodes', nodeId, 'parentId', null)
        setNodeState('nodes', nodeId, 'order', index)
        affectedNodeIds.add(nodeId)
      })

      // Rebuild the tree
      setNodeState('tree', buildTree(nodeState.nodes))
    })

    // Always trigger save through saveService (it handles storage mode internally)
    if (shouldSave && currentStoryStore.isInitialized) {
      const nodesToSave = Object.values(nodeState.nodes).filter((n) => affectedNodeIds.has(n.id))
      if (nodesToSave.length > 0) {
        saveService.saveNodesBulk(currentStoryStore.id, nodesToSave)
      }
    }
  },

  // Generate summary for a node (scene or chapter type)
  async generateNodeSummary(
    nodeId: string,
    generateSummaryFn: (params: {
      nodeId: string
      title: string
      content: string
      viewpointCharacterId?: string
    }) => Promise<string>,
  ): Promise<string> {
    const node = nodeState.nodes[nodeId]
    if (!node) {
      throw new Error('Node not found')
    }

    if (node.type !== 'chapter' && node.type !== 'scene') {
      throw new Error('Only scene or chapter nodes can have summaries')
    }

    try {
      // Mark node as summarizing
      setNodeState('nodes', nodeId, 'isSummarizing', true)

      // Get all messages in this node
      const { messagesStore } = await import('./messagesStore')
      const nodeMessages = messagesStore.messages.filter(
        (msg) => msg.sceneId === nodeId && msg.role === 'assistant' && msg.type !== 'chapter' && !msg.isQuery,
      )

      console.log(`[generateNodeSummary] Found ${nodeMessages.length} messages in node ${nodeId}`)

      if (nodeMessages.length === 0) {
        throw new Error('No messages found in this node to summarize')
      }

      // Combine all node content
      const nodeContent = nodeMessages.map((msg) => msg.content).join('\n\n')

      // Generate the summary using the provided function, including viewpoint character if set
      const summary = await generateSummaryFn({
        nodeId,
        title: node.title,
        content: nodeContent,
        viewpointCharacterId: node.viewpointCharacterId,
      })

      // Update the node with the summary
      batch(() => {
        setNodeState('nodes', nodeId, 'summary', summary)
        setNodeState('nodes', nodeId, 'isSummarizing', false)
      })

      // Save the node with its new summary
      const storyId = currentStoryStore.id
      if (storyId) {
        const updatedNode = nodeState.nodes[nodeId]
        if (updatedNode) {
          saveService.saveNode(storyId, nodeId, updatedNode, 'update')
        }
      }

      return summary
    } catch (error) {
      // Clear summarizing state on error
      setNodeState('nodes', nodeId, 'isSummarizing', false)
      console.error('[nodeStore.generateNodeSummary] Error generating node summary:', error)
      throw error
    }
  },

  // Get all scene nodes that appear before the given node in tree order
  getPrecedingScenes(nodeId: string): Node[] {
    const allScenes: Node[] = []
    const targetNode = nodeState.nodes[nodeId]
    if (!targetNode) return []

    // Traverse tree in order and collect scenes until we hit the target
    const collectScenes = (treeNodes: TreeNode[]): boolean => {
      for (const treeNode of treeNodes) {
        if (treeNode.id === nodeId) {
          // Found target, stop collecting
          return true
        }

        const node = nodeState.nodes[treeNode.id]
        if (node && node.type === 'scene') {
          allScenes.push(node)
        }

        // Recursively check children
        if (treeNode.children.length > 0) {
          const found = collectScenes(treeNode.children)
          if (found) return true
        }
      }
      return false
    }

    collectScenes(nodeState.tree)
    return allScenes
  },

  /**
   * Get all chapter nodes that appear before the given node in tree order
   * @deprecated Use getPrecedingScenes instead - scenes now contain summaries
   */
  getPrecedingChapters(nodeId: string): Node[] {
    const allChapters: Node[] = []
    const targetNode = nodeState.nodes[nodeId]
    if (!targetNode) return []

    // Traverse tree in order and collect chapters until we hit the target
    const collectChapters = (treeNodes: TreeNode[]): boolean => {
      for (const treeNode of treeNodes) {
        if (treeNode.id === nodeId) {
          // Found target, stop collecting
          return true
        }

        const node = nodeState.nodes[treeNode.id]
        if (node && node.type === 'chapter') {
          allChapters.push(node)
        }

        // Recursively check children
        if (treeNode.children.length > 0) {
          const found = collectChapters(treeNode.children)
          if (found) return true
        }
      }
      return false
    }

    collectChapters(nodeState.tree)
    return allChapters
  },

  /**
   * Set includeInFull for all preceding chapters
   * @deprecated Use setIncludeForPrecedingScenes instead - scenes now contain content
   */
  setIncludeForPrecedingChapters(nodeId: string, includeValue: number) {
    const precedingChapters = this.getPrecedingChapters(nodeId)
    if (precedingChapters.length === 0) return

    const affectedNodeIds = new Set<string>()

    batch(() => {
      precedingChapters.forEach((chapter) => {
        setNodeState('nodes', chapter.id, 'includeInFull', includeValue)
        affectedNodeIds.add(chapter.id)
      })
    })

    // Always trigger save through saveService (it handles storage mode internally)
    if (currentStoryStore.isInitialized) {
      const nodesToSave = Object.values(nodeState.nodes).filter((n) => affectedNodeIds.has(n.id))
      if (nodesToSave.length > 0) {
        saveService.saveNodesBulk(currentStoryStore.id, nodesToSave)
      }
    }
  },

  // Set includeInFull for all preceding scenes
  setIncludeForPrecedingScenes(nodeId: string, includeValue: number) {
    const precedingScenes = this.getPrecedingScenes(nodeId)
    if (precedingScenes.length === 0) return

    const affectedNodeIds = new Set<string>()

    batch(() => {
      precedingScenes.forEach((scene) => {
        setNodeState('nodes', scene.id, 'includeInFull', includeValue)
        affectedNodeIds.add(scene.id)
      })
    })

    // Always trigger save through saveService (it handles storage mode internally)
    if (currentStoryStore.isInitialized) {
      const nodesToSave = Object.values(nodeState.nodes).filter((n) => affectedNodeIds.has(n.id))
      if (nodesToSave.length > 0) {
        saveService.saveNodesBulk(currentStoryStore.id, nodesToSave)
      }
    }
  },
}
