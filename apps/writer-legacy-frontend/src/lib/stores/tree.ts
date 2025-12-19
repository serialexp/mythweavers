import type { Node } from '@writer/shared'
import { createStore } from 'solid-js/store'

const treeStateDefault = {
  structure: [],
}
export const [treeState, setTreeState] = createStore<{
  structure: Node[]
}>(treeStateDefault)

export const resetTreeState = () => {
  setTreeState('structure', [])
}

export const findPathToNode = (nodeId: string): Node[] => {
  const path: Node[] = []

  const findPath = (node: Node): boolean => {
    path.push(node)
    if (node.id === nodeId) return true

    if (node.children) {
      for (const child of node.children) {
        if (findPath(child)) {
          return true
        }
      }
    }

    path.pop()
    return false
  }

  for (const node of treeState.structure) {
    if (findPath(node)) {
      return path
    }
  }

  return []
}

export const findPathToNodeIds = (nodeId: string): string[] => {
  return findPathToNode(nodeId).map((node) => node.id)
}

export const findIndexesToNode = (nodeId: string) => {
  const indexes: number[] = []

  const findIndexes = (node: Node, currentIndex: number): boolean => {
    indexes.push(currentIndex)
    if (node.id === nodeId) return true

    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        if (findIndexes(node.children[i], i)) {
          return true
        }
      }
    }

    indexes.pop()
    return false
  }

  for (let i = 0; i < treeState.structure.length; i++) {
    if (findIndexes(treeState.structure[i], i)) {
      return indexes
    }
  }

  return []
}

export const setTree = (tree: Node[]) => setTreeState('structure', tree)

const pathToNode = (id: string) => {
  const path = findIndexesToNode(id)

  if (path.length === 0) return // Node not found

  // Construct the path for setTreeState
  const pathToNode = path.reduce(
    (acc, index) => {
      acc.push(index, 'children')
      return acc
    },
    ['structure'] as (string | number)[],
  ) as [string, ...Array<string | number>]

  // Remove the last "children" as we want to update the node itself
  pathToNode.pop()

  return pathToNode
}

export const findParent = (id: string): Node | undefined => {
  const pathTo = findPathToNode(id)
  if (!pathTo || pathTo.length < 2) return

  return pathTo[pathTo.length - 2]
}

export const updateNode = (id: string, updates: Partial<Node>) => {
  const pathTo = pathToNode(id)

  // Update the node
  // @ts-expect-error: TS does not know that pathToNode is a valid path
  setTreeState(...pathTo, (node) => {
    return { ...node, ...updates }
  })
}

export const appendNode = (node: Node, parentId?: string, afterId?: string) => {
  if (parentId) {
    const pathToParent = pathToNode(parentId)
    // @ts-expect-error: TS does not know that pathToNode is a valid path
    setTreeState(...pathToParent, 'children', (children) => {
      if (afterId) {
        const index = children.findIndex((child: Node) => child.id === afterId)
        return [...(children.slice(0, index + 1) ?? []), node, ...(children.slice(index + 1) ?? [])]
      }
      return [...(children ?? []), node]
    })
  } else {
    setTreeState('structure', (structure) => [...structure, node])
  }
}

export const removeNode = (id: string) => {
  const pathTo = pathToNode(id)
  if (!pathTo) return
  const parentPath = pathTo.slice(0, -1)
  // @ts-expect-error: TS does not know that pathToNode is a valid path
  setTreeState(...parentPath, (children: Node['children']) => children?.filter((child: Node) => child.id !== id))
}

export const findNode = (id: string): Node | undefined => {
  const pathTo = pathToNode(id)
  if (!pathTo) return

  const pathWithoutStructure = pathTo.slice(1)

  let current: Node[] | Node = treeState.structure
  for (const path of pathWithoutStructure) {
    // @ts-expect-error: TS does not know that path is a valid index for the object/array
    current = current[path]
  }
  if (Array.isArray(current)) {
    throw new Error('Somehow ended up with an array')
  }
  return current
}

export const moveNode = (id: string, newParentId: string, afterId?: string) => {
  const node = findNode(id)
  if (!node) return
  removeNode(id)
  appendNode(node, newParentId, afterId)
}

export const getItemsInOrder = (type: Node['type']) => {
  const items: Node[] = []

  const traverse = (node: Node) => {
    if (node.type === type) {
      items.push(node)
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child)
      }
    }
  }

  for (const node of treeState.structure) {
    traverse(node)
  }

  return items
}

