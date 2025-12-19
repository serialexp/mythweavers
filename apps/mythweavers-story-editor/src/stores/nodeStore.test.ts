import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Node } from '../types/core'
import { TreeNode } from './nodeStore'

// Mock the dependencies
vi.mock('../services/saveService', () => ({
  saveService: {
    saveNode: vi.fn(),
    saveNodesBulk: vi.fn(),
    setCallbacks: vi.fn(),
  },
}))

vi.mock('./currentStoryStore', () => ({
  currentStoryStore: {
    isInitialized: false,
    storageMode: 'local',
    id: 'test-story-id',
  },
}))

vi.mock('./chaptersStore', () => ({
  chaptersStore: {
    selectChapter: vi.fn(),
    getSelectedChapterId: vi.fn(() => null),
  },
}))

// Import nodeStore after mocking dependencies
const { nodeStore } = await import('./nodeStore')

describe('nodeStore', () => {
  beforeEach(() => {
    // Clear the store before each test
    nodeStore.setNodes([])
  })

  describe('tree building', () => {
    it('should build a simple tree structure', () => {
      const nodes: Node[] = [
        {
          id: 'book1',
          parentId: null,
          type: 'book',
          title: 'Book 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'arc1',
          parentId: 'book1',
          type: 'arc',
          title: 'Arc 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ch1',
          parentId: 'arc1',
          type: 'chapter',
          title: 'Chapter 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ch2',
          parentId: 'arc1',
          type: 'chapter',
          title: 'Chapter 2',
          order: 1,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      nodeStore.setNodes(nodes)

      const tree = nodeStore.tree
      expect(tree).toHaveLength(1)
      expect(tree[0].id).toBe('book1')
      expect(tree[0].children).toHaveLength(1)
      expect(tree[0].children![0].id).toBe('arc1')
      expect(tree[0].children![0].children).toHaveLength(2)
      expect(tree[0].children![0].children![0].id).toBe('ch1')
      expect(tree[0].children![0].children![1].id).toBe('ch2')
    })

    it('should handle multiple books', () => {
      const nodes: Node[] = [
        {
          id: 'book1',
          parentId: null,
          type: 'book',
          title: 'Book 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'book2',
          parentId: null,
          type: 'book',
          title: 'Book 2',
          order: 1,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'arc1',
          parentId: 'book1',
          type: 'arc',
          title: 'Arc 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'arc2',
          parentId: 'book2',
          type: 'arc',
          title: 'Arc 2',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      nodeStore.setNodes(nodes)

      const tree = nodeStore.tree
      expect(tree).toHaveLength(2)
      expect(tree[0].id).toBe('book1')
      expect(tree[1].id).toBe('book2')
      expect(tree[0].children![0].id).toBe('arc1')
      expect(tree[1].children![0].id).toBe('arc2')
    })

    it('should sort nodes by order', () => {
      const nodes: Node[] = [
        {
          id: 'ch3',
          parentId: 'arc1',
          type: 'chapter',
          title: 'Chapter 3',
          order: 2,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ch1',
          parentId: 'arc1',
          type: 'chapter',
          title: 'Chapter 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ch2',
          parentId: 'arc1',
          type: 'chapter',
          title: 'Chapter 2',
          order: 1,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'arc1',
          parentId: 'book1',
          type: 'arc',
          title: 'Arc 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'book1',
          parentId: null,
          type: 'book',
          title: 'Book 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      nodeStore.setNodes(nodes)

      const arc = nodeStore.tree[0].children![0]
      expect(arc.children).toHaveLength(3)
      expect(arc.children![0].id).toBe('ch1')
      expect(arc.children![1].id).toBe('ch2')
      expect(arc.children![2].id).toBe('ch3')
    })
  })

  describe('node selection', () => {
    it('should select a node and auto-expand ancestors', () => {
      const nodes: Node[] = [
        {
          id: 'book1',
          parentId: null,
          type: 'book',
          title: 'Book 1',
          order: 0,
          storyId: 'story1',
          expanded: false,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'arc1',
          parentId: 'book1',
          type: 'arc',
          title: 'Arc 1',
          order: 0,
          storyId: 'story1',
          expanded: false,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ch1',
          parentId: 'arc1',
          type: 'chapter',
          title: 'Chapter 1',
          order: 0,
          storyId: 'story1',
          expanded: false,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      nodeStore.setNodes(nodes)

      // Initially nothing expanded
      expect(nodeStore.isExpanded('book1')).toBe(false)
      expect(nodeStore.isExpanded('arc1')).toBe(false)

      // Select the chapter
      nodeStore.selectNode('ch1')

      // Should select the node
      expect(nodeStore.selectedNodeId).toBe('ch1')

      // Should auto-expand ancestors
      expect(nodeStore.isExpanded('book1')).toBe(true)
      expect(nodeStore.isExpanded('arc1')).toBe(true)
    })
  })

  describe('insertNodeBefore', () => {
    it('should insert a node before another and reorder siblings', () => {
      const nodes: Node[] = [
        {
          id: 'book1',
          parentId: null,
          type: 'book',
          title: 'Book 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'arc1',
          parentId: 'book1',
          type: 'arc',
          title: 'Arc 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'arc2',
          parentId: 'book1',
          type: 'arc',
          title: 'Arc 2',
          order: 1,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'arc3',
          parentId: 'book1',
          type: 'arc',
          title: 'Arc 3',
          order: 2,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      nodeStore.setNodes(nodes)

      // Insert a new arc before arc2
      const newNode = nodeStore.insertNodeBefore('arc2', 'arc', 'New Arc')

      expect(newNode).not.toBeNull()
      expect(newNode!.parentId).toBe('book1')
      expect(newNode!.order).toBe(1)

      // Check that arc2 and arc3 were shifted
      const arc2 = nodeStore.getNode('arc2')
      const arc3 = nodeStore.getNode('arc3')
      expect(arc2!.order).toBe(2)
      expect(arc3!.order).toBe(3)

      // Check tree structure
      const book = nodeStore.tree[0]
      expect(book.children).toHaveLength(4)
      expect(book.children![0].id).toBe('arc1')
      expect(book.children![1].id).toBe(newNode!.id)
      expect(book.children![2].id).toBe('arc2')
      expect(book.children![3].id).toBe('arc3')
    })

    it('should insert at the beginning when inserting before first node', () => {
      const nodes: Node[] = [
        {
          id: 'book1',
          parentId: null,
          type: 'book',
          title: 'Book 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'arc1',
          parentId: 'book1',
          type: 'arc',
          title: 'Arc 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'arc2',
          parentId: 'book1',
          type: 'arc',
          title: 'Arc 2',
          order: 1,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      nodeStore.setNodes(nodes)

      // Insert before the first arc
      const newNode = nodeStore.insertNodeBefore('arc1', 'arc', 'New First Arc')

      expect(newNode!.order).toBe(0)

      // Check that arc1 and arc2 were shifted
      const arc1 = nodeStore.getNode('arc1')
      const arc2 = nodeStore.getNode('arc2')
      expect(arc1!.order).toBe(1)
      expect(arc2!.order).toBe(2)
    })
  })

  describe('getNode', () => {
    it('should retrieve a node by ID', () => {
      const nodes: Node[] = [
        {
          id: 'book1',
          parentId: null,
          type: 'book',
          title: 'Book 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'arc1',
          parentId: 'book1',
          type: 'arc',
          title: 'Arc 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      nodeStore.setNodes(nodes)

      const book = nodeStore.getNode('book1')
      expect(book).not.toBeNull()
      expect(book!.title).toBe('Book 1')

      const arc = nodeStore.getNode('arc1')
      expect(arc).not.toBeNull()
      expect(arc!.title).toBe('Arc 1')

      const notFound = nodeStore.getNode('nonexistent')
      expect(notFound).toBeNull()
    })
  })

  describe('node hierarchy and ordering', () => {
    it('should determine correct tree order for message filtering', () => {
      const nodes: Node[] = [
        {
          id: 'book1',
          parentId: null,
          type: 'book',
          title: 'Book 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'arc1',
          parentId: 'book1',
          type: 'arc',
          title: 'Arc 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'arc2',
          parentId: 'book1',
          type: 'arc',
          title: 'Arc 2',
          order: 1,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ch1',
          parentId: 'arc1',
          type: 'chapter',
          title: 'Chapter 1',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ch2',
          parentId: 'arc1',
          type: 'chapter',
          title: 'Chapter 2',
          order: 1,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ch3',
          parentId: 'arc2',
          type: 'chapter',
          title: 'Chapter 3',
          order: 0,
          storyId: 'story1',
          expanded: true,
          isOpen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      nodeStore.setNodes(nodes)

      // Get flat list of nodes in tree order
      const flattenTree = (): string[] => {
        const result: string[] = []
        const traverse = (treeNode: TreeNode) => {
          result.push(treeNode.id)
          if (treeNode.children) {
            treeNode.children.forEach(traverse)
          }
        }
        nodeStore.tree.forEach(traverse)
        return result
      }

      const treeOrder = flattenTree()

      // Expected order: book1, arc1, ch1, ch2, arc2, ch3
      expect(treeOrder).toEqual(['book1', 'arc1', 'ch1', 'ch2', 'arc2', 'ch3'])
    })
  })
})
