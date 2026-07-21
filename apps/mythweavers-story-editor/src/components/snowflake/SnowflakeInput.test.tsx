import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Node } from '../../types/core'

const mocks = vi.hoisted(() => ({
  updateNode: vi.fn(),
  flushPendingSaves: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../stores/nodeStore', () => ({
  nodeStore: { updateNode: mocks.updateNode },
}))

vi.mock('../../services/saveService', () => ({
  saveService: { flushPendingSaves: mocks.flushPendingSaves },
}))

vi.mock('./Snowflake.css', () => ({ textarea: 'textarea' }))

import { SnowflakeInput } from './SnowflakeInput'

describe('SnowflakeInput', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.updateNode.mockClear()
    mocks.flushPendingSaves.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes the latest draft when navigating away before the debounce', () => {
    const node: Node = {
      id: 'scene-1',
      storyId: 'story-1',
      type: 'scene',
      title: 'Scene',
      summary: 'Old summary',
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const host = document.createElement('div')
    document.body.append(host)
    const dispose = render(() => <SnowflakeInput node={node} />, host)
    const textarea = host.querySelector('textarea')!

    textarea.value = 'Latest summary'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    dispose()
    host.remove()

    expect(mocks.updateNode).toHaveBeenCalledWith('scene-1', { summary: 'Latest summary' })
    expect(mocks.flushPendingSaves).toHaveBeenCalledTimes(1)
  })
})
