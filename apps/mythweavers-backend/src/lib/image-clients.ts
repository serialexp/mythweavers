/**
 * Factory: build an `ImageClient` from an `ImageUpstreamConfig` row.
 *
 * Mirrors the pattern in `lib/llm-config.ts` — this is the boundary where DB
 * config + env-var keys turn into a callable client object.
 */

import {
  CloudflareClient,
  type ImageClient,
  OpenAIClient,
} from '@mythweavers/llm'
import type { ImageUpstreamConfig } from './image-config.js'

export function createImageClient(upstream: ImageUpstreamConfig): ImageClient {
  switch (upstream.protocol) {
    case 'cloudflare-image':
      return new CloudflareClient({
        apiKey: upstream.apiKey,
        endpoint: upstream.endpoint,
      })
    case 'openai-image':
      return new OpenAIClient({
        apiKey: upstream.apiKey,
        endpoint: upstream.endpoint,
      })
  }
}
