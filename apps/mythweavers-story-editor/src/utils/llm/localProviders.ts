export type LocalProvider = 'ollama' | 'llamacpp'
export type LocalProviderStatus = 'checking' | 'reachable' | 'unreachable'

export interface LocalProviderProbeResult {
  provider: LocalProvider
  status: Exclude<LocalProviderStatus, 'checking'>
  endpoint: string
}

export const LOCAL_PROVIDER_ENDPOINTS: Record<LocalProvider, string> = {
  ollama: 'http://127.0.0.1:11434',
  llamacpp: 'http://127.0.0.1:8080',
}

const hostnames =
  typeof window === 'undefined' ? ['127.0.0.1'] : Array.from(new Set(['127.0.0.1', window.location.hostname]))
const OLLAMA_CANDIDATES = hostnames.map((hostname) => `http://${hostname}:11434`)
const LLAMA_CPP_CANDIDATES = hostnames.flatMap((hostname) => [`http://${hostname}:8080`, `http://${hostname}:12434`])
const PROBE_TIMEOUT_MS = 1_500

export function setLocalProviderEndpoint(provider: LocalProvider, endpoint: string): void {
  if (LOCAL_PROVIDER_ENDPOINTS[provider] === endpoint) return
  LOCAL_PROVIDER_ENDPOINTS[provider] = endpoint
  void import('./LLMClientFactory').then(({ LLMClientFactory }) => {
    LLMClientFactory.clearClientCache(provider)
  })
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = PROBE_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

export async function probeOllama(endpoint = LOCAL_PROVIDER_ENDPOINTS.ollama): Promise<LocalProviderProbeResult> {
  try {
    const response = await fetchWithTimeout(`${endpoint}/api/version`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const body = (await response.json()) as { version?: unknown }
    if (typeof body.version !== 'string' || body.version.length === 0) {
      throw new Error('Not an Ollama server')
    }

    return { provider: 'ollama', status: 'reachable', endpoint }
  } catch {
    return { provider: 'ollama', status: 'unreachable', endpoint }
  }
}

export async function probeLlamaCpp(endpoint = LOCAL_PROVIDER_ENDPOINTS.llamacpp): Promise<LocalProviderProbeResult> {
  try {
    const response = await fetchWithTimeout(`${endpoint}/health`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const server = response.headers.get('server')?.toLowerCase()
    const body = (await response.json()) as { status?: unknown }
    if (!server?.includes('llama.cpp') || body.status !== 'ok') {
      throw new Error('Not a llama.cpp server')
    }

    return { provider: 'llamacpp', status: 'reachable', endpoint }
  } catch {
    return { provider: 'llamacpp', status: 'unreachable', endpoint }
  }
}

async function firstReachable(
  endpoints: string[],
  probe: (endpoint: string) => Promise<LocalProviderProbeResult>,
): Promise<LocalProviderProbeResult> {
  const probes = await Promise.all(endpoints.map((endpoint) => probe(endpoint)))
  return probes.find((result) => result.status === 'reachable') ?? probes[0]
}

export async function probeLocalProviders(): Promise<Record<LocalProvider, LocalProviderProbeResult>> {
  const [ollama, llamacpp] = await Promise.all([
    firstReachable(OLLAMA_CANDIDATES, probeOllama),
    firstReachable(LLAMA_CPP_CANDIDATES, probeLlamaCpp),
  ])
  if (ollama.status === 'reachable') setLocalProviderEndpoint('ollama', ollama.endpoint)
  if (llamacpp.status === 'reachable') setLocalProviderEndpoint('llamacpp', llamacpp.endpoint)
  return { ollama, llamacpp }
}
