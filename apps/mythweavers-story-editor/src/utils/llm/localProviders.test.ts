import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  LOCAL_PROVIDER_ENDPOINTS,
  getLocalProviderCandidates,
  probeLlamaCpp,
  probeLocalProviders,
  probeOllama,
} from './localProviders'

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

  it('recognizes a healthy llama.cpp response without relying on CORS-hidden headers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'ok' })))

    await expect(probeLlamaCpp()).resolves.toMatchObject({ provider: 'llamacpp', status: 'reachable' })
  })

  it('rejects an unexpected health response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'loading model' })))

    await expect(probeLlamaCpp()).resolves.toMatchObject({ provider: 'llamacpp', status: 'unreachable' })
  })

  it('tries the web service origin over HTTPS before loopback for both local providers', () => {
    expect(getLocalProviderCandidates('write.mythweavers.home.serial-experiments.com', 'https:')).toEqual({
      ollama: [
        'https://write.mythweavers.home.serial-experiments.com:11434',
        'http://127.0.0.1:11434',
      ],
      llamacpp: [
        'https://write.mythweavers.home.serial-experiments.com:12434',
        'http://127.0.0.1:12434',
      ],
    })
  })

  it('does not duplicate loopback when the web service runs there', () => {
    expect(getLocalProviderCandidates('127.0.0.1')).toEqual({
      ollama: ['http://127.0.0.1:11434'],
      llamacpp: ['http://127.0.0.1:12434'],
    })
  })

  it('probes llama.cpp only on its configured port', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/version')) return Promise.resolve(Response.json({ version: '0.11.0' }))
      return Promise.resolve(Response.json({ status: 'ok' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    await probeLocalProviders()

    const probedUrls = fetchMock.mock.calls.map(([input]) => String(input))
    expect(probedUrls).toContain(`${LOCAL_PROVIDER_ENDPOINTS.llamacpp}/health`)
    expect(probedUrls.some((url) => new URL(url).port === '8080')).toBe(false)
  })

  it('reports network failures as unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(probeOllama()).resolves.toMatchObject({ status: 'unreachable' })
    await expect(probeLlamaCpp()).resolves.toMatchObject({ status: 'unreachable' })
  })
})
