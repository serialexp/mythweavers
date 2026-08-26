import type { LLMClient, LLMGenerateOptions, LLMModel, LLMStreamEvent } from '@mythweavers/llm'
import { describe, expect, it } from 'vitest'
import type { AdventureTurn } from '../../hooks/useAdventurePersistence'
import { runWriterToolLoop } from './writerToolLoop'

class FakeClient implements LLMClient {
  readonly requests: LLMGenerateOptions[] = []

  constructor(private readonly responses: LLMStreamEvent[][]) {}

  async list(): Promise<{ models: LLMModel[] }> {
    return { models: [] }
  }

  async *generate(options: LLMGenerateOptions): AsyncGenerator<LLMStreamEvent> {
    this.requests.push(options)
    const response = this.responses[this.requests.length - 1]
    if (!response) throw new Error('Unexpected generation')
    for (const event of response) yield event
  }
}

const turns: AdventureTurn[] = Array.from({ length: 40 }, (_, index) => ({
  playerAction: `Action ${index + 1}`,
  narrative: index === 4 ? 'The password is “winter glass.”' : `Narrative ${index + 1}`,
}))

const baseOptions = {
  generateOptions: { model: 'test-model', metadata: { callType: 'adventure' } },
  messages: [{ role: 'user' as const, content: 'Use the old password.' }],
  turns,
  compactions: { '0-9': { summary: 'Old events.', generatedAt: '2026-01-01' } },
}

const toolCall = (query = 'password'): LLMStreamEvent => ({
  type: 'tool_call',
  id: 'call-1',
  name: 'search_earlier_conversation',
  arguments: { mode: 'ranked', query },
})

