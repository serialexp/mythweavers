import { describe, expect, it } from 'vitest'
import { client } from '../api-client/client.gen'
import './config'

describe('API client configuration', () => {
  it('throws for non-successful responses', () => {
    expect(client.getConfig().throwOnError).toBe(true)
  })

  it('preserves the HTTP status when rejecting a request', async () => {
    const request = client.get({
      url: '/test-error',
      fetch: async () => new Response(JSON.stringify({ error: 'Nope' }), { status: 503 }),
    })

    await expect(request).rejects.toMatchObject({
      message: 'Nope',
      status: 503,
    })
  })
})
