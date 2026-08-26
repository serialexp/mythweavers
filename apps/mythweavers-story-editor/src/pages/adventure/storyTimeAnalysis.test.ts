import type { LLMClient, LLMGenerateOptions, LLMModel, LLMStreamEvent } from '@mythweavers/llm'
import { describe, expect, it } from 'vitest'
import { analyzeStoryTime, buildStoryTimeMessages } from './storyTimeAnalysis'

class FakeClient implements LLMClient {
  requests: LLMGenerateOptions[] = []
  constructor(private responses: Array<LLMStreamEvent[] | Error>) {}
  async list(): Promise<{ models: LLMModel[] }> {
    return { models: [] }
  }
  async *generate(options: LLMGenerateOptions): AsyncGenerator<LLMStreamEvent> {
    this.requests.push(options)
    const response = this.responses[this.requests.length - 1]
    if (response instanceof Error) throw response
    for (const event of response ?? []) yield event
  }
}

const base = {
  generateOptions: { model: 'analysis-model' },
  worldBible: 'A city governed by bells.',
  targetTurn: { playerAction: 'I cross the plaza.', narrative: 'You cross under the noon bell.' },
}

describe('story time prompt', () => {
  it('requires initialization when no prior time exists', () => {
    expect(buildStoryTimeMessages(base)[2].content).toContain('No current story time has been established')
  })

  it('uses the shared cache prefix, then only prior time and the new section', () => {
    const messages = buildStoryTimeMessages({ ...base, previousCurrentTime: 'Second Bell' })
    expect(messages[0].content).toContain('[WORLD BIBLE')
    expect(messages[0].content).toContain('A city governed by bells.')
    expect(messages[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
    expect(messages[2].content).toContain('Second Bell')
    expect(messages[2].content).toContain('You cross under the noon bell.')
    expect(messages[2].content).not.toContain('SETTING:')
  })

  it('asks for specific setting-appropriate calendar detail when applicable', () => {
    const instruction = buildStoryTimeMessages(base)[1].content
    expect(instruction).toContain('Always return a concrete, complete timestamp')
    expect(instruction).toContain('day, month or season, and year or era')
    expect(instruction).toContain('invent a plausible value')
  })

  it('instructs the model to enrich an underspecified previous time', () => {
    const instruction = buildStoryTimeMessages({
      ...base,
      previousCurrentTime: "Around nine o'clock on a snowy winter evening",
    })[1].content
    expect(instruction).toContain('only as a continuity anchor, not as a complete template')
    expect(instruction).toContain('For every missing component, invent a plausible value now')
    expect(instruction).toContain('when there is no clue, freely choose an arbitrary plausible value')
    expect(instruction).toContain('never perpetuate an underspecified value')
  })
})

describe('analyzeStoryTime', () => {
  it('uses the required report tool', async () => {
    const client = new FakeClient([
      [
        {
          type: 'tool_call',
          id: '1',
          name: 'report_story_time',
          arguments: { current_time: 'Noon', duration_amount: 4, duration_unit: 'minutes' },
        },
      ],
    ])
    await expect(analyzeStoryTime({ ...base, client })).resolves.toMatchObject({ currentTime: 'Noon' })
    expect(client.requests[0].tool_choice).toBe('auto')
  })

  it('falls back to JSON when tools throw as unsupported', async () => {
    const client = new FakeClient([
      new Error('Tool calls are not yet supported by this provider.'),
      [{ type: 'chunk', text: '{"current_time":"Dusk","duration_amount":1,"duration_unit":"hours"}' }],
    ])
    await expect(analyzeStoryTime({ ...base, client })).resolves.toMatchObject({ currentTime: 'Dusk' })
    expect(client.requests[1].tools).toBeUndefined()
  })

  it('does not retry ordinary provider errors as JSON', async () => {
    const client = new FakeClient([[{ type: 'error', error: 'Provider quota exceeded.' }]])
    await expect(analyzeStoryTime({ ...base, client })).rejects.toThrow('Provider quota exceeded')
    expect(client.requests).toHaveLength(1)
  })

  it('falls back when a provider emits prose instead of the required tool', async () => {
    const client = new FakeClient([
      [{ type: 'chunk', text: 'I cannot call that tool.' }],
      [
        {
          type: 'chunk',
          text: '```json\n{"current_time":"Night","duration_amount":30,"duration_unit":"minutes"}\n```',
        },
      ],
    ])
    await expect(analyzeStoryTime({ ...base, client })).resolves.toMatchObject({ currentTime: 'Night' })
  })

  it('propagates aborts', async () => {
    const client = new FakeClient([new DOMException('cancelled', 'AbortError')])
    await expect(analyzeStoryTime({ ...base, client })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