describe('runWriterToolLoop', () => {
  it('skips tools when no compacted source paragraphs are searchable', async () => {
    const client = new FakeClient([[{ type: 'chunk', text: 'Opening prose.' }]])

    await runWriterToolLoop({
      ...baseOptions,
      compactions: undefined,
      client,
      onText: () => undefined,
      onResetText: () => undefined,
    })

    expect(client.requests[0].tools).toBeUndefined()
  })

  it('returns a normal response after one generation', async () => {
    const client = new FakeClient([[{ type: 'chunk', text: 'Final prose.' }, { type: 'done' }]])
    const displayed: string[] = []

    const result = await runWriterToolLoop({
      ...baseOptions,
      client,
      onText: (text) => displayed.push(text),
      onResetText: () => displayed.push('RESET'),
    })

    expect(result.raw).toBe('Final prose.')
    expect(client.requests).toHaveLength(1)
    expect(client.requests[0].tools).toHaveLength(1)
    expect(displayed).toEqual(['Final prose.'])
  })

  it('executes all tool calls, discards provisional prose, and reruns with results', async () => {
    const client = new FakeClient([
      [{ type: 'chunk', text: 'Let me look.' }, toolCall(), toolCall('winter glass'), { type: 'done' }],
      [{ type: 'chunk', text: 'She repeats “winter glass.”' }, { type: 'done' }],
    ])
    const displayed: string[] = []
    const searchCounts: number[] = []

    const result = await runWriterToolLoop({
      ...baseOptions,
      client,
      onText: (text) => displayed.push(text),
      onResetText: () => displayed.push('RESET'),
      onSearchCount: (count) => searchCounts.push(count),
    })

    expect(result.raw).toBe('She repeats “winter glass.”')
    expect(result.searchCount).toBe(2)
    expect(searchCounts).toEqual([2])
    expect(client.requests).toHaveLength(2)
    const resultMessage = client.requests[1].messages[client.requests[1].messages.length - 1]
    expect(resultMessage.content).toContain('VERBATIM EARLIER-CONVERSATION')
    expect(resultMessage.content).toContain('The password is “winter glass.”')
    expect(displayed).toEqual(['Let me look.', 'RESET', 'She repeats “winter glass.”'])
  })

  it('allows two search rounds and disables tools for the final generation', async () => {
    const client = new FakeClient([
      [toolCall('password'), { type: 'done' }],
      [toolCall('winter'), { type: 'done' }],
      [{ type: 'chunk', text: 'Final.' }, { type: 'done' }],
    ])
    let resetCount = 0
    const searchCounts: number[] = []

    const result = await runWriterToolLoop({
      ...baseOptions,
      client,
      onText: () => undefined,
      onResetText: () => resetCount++,
      onSearchCount: (count) => searchCounts.push(count),
    })

    expect(result.raw).toBe('Final.')
    expect(result.searchCount).toBe(2)
    expect(searchCounts).toEqual([1, 2])
    expect(client.requests).toHaveLength(3)
    expect(client.requests[0].tools).toHaveLength(1)
    expect(client.requests[1].tools).toHaveLength(1)
    expect(client.requests[2].tools).toBeUndefined()
    const finalContext = client.requests[2].messages[client.requests[2].messages.length - 1]
    expect(finalContext.content).toContain('Search 2')
    expect(resetCount).toBe(2)
  })

  it('feeds invalid search arguments back to the model', async () => {
    const client = new FakeClient([
      [
        {
          type: 'tool_call',
          id: 'bad',
          name: 'search_earlier_conversation',
          arguments: { mode: 'regex', query: '(x+x+)+y' },
        },
      ],
      [{ type: 'chunk', text: 'Recovered prose.' }],
    ])

    await runWriterToolLoop({
      ...baseOptions,
      client,
      onText: () => undefined,
      onResetText: () => undefined,
    })

    const errorContext = client.requests[1].messages[client.requests[1].messages.length - 1]
    expect(errorContext.content).toContain('potentially unsafe')
  })

  it.each([
    'Tool calls are not yet supported by this provider.',
    'The selected model does not support tools.',
    'Tools are unsupported by this endpoint.',
  ])('retries without tools when the provider emits: %s', async (error) => {
    const client = new FakeClient([[{ type: 'error', error }], [{ type: 'chunk', text: 'Fallback prose.' }]])

    const result = await runWriterToolLoop({
      ...baseOptions,
      client,
      onText: () => undefined,
      onResetText: () => undefined,
    })

    expect(result).toEqual({ raw: 'Fallback prose.', streamErrors: [], searchCount: 0 })
    expect(client.requests[0].tools).toHaveLength(1)
    expect(client.requests[1].tools).toBeUndefined()
  })

  it('retries without tools when the provider throws a tool-support error', async () => {
    const requests: LLMGenerateOptions[] = []
    const client: LLMClient = {
      list: async () => ({ models: [] }),
      async *generate(options) {
        requests.push(options)
        if (options.tools) throw new Error('Tool calls are not yet supported by the Cloudflare client.')
        yield { type: 'chunk', text: 'Fallback prose.' }
      },
    }

    const result = await runWriterToolLoop({
      ...baseOptions,
      client,
      onText: () => undefined,
      onResetText: () => undefined,
    })

    expect(result.raw).toBe('Fallback prose.')
    expect(requests).toHaveLength(2)
    expect(requests[1].tools).toBeUndefined()
  })

  it('accumulates stream errors across reruns', async () => {
    const client = new FakeClient([
      [{ type: 'error', error: 'provisional warning' }, toolCall()],
      [{ type: 'error', error: 'final failure' }],
    ])

    const result = await runWriterToolLoop({
      ...baseOptions,
      client,
      onText: () => undefined,
      onResetText: () => undefined,
    })

    expect(result.streamErrors).toEqual(['provisional warning', 'final failure'])
  })

  it('propagates aborts', async () => {
    const abortingClient: LLMClient = {
      list: async () => ({ models: [] }),
      async *generate() {
        if (false) yield { type: 'done' as const }
        throw new DOMException('cancelled', 'AbortError')
      },
    }

    await expect(
      runWriterToolLoop({
        ...baseOptions,
        client: abortingClient,
        onText: () => undefined,
        onResetText: () => undefined,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
