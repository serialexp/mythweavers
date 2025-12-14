import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('../utils/apiClient', () => ({
  apiClient: {
    createNode: vi.fn(),
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
    updateNodesBulk: vi.fn(),
    insertMessage: vi.fn(),
    updateMessage: vi.fn(),
    deleteMessage: vi.fn(),
    reorderMessages: vi.fn(),
    updateChapter: vi.fn(),
    deleteChapter: vi.fn(),
    updateCharacter: vi.fn(),
    deleteCharacter: vi.fn(),
    updateContextItem: vi.fn(),
    deleteContextItem: vi.fn(),
    createMap: vi.fn(),
    updateMap: vi.fn(),
    deleteMap: vi.fn(),
    setLandmarkState: vi.fn(),
    updateStorySettings: vi.fn(),
    fetch: vi.fn(),
  },
}))

vi.mock('../stores/currentStoryStore', () => ({
  currentStoryStore: {
    storageMode: 'server',
    isInitialized: true,
    id: 'story-1',
    setLastKnownUpdatedAt: vi.fn(),
    updateAutoSaveTime: vi.fn(),
  },
}))

import { SaveService } from './saveService'

describe('SaveService queue merge behaviour', () => {
  let service: SaveService
  let processSpy: ReturnType<typeof vi.spyOn>

  const getQueue = () => ((service as unknown as { state: { queue: any[] } }).state.queue)

  beforeEach(() => {
    service = new SaveService()
    processSpy = vi.spyOn(service as any, 'processQueue').mockResolvedValue(undefined)
  })

  afterEach(() => {
    processSpy.mockRestore()
  })

  it('merges node updates into a pending node insert', async () => {
    const initialData = { id: 'node-1', title: 'Initial Title', status: 'draft' }

    await service.queueSave({
      type: 'node-insert',
      entityType: 'node',
      entityId: initialData.id,
      storyId: 'story-1',
      data: initialData,
    })

    await service.queueSave({
      type: 'node-update',
      entityType: 'node',
      entityId: initialData.id,
      storyId: 'story-1',
      data: { title: 'Updated Title' },
    })

    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].type).toBe('node-insert')
    expect(queue[0].data).toMatchObject({
      title: 'Updated Title',
      status: 'draft',
    })
  })

  it('collapses consecutive node updates into a single payload', async () => {
    await service.queueSave({
      type: 'node-update',
      entityType: 'node',
      entityId: 'node-2',
      storyId: 'story-1',
      data: { title: 'First Update' },
    })

    await service.queueSave({
      type: 'node-update',
      entityType: 'node',
      entityId: 'node-2',
      storyId: 'story-1',
      data: { status: 'done' },
    })

    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].type).toBe('node-update')
    expect(queue[0].data).toMatchObject({
      title: 'First Update',
      status: 'done',
    })
  })

  it('drops a pending insert if a delete arrives before processing', async () => {
    await service.queueSave({
      type: 'node-insert',
      entityType: 'node',
      entityId: 'node-3',
      storyId: 'story-1',
      data: { id: 'node-3' },
    })

    await service.queueSave({
      type: 'node-delete',
      entityType: 'node',
      entityId: 'node-3',
      storyId: 'story-1',
    })

    const queue = getQueue()
    expect(queue).toHaveLength(0)
  })

  it('keeps the queued delete when additional updates arrive', async () => {
    await service.queueSave({
      type: 'node-delete',
      entityType: 'node',
      entityId: 'node-4',
      storyId: 'story-1',
    })

    await service.queueSave({
      type: 'node-update',
      entityType: 'node',
      entityId: 'node-4',
      storyId: 'story-1',
      data: { title: 'Should be ignored' },
    })

    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].type).toBe('node-delete')
    expect(queue[0].data).toBeUndefined()
  })

  it('replaces a pending update with a delete', async () => {
    await service.queueSave({
      type: 'node-update',
      entityType: 'node',
      entityId: 'node-5',
      storyId: 'story-1',
      data: { title: 'Stale update' },
    })

    await service.queueSave({
      type: 'node-delete',
      entityType: 'node',
      entityId: 'node-5',
      storyId: 'story-1',
    })

    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].type).toBe('node-delete')
  })
})