export const getItemsInOrderContainedInId = (
  type: Node['type'],
  parentId: string,
  _options?: {
    onlyStoryNodes?: boolean
  },
) => {
  const items: Node[] = []

  const traverse = (node: Node, parentIsContainedInId = false) => {
    if (node.type === type && parentIsContainedInId && node.nodeType === 'story') {
      items.push(node)
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child, parentIsContainedInId || child.id === parentId)
      }
    }
  }

  for (const node of treeState.structure) {
    traverse(node, node.id === parentId)
  }

  return items
}

export const setTreeItemOpen = (id: string, isOpen: boolean) => {
  updateNode(id, { isOpen })
}

export const isEffectivelyNonStory = (id: string): boolean => {
  const path = findPathToNode(id)
  return path.some((node) => node.nodeType !== 'story')
}

export const toggleStoryNode = (id: string) => {
  const node = findNode(id)
  if (!node) return
  // Cycle through the node types: story -> context -> non-story -> story
  const nextType = {
    story: 'context',
    context: 'non-story',
    'non-story': 'story',
  }[node.nodeType] as 'story' | 'context' | 'non-story'
  updateNode(id, { nodeType: nextType })
}

export const insertNode = (node: Node, parentId: string, beforeId?: string) => {
  // Remove parentId from node if it exists to avoid redundancy
  const { parentId: _, ...nodeWithoutParentId } = node

  if (beforeId) {
    const parent = findNode(parentId)
    if (!parent) return

    const insertIndex = parent.children?.findIndex((child) => child.id === beforeId) ?? 0
    const newChildren = [...(parent.children ?? [])]
    newChildren.splice(insertIndex, 0, nodeWithoutParentId)

    updateNode(parentId, { children: newChildren })
  } else {
    appendNode(nodeWithoutParentId, parentId)
  }
}

export const updateAllChildrenNodeType = (parentId: string, nodeType: Node['nodeType']) => {
  const node = findNode(parentId)
  if (!node) return

  const updateChildren = (currentNode: Node) => {
    if (currentNode.children) {
      for (const child of currentNode.children) {
        updateNode(child.id, { nodeType })
        updateChildren(child)
      }
    }
  }

  updateChildren(node)
}

export const getContextNodes = (): Node[] => {
  const contextNodes: Node[] = []

  const traverse = (node: Node, parentIsContext = false) => {
    // If this is a scene node and either:
    // 1. It has nodeType "context", or
    // 2. Its parent is a context node
    if (node.type === 'scene' && (node.nodeType === 'context' || parentIsContext)) {
      contextNodes.push(node)
    }

    // If this node is a context node, mark all its children as being under a context node
    const isContext = node.nodeType === 'context'

    if (node.children) {
      for (const child of node.children) {
        traverse(child, isContext)
      }
    }
  }

  for (const node of treeState.structure) {
    traverse(node)
  }

  return contextNodes
}

export const getStoryNodes = (): Node[] => {
  const storyNodes: Node[] = []

  const traverse = (node: Node) => {
    if (node.type === 'scene' && node.nodeType === 'story') {
      storyNodes.push(node)
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child)
      }
    }
  }

  for (const node of treeState.structure) {
    traverse(node)
  }

  return storyNodes
}

/**
 * Search for story nodes based on a query string
 * @param query The search query
 * @param maxResults Maximum number of results to return
 * @returns Array of matching story nodes
 */
export const searchStoryNodes = (query: string, maxResults = 10): Node[] => {
  if (!query || query.trim() === '') {
    return []
  }

  const results: Node[] = []
  const lowerQuery = query.toLowerCase()

  const traverse = (node: Node) => {
    // Only include scene nodes that are marked as story nodes
    if (node.type === 'scene' && node.nodeType === 'story') {
      // Check if the node name contains the query
      if (node.name.toLowerCase().includes(lowerQuery) || node.oneliner?.toLowerCase().includes(lowerQuery)) {
        results.push(node)
      }
    }

    // Continue traversing children
    if (node.children) {
      for (const child of node.children) {
        traverse(child)
      }
    }
  }

  for (const node of treeState.structure) {
    traverse(node)
  }

  // Return up to maxResults results
  return results.slice(0, maxResults)
}
