/**
 * Async generator that reads an SSE (Server-Sent Events) stream and yields
 * the parsed JSON payload of each `data:` line.
 *
 * This replaces the identical SSE-parsing loop that was copy-pasted across
 * AnthropicLLMClient, OpenAILLMClient, OpenRouterLLMClient, ServerLLMClient,
 * and the backend streamAnthropic/streamOpenAICompatible functions.
 */
export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || "" // Keep the incomplete trailing line

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue

        const data = line.slice(6).trim()
        if (!data || data === "[DONE]") continue

        try {
          yield JSON.parse(data)
        } catch {
          // Skip unparseable lines (e.g. malformed JSON)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
