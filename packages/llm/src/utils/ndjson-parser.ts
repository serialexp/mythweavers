/**
 * Async generator that reads an NDJSON (newline-delimited JSON) stream and
 * yields each parsed JSON object.
 *
 * This is used by OllamaClient — Ollama's streaming format is NDJSON rather
 * than SSE.
 */
export async function* parseNDJSONStream(
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
        const trimmed = line.trim()
        if (!trimmed) continue

        try {
          yield JSON.parse(trimmed)
        } catch {
          // Skip unparseable lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
