import { describe, expect, it } from 'vitest'
import type { LLMClient, LLMGenerateOptions, LLMStreamEvent } from '../../types/llm'
import { generateReplacementRewrite } from './replacementRewriter'

function clientFor(...responses: LLMStreamEvent[][]): LLMClient {
  let requestIndex = 0
  return {
    async list() {
      return { models: [] }
    },
    async *generate(_options: LLMGenerateOptions): AsyncGenerator<LLMStreamEvent> {
      yield* responses[requestIndex++] ?? []
    },
  }
}

function replacement(find: string, replace: string, replaceAll = false): LLMStreamEvent {
  return {
    type: 'tool_call',
    id: 'call-1',
    name: 'replace_text',
    arguments: { messageId: 'message-1', find, replace, replaceAll },
  }
}

describe('generateReplacementRewrite', () => {
  it('builds a rewrite preview from validated replacement tool calls', async () => {
    const result = await generateReplacementRewrite({
      client: clientFor([replacement('Mara', 'Nora', true)]),
      model: 'test-model',
      messages: [{ id: 'message-1', content: 'Mara ran. Mara stopped.' }],
      instruction: 'Rename Mara.',
      metadata: { callType: 'test' },
    })

    expect(result.failures).toEqual([])
    expect(result.messages.get('message-1')).toBe('Nora ran. Nora stopped.')
    expect(result.appliedCount).toBe(2)
  })

  it('retries an ambiguous replacement with feedback and applies a contextual repair', async () => {
    const requests: LLMGenerateOptions[] = []
    const client = clientFor([replacement('Mara', 'Nora')], [replacement('Mara ran', 'Nora ran')])
    const recordingClient: LLMClient = {
      list: () => client.list(),
      async *generate(options) {
        requests.push(options)
        yield* client.generate(options)
      },
    }

    const result = await generateReplacementRewrite({
      client: recordingClient,
      model: 'test-model',
      messages: [{ id: 'message-1', content: 'Mara ran. Mara stopped.' }],
      instruction: 'Rename only the runner.',
      metadata: { callType: 'test' },
    })

    expect(result.failures).toEqual([])
    expect(result.messages.get('message-1')).toBe('Nora ran. Mara stopped.')
    expect(requests).toHaveLength(2)
    expect(requests[1].messages[0]).toEqual(requests[0].messages[0])
    expect(requests[1].messages[requests[1].messages.length - 1]?.content).toContain('appears 2 times')
  })

  it('keeps valid replacements and exposes failures after three invalid attempts', async () => {
    const result = await generateReplacementRewrite({
      client: clientFor(
        [replacement('Original', 'Edited'), replacement('Absent', 'Present')],
        [replacement('Original', 'Edited'), replacement('Absent', 'Present')],
        [replacement('Original', 'Edited'), replacement('Absent', 'Present')],
      ),
      model: 'test-model',
      messages: [{ id: 'message-1', content: 'Original text.' }],
      instruction: 'Change it.',
      metadata: { callType: 'test' },
    })

    expect(result.messages.get('message-1')).toBe('Edited text.')
    expect(result.failures.join('\n')).toContain('after 3 attempts')
    expect(result.failures.join('\n')).toContain('not found')
  })
})
