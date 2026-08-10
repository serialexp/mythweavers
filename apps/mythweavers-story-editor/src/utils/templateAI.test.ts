import type { LLMStreamEvent } from '@mythweavers/llm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateMock = vi.fn()

vi.mock('./llm/LLMClientFactory', () => ({
  LLMClientFactory: {
    getClient: () => ({ generate: generateMock }),
  },
}))

vi.mock('../stores/settingsStore', () => ({
  settingsStore: {
    provider: 'anthropic',
    model: 'claude-test',
  },
}))

import { generateTemplateChange } from './templateAI'

/** Turn a fixed list of events into the async generator the client returns. */
const streamOf = (events: LLMStreamEvent[]) =>
  async function* () {
    for (const event of events) yield event
  }

describe('generateTemplateChange', () => {
  beforeEach(() => {
    generateMock.mockReset()
  })

  it('returns the concatenated chunks', async () => {
    generateMock.mockImplementation(
      streamOf([{ type: 'chunk', text: 'A brooding ' }, { type: 'chunk', text: 'smuggler.' }, { type: 'done' }]),
    )

    await expect(generateTemplateChange('A smuggler.', {}, 'make him brooding')).resolves.toBe('A brooding smuggler.')
  })

  // Regression: the stream reports failures as events rather than throwing. These
  // used to be swallowed, so the call resolved to '' and the caller wrote that
  // empty string straight over the description the user was editing.
  it('throws when the stream reports an error instead of resolving empty', async () => {
    generateMock.mockImplementation(streamOf([{ type: 'error', error: 'Insufficient credit' }, { type: 'done' }]))

    await expect(generateTemplateChange('A smuggler.', {}, 'make him brooding')).rejects.toThrow('Insufficient credit')
  })

  it('throws when the model produces no text at all', async () => {
    generateMock.mockImplementation(streamOf([{ type: 'done' }]))

    await expect(generateTemplateChange('A smuggler.', {}, 'make him brooding')).rejects.toThrow(/empty response/i)
  })

  it('only sends story content when it is provided', async () => {
    generateMock.mockImplementation(streamOf([{ type: 'chunk', text: 'ok' }, { type: 'done' }]))

    await generateTemplateChange('A smuggler.', {}, 'tweak it')
    const withoutContext = generateMock.mock.calls[0][0].messages
    expect(withoutContext).toHaveLength(1)
    expect(withoutContext[0].role).toBe('user')

    generateMock.mockClear()
    generateMock.mockImplementation(streamOf([{ type: 'chunk', text: 'ok' }, { type: 'done' }]))

    await generateTemplateChange('A smuggler.', {}, 'tweak it', '## Scene One\n\nHe ran.', {
      entityLabel: 'Context Item',
    })
    const withContext = generateMock.mock.calls[0][0].messages
    expect(withContext).toHaveLength(4)
    expect(withContext[1].content).toContain('## Scene One')
    // The cached prefix (system + story) must stay identical across entity
    // types; only the trailing, uncached task message carries the label.
    expect(withContext[1].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
    expect(withContext[3].content).toContain('Update Context Item Template')
    expect(withContext[3].cache_control).toBeUndefined()
  })
})
