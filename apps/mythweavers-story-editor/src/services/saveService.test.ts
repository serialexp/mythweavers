import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

  const getQueue = () => (service as unknown as { state: { queue: any[] } }).state.queue

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

  it('carries a replaced map image into a create that has not flushed yet', async () => {
    // Opening map settings straight after adding a map is an ordinary thing to
    // do, and it collapses into a single create. If the merge dropped fileId the
    // map would be created pointing at the image the user just replaced.
    await service.queueSave({
      type: 'map-insert',
      entityType: 'map',
      entityId: 'map-1',
      storyId: 'story-1',
      data: { id: 'map-1', name: 'Outer Rim', fileId: 'file-original', imageData: '' },
    })

    await service.queueSave({
      type: 'map-update',
      entityType: 'map',
      entityId: 'map-1',
      storyId: 'story-1',
      data: { id: 'map-1', name: 'Outer Rim', fileId: 'file-replacement', imageData: '' },
    })

    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].type).toBe('map-insert')
    expect(queue[0].data.fileId).toBe('file-replacement')
  })

  it('keeps a cleared map image cleared when it merges into a create', async () => {
    // null is a real value here -- "this map has no picture" -- and must not be
    // treated as "nothing to say about the picture".
    await service.queueSave({
      type: 'map-insert',
      entityType: 'map',
      entityId: 'map-2',
      storyId: 'story-1',
      data: { id: 'map-2', name: 'Core Worlds', fileId: 'file-original', imageData: '' },
    })

    await service.queueSave({
      type: 'map-update',
      entityType: 'map',
      entityId: 'map-2',
      storyId: 'story-1',
      data: { id: 'map-2', name: 'Core Worlds', fileId: null, imageData: '' },
    })

    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].data.fileId).toBeNull()
  })
})

describe('SaveService failure reporting', () => {
  it('reports a non-retryable HTTP error to the UI', async () => {
    const service = new SaveService()
    const onError = vi.fn()
    const onOperationFailed = vi.fn()
    service.setCallbacks({ onError, onOperationFailed, getStorageMode: () => 'server' })
    const error = Object.assign(new Error('Validation failed'), { status: 422 })
    vi.spyOn(service as any, 'executeSaveOperation').mockRejectedValue(error)

    await service.queueSave({
      type: 'node-update',
      entityType: 'node',
      entityId: 'node-1',
      storyId: 'story-1',
      data: { id: 'node-1', type: 'scene', title: 'Scene' },
    })

    expect(onError).toHaveBeenCalledWith(error)
    expect(onOperationFailed).toHaveBeenCalledTimes(1)
  })

  it('does not roll back an optimistic update when a retry succeeds', async () => {
    const service = new SaveService()
    const onError = vi.fn()
    const onOperationFailed = vi.fn()
    service.setCallbacks({ onError, onOperationFailed, getStorageMode: () => 'server' })
    const error = Object.assign(new Error('Service unavailable'), { status: 503 })
    const execute = vi
      .spyOn(service as any, 'executeSaveOperation')
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(undefined)

    await service.queueSave({
      type: 'landmark-insert',
      entityType: 'landmark',
      entityId: 'landmark-1',
      storyId: 'story-1',
      data: { id: 'landmark-1', mapId: 'map-1', x: 1, y: 2, name: 'Port', type: 'city' },
    })

    expect(execute).toHaveBeenCalledTimes(2)
    expect(onOperationFailed).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('waits for a local full-story save to complete', async () => {
    const service = new SaveService()
    service.setCallbacks({ getStorageMode: () => 'local' })
    let finishSave!: () => void
    const fullSave = new Promise<void>((resolve) => {
      finishSave = resolve
    })
    const triggerFullSave = vi.fn(() => fullSave)
    service.setTriggerFullSave(triggerFullSave)

    let didResolve = false
    const queued = service
      .queueSave({
        type: 'node-update',
        entityType: 'node',
        entityId: 'node-1',
        storyId: 'story-1',
        data: { title: 'Updated title' },
      })
      .then(() => {
        didResolve = true
      })

    await Promise.resolve()
    expect(triggerFullSave).toHaveBeenCalledTimes(1)
    expect(didResolve).toBe(false)

    finishSave()
    await queued
    expect(didResolve).toBe(true)
  })
})
