import { describe, expect, it } from 'vitest'
import type { Message, Node } from '../types/core'
import { calculateActivePath } from './nodeTraversal'

const now = new Date('2024-01-01')

const book: Node = {
  id: 'book',
  storyId: 's',
  type: 'book',
  title: 'Book',
  order: 0,
  createdAt: now,
  updatedAt: now,
}

const scene = (n: number, order: number): Node => ({
  id: `scene-${n}`,
  storyId: 's',
  parentId: 'book',
  type: 'scene',
  title: `Scene ${n}`,
  order,
  createdAt: now,
  updatedAt: now,
})

const msg = (id: string, sceneId: string, order: number, extra: Partial<Message> = {}): Message => ({
  id,
  role: 'assistant',
  content: 'content',
  timestamp: now,
  order,
  isQuery: false,
  sceneId,
  ...extra,
})

const branchMsg = (id: string, sceneId: string, order: number): Message =>
  msg(id, sceneId, order, {
    type: 'branch',
    options: [{ id: 'opt', label: 'Option', targetNodeId: 'scene-1', targetMessageId: 'm1' }],
  })

describe('calculateActivePath', () => {
  // The engine only activates when there are branch choices; a stale/unrelated
  // entry is enough to switch it on without affecting the linear scenes.
  const activatingChoice = { 'unrelated-branch': 'whatever' }

  describe('boundary node (untilNodeId)', () => {
    it('stops once the boundary node is fully walked, trimming downstream nodes', () => {
      // Linear scenes 1..4; boundary = scene-3. Scene-4 should be excluded.
      const nodes = [book, scene(1, 0), scene(2, 1), scene(3, 2), scene(4, 3)]
      const messages = [msg('m1', 'scene-1', 0), msg('m2', 'scene-2', 1), msg('m3', 'scene-3', 2), msg('m4', 'scene-4', 3)]

      const { activeNodeIds } = calculateActivePath(messages, nodes, activatingChoice, 'scene-3')

      expect([...activeNodeIds].sort()).toEqual(['scene-1', 'scene-2', 'scene-3'])
    })

    it('does NOT let a downstream unselected branch truncate the active path (the reported bug)', () => {
      // Scenes 1..3 are the marked history + current; scene-4 holds an unselected
      // branch. Sitting on scene-3, the branch in scene-4 must not strip scenes 1-3.
      const nodes = [book, scene(1, 0), scene(2, 1), scene(3, 2), scene(4, 3)]
      const messages = [
        msg('m1', 'scene-1', 0),
        msg('m2', 'scene-2', 1),
        msg('m3', 'scene-3', 2),
        branchMsg('mbr', 'scene-4', 3),
      ]

      const { activeNodeIds } = calculateActivePath(messages, nodes, activatingChoice, 'scene-3')

      for (const id of ['scene-1', 'scene-2', 'scene-3']) {
        expect(activeNodeIds.has(id)).toBe(true)
      }
    })

    it('skips an unselected branch that sorts BEFORE the boundary and still reaches the current node', () => {
      // The ordering anomaly: an unselected branch (scene-2) sits before the
      // current node (scene-3) in story order even though it is not on the path
      // to it. The bounded walk must skip it and still include the current node.
      const nodes = [book, scene(1, 0), scene(2, 1), scene(3, 2)]
      const messages = [msg('m1', 'scene-1', 0), branchMsg('mbr', 'scene-2', 1), msg('m3', 'scene-3', 2)]

      const { activeNodeIds } = calculateActivePath(messages, nodes, activatingChoice, 'scene-3')

      expect(activeNodeIds.has('scene-1')).toBe(true)
      expect(activeNodeIds.has('scene-3')).toBe(true)
    })
  })

  describe('preview mode (no boundary)', () => {
    it('still ends the forward reading path at an unselected branch', () => {
      // Without a boundary the strict semantics hold: scene-2's unselected branch
      // ends the path, so scene-3 is never reached.
      const nodes = [book, scene(1, 0), scene(2, 1), scene(3, 2)]
      const messages = [msg('m1', 'scene-1', 0), branchMsg('mbr', 'scene-2', 1), msg('m3', 'scene-3', 2)]

      const { activeNodeIds } = calculateActivePath(messages, nodes, activatingChoice)

      expect(activeNodeIds.has('scene-1')).toBe(true)
      expect(activeNodeIds.has('scene-3')).toBe(false)
    })
  })
})
