import type { Node } from '@writer/shared'
import { describe, expect, it } from 'vitest'
import {
  appendNode,
  findIndexesToNode,
  findNode,
  findParent,
  findPathToNodeIds,
  getItemsInOrder,
  moveNode,
  removeNode,
  setTree,
  treeState,
} from './tree'

describe('findPathToNodeIds', () => {
  it('should return the correct path to the node', () => {
    const defaultNodeProps: Node = {
      id: '',
      name: '',
      type: 'book',
      isOpen: false,
    }
    const tree: Node[] = [
      {
        ...defaultNodeProps,
        id: '1',
        children: [
          {
            ...defaultNodeProps,
            id: '2',
            children: [
              { ...defaultNodeProps, id: '3' },
              { ...defaultNodeProps, id: '4' },
            ],
          },
        ],
      },
      {
        ...defaultNodeProps,
        id: '5',
        children: [{ ...defaultNodeProps, id: '6' }],
      },
    ]

    setTree(tree)

    expect(findPathToNodeIds('3')).toEqual(['1', '2', '3'])
    expect(findPathToNodeIds('4')).toEqual(['1', '2', '4'])
    expect(findPathToNodeIds('6')).toEqual(['5', '6'])
    expect(findPathToNodeIds('7')).toEqual([]) // Node not in tree
  })
})

describe('findIndexesToNode', () => {
  it('should return the correct indexes path to the node', () => {
    const defaultNodeProps: Node = {
      id: '',
      name: '',
      type: 'book',
      isOpen: false,
    }
    const tree: Node[] = [
      {
        ...defaultNodeProps,
        id: '1',
        children: [
          {
            ...defaultNodeProps,
            id: '2',
            children: [
              { ...defaultNodeProps, id: '3' },
              { ...defaultNodeProps, id: '4' },
            ],
          },
        ],
      },
      {
        ...defaultNodeProps,
        id: '5',
        children: [{ ...defaultNodeProps, id: '6' }],
      },
    ]

    setTree(tree)

    expect(findIndexesToNode('3')).toEqual([0, 0, 0])
    expect(findIndexesToNode('4')).toEqual([0, 0, 1])
    expect(findIndexesToNode('6')).toEqual([1, 0])
    expect(findIndexesToNode('7')).toEqual([]) // Node not in tree
  })
})

describe('appendNode', () => {
  const defaultNodeProps: Node = {
    id: '',
    name: '',
    type: 'book',
    isOpen: false,
  }

  it('should append a node to the root of the tree', () => {
    const tree: Node[] = [
      { ...defaultNodeProps, id: '1' },
      { ...defaultNodeProps, id: '2' },
    ]

    setTree(tree)

    const newNode: Node = { ...defaultNodeProps, id: '3' }
    appendNode(newNode)

    expect(treeState.structure).toEqual([
      { ...defaultNodeProps, id: '1' },
      { ...defaultNodeProps, id: '2' },
      { ...defaultNodeProps, id: '3' },
    ])
  })

  it('should append a node as a child of a specific parent node', () => {
    const tree: Node[] = [
      {
        ...defaultNodeProps,
        id: '1',
        children: [{ ...defaultNodeProps, id: '2' }],
      },
    ]

    setTree(tree)

    const newNode: Node = { ...defaultNodeProps, id: '3' }
    appendNode(newNode, '1')

    expect(treeState.structure[0].children).toEqual([
      { ...defaultNodeProps, id: '2' },
      { ...defaultNodeProps, id: '3' },
    ])
  })

  it('should append a node after a specific sibling node', () => {
    const tree: Node[] = [
      {
        ...defaultNodeProps,
        id: '1',
        children: [
          { ...defaultNodeProps, id: '2' },
          { ...defaultNodeProps, id: '4' },
        ],
      },
    ]

    setTree(tree)

    const newNode: Node = { ...defaultNodeProps, id: '3' }
    appendNode(newNode, '1', '2')

    expect(treeState.structure[0].children).toEqual([
      { ...defaultNodeProps, id: '2' },
      { ...defaultNodeProps, id: '3' },
      { ...defaultNodeProps, id: '4' },
    ])
  })
})

describe('removeNode', () => {
  const defaultNodeProps: Node = {
    id: '',
    name: '',
    type: 'book',
    isOpen: false,
  }
  it('should remove a node from the tree', () => {
    const tree: Node[] = [
      { ...defaultNodeProps, id: '1' },
      { ...defaultNodeProps, id: '2' },
    ]

    setTree(tree)

    removeNode('1')

    expect(treeState.structure).toEqual([{ ...defaultNodeProps, id: '2' }])
  })
})

