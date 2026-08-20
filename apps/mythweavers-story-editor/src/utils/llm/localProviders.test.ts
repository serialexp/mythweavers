import { afterEach, describe, expect, it, vi } from 'vitest'
import { probeLlamaCpp, probeOllama } from './localProviders'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('local provider probes', () => {
  it('recognizes an Ollama version response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ version: '0.11.0' })))

    await expect(probeOllama()).resolves.toMatchObject({ provider: 'ollama', status: 'reachable' })
  })

  it('rejects a non-Ollama JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'ok' })))

    await expect(probeOllama()).resolves.toMatchObject({ provider: 'ollama', status: 'unreachable' })
  })

  it('requires both the llama.cpp server header and health response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ status: 'ok' }, { headers: { Server: 'llama.cpp' } })),
    )

    await expect(probeLlamaCpp()).resolves.toMatchObject({ provider: 'llamacpp', status: 'reachable' })
  })

  it('does not mistake an unrelated healthy service for llama.cpp', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'ok' }, { headers: { Server: 'nginx' } })))

    await expect(probeLlamaCpp()).resolves.toMatchObject({ provider: 'llamacpp', status: 'unreachable' })
  })

  it('reports network failures as unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(probeOllama()).resolves.toMatchObject({ status: 'unreachable' })
    await expect(probeLlamaCpp()).resolves.toMatchObject({ status: 'unreachable' })
  })
})
