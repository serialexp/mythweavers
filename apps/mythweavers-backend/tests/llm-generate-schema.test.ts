import { describe, expect, test } from 'bun:test'
import { generateBodySchema } from '../src/routes/my/llm.js'

const body = (content: string) => ({
  model: 'test-model',
  messages: [{ role: 'user' as const, content }],
})

describe('POST /my/llm/generate body validation', () => {
  // The endpoint used to cap message content at 200_000 characters, which is
  // the *token* context window of a Claude model — roughly 4x smaller in
  // characters, and 25x smaller than the 1M-token models. A single long chapter
  // tripped it before the request ever reached a provider. Context limits
  // belong to the upstream, which reports them itself.
  test('accepts message content far longer than the old 200k character cap', () => {
    const result = generateBodySchema.safeParse(body('x'.repeat(2_000_000)))
    expect(result.success).toBe(true)
  })

  test('still validates the rest of the message shape', () => {
    expect(generateBodySchema.safeParse(body('hello')).success).toBe(true)
    expect(generateBodySchema.safeParse({ model: 'test-model', messages: [] }).success).toBe(false)
    expect(
      generateBodySchema.safeParse({
        model: 'test-model',
        messages: [{ role: 'narrator', content: 'hello' }],
      }).success,
    ).toBe(false)
  })
})