describe('findNode', () => {
  const defaultNodeProps: Node = {
    id: '',
    name: '',
    type: 'book',
    isOpen: false,
  }

  it('should find and return the correct node by id', () => {
    const tree: Node[] = [
      {
        ...defaultNodeProps,
        id: '1',
        children: [
          { ...defaultNodeProps, id: '2' },
          { ...defaultNodeProps, id: '3' },
        ],
      },
    ]

    setTree(tree)

    const node = findNode('2')
    expect(node).toEqual({ ...defaultNodeProps, id: '2' })
  })

  it('should return undefined if the node is not found', () => {
    const tree: Node[] = [{ ...defaultNodeProps, id: '1' }]

    setTree(tree)

    const node = findNode('3')
    expect(node).toBeUndefined()
  })
})

describe('moveNode', () => {
  const defaultNodeProps: Node = {
    id: '',
    name: '',
    type: 'book',
    isOpen: false,
  }

  it('should move a node to a new parent', () => {
    const tree: Node[] = [
      {
        ...defaultNodeProps,
        id: '1',
        children: [{ ...defaultNodeProps, id: '2' }],
      },
      {
        ...defaultNodeProps,
        id: '3',
        children: [],
      },
    ]

    setTree(tree)

    moveNode('2', '3')

    expect(treeState.structure[0].children).toEqual([])
    expect(treeState.structure[1].children).toEqual([{ ...defaultNodeProps, id: '2' }])
  })

  it('should move a node after a specific sibling', () => {
    const tree: Node[] = [
      {
        ...defaultNodeProps,
        id: '1',
        children: [
          { ...defaultNodeProps, id: '2' },
          { ...defaultNodeProps, id: '3' },
        ],
      },
    ]

    setTree(tree)

    moveNode('2', '1', '3')

    expect(treeState.structure[0].children).toEqual([
      { ...defaultNodeProps, id: '3' },
      { ...defaultNodeProps, id: '2' },
    ])
  })

  it('should do nothing if the node to move is not found', () => {
    const tree: Node[] = [{ ...defaultNodeProps, id: '1' }]

    setTree(tree)

    moveNode('2', '1')

    expect(treeState.structure).toEqual([{ ...defaultNodeProps, id: '1' }])
  })
})

describe('getItemsInOrder', () => {
  const defaultNodeProps: Node = {
    id: '',
    name: '',
    type: 'book',
    isOpen: false,
  }

  it('should return nodes of the specified type in order', () => {
    const tree: Node[] = [
      {
        ...defaultNodeProps,
        id: '1',
        type: 'book',
        children: [
          { ...defaultNodeProps, id: '2', type: 'chapter' },
          { ...defaultNodeProps, id: '3', type: 'book' },
        ],
      },
      {
        ...defaultNodeProps,
        id: '4',
        type: 'chapter',
        children: [
          { ...defaultNodeProps, id: '5', type: 'book' },
          { ...defaultNodeProps, id: '6', type: 'chapter' },
        ],
      },
    ]

    setTree(tree)

    const books = getItemsInOrder('book')
    expect(books.map((node) => node.id)).toEqual(['1', '3', '5'])

    const chapters = getItemsInOrder('chapter')
    expect(chapters.map((node) => node.id)).toEqual(['2', '4', '6'])
  })

  it('should return an empty array if no nodes of the specified type are found', () => {
    const tree: Node[] = [
      { ...defaultNodeProps, id: '1', type: 'book' },
      { ...defaultNodeProps, id: '2', type: 'book' },
    ]

    setTree(tree)

    const chapters = getItemsInOrder('chapter')
    expect(chapters).toEqual([])
  })
})

describe('findParent', () => {
  const defaultNodeProps: Node = {
    id: '',
    name: '',
    type: 'book',
    isOpen: false,
  }

  it('should return the parent node of a given node id', () => {
    const tree: Node[] = [
      {
        ...defaultNodeProps,
        id: '1',
        children: [
          {
            ...defaultNodeProps,
            id: '2',
            children: [
              { ...defaultNodeProps, id: '3' },
              { ...defaultNodeProps, id: '4' },
            ],
          },
        ],
      },
      {
        ...defaultNodeProps,
        id: '5',
        children: [{ ...defaultNodeProps, id: '6' }],
      },
    ]

    setTree(tree)

    expect(findParent('3')?.id).toBe('2')
    expect(findParent('4')?.id).toBe('2')
    expect(findParent('6')?.id).toBe('5')
  })

  it('should return undefined if the node is a root node', () => {
    const tree: Node[] = [
      { ...defaultNodeProps, id: '1' },
      { ...defaultNodeProps, id: '2' },
    ]

    setTree(tree)

    expect(findParent('1')).toBeUndefined()
    expect(findParent('2')).toBeUndefined()
  })

  it('should return undefined if the node is not found', () => {
    const tree: Node[] = [
      { ...defaultNodeProps, id: '1' },
      { ...defaultNodeProps, id: '2' },
    ]

    setTree(tree)

    expect(findParent('3')).toBeUndefined()
  })
})
