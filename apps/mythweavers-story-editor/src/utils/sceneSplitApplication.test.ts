import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  addNode: vi.fn(),
  deleteNode: vi.fn(),
  getNode: vi.fn(),
  messages: [] as unknown[],
  reorderMessages: vi.fn(),
  updateMessageNoSave: vi.fn(),
}))

vi.mock('../services/saveService', () => ({
  saveService: { reorderMessages: mocks.reorderMessages },
}))
vi.mock('../stores/currentStoryStore', () => ({
  currentStoryStore: { id: 'story-1' },
}))
vi.mock('../stores/messagesStore', () => ({
  messagesStore: {
    get messages() {
      return mocks.messages
    },
    updateMessageNoSave: mocks.updateMessageNoSave,
    appendMessage: vi.fn(),
    deleteMessage: vi.fn(),
  },
}))
vi.mock('../stores/nodeStore', () => ({
  nodeStore: {
    addNode: mocks.addNode,
    deleteNode: mocks.deleteNode,
    getNode: mocks.getNode,
  },
}))

import { applyProposedStructure } from './sceneSplitUtils'

const sourceScene = {
  id: 'scene-source',
  parentId: 'chapter-source',
  type: 'scene',
  title: 'Source scene',
}
const sourceChapter = {
  id: 'chapter-source',
  parentId: 'arc-1',
  type: 'chapter',
  title: 'Existing chapter',
}

const proposal = (chapters: number) => ({
  structure: Array.from({ length: chapters }, (_, index) => ({
    type: 'chapter' as const,
    title: `Proposed chapter ${index + 1}`,
    scenes: [
      {
        title: `Scene ${index + 1}`,
        messageAssignments: [{ mn: index + 1, sb: 'full' as const }],
      },
    ],
  })),
})

describe('applyProposedStructure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getNode.mockImplementation((id: string) => {
      if (id === sourceScene.id) return sourceScene
      if (id === sourceChapter.id) return sourceChapter
      return undefined
    })
    mocks.addNode.mockImplementation((parentId: string | null, type: string, title: string) => ({
      id: `${type}-${title}`,
      parentId,
      type,
      title,
    }))
    mocks.messages = [
      {
        id: 'message-1',
        sceneId: sourceScene.id,
        content: 'First message',
        order: 0,
        instruction: null,
      },
      {
        id: 'message-2',
        sceneId: sourceScene.id,
        content: 'Second message',
        order: 1,
        instruction: null,
      },
    ]
  })

  it('creates scenes under the existing chapter for a one-chapter proposal', async () => {
    await applyProposedStructure(sourceScene.id, {
      structure: [
        {
          type: 'chapter',
          title: 'Ignored proposed title',
          scenes: [
            { title: 'First scene', messageAssignments: [{ mn: 1, sb: 'full' }] },
            { title: 'Second scene', messageAssignments: [{ mn: 2, sb: 'full' }] },
          ],
        },
      ],
    })

    expect(mocks.addNode).not.toHaveBeenCalledWith('arc-1', 'chapter', expect.any(String))
    expect(mocks.addNode).toHaveBeenNthCalledWith(1, 'chapter-source', 'scene', 'First scene')
    expect(mocks.addNode).toHaveBeenNthCalledWith(2, 'chapter-source', 'scene', 'Second scene')
    expect(mocks.deleteNode).toHaveBeenCalledWith(sourceScene.id)
  })

  it('creates sibling chapters for a multi-chapter proposal', async () => {
    await applyProposedStructure(sourceScene.id, proposal(2))

    expect(mocks.addNode).toHaveBeenNthCalledWith(1, 'arc-1', 'chapter', 'Proposed chapter 1')
    expect(mocks.addNode).toHaveBeenNthCalledWith(3, 'arc-1', 'chapter', 'Proposed chapter 2')
  })
})
