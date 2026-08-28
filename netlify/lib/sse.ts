/** Wire events the browser understands. Kept deliberately small. */
export type StreamEvent =
  | { type: "meta"; model: string }
  | { type: "delta"; text: string }
  | { type: "usage"; promptTokens: number; completionTokens: number; totalTokens: number }
  | { type: "done"; finishReason: string | null }
  | { type: "error"; error: string; hint?: string }

const encoder = new TextEncoder()

export function encodeEvent(event: StreamEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
}

export const sseHeaders = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  /** Stops any intermediary from buffering the stream into a single blob. */
  "x-accel-buffering": "no",
}

/**
 * Reads an OpenAI-style `data:` stream and yields the parsed JSON payloads.
 * Handles chunk boundaries splitting mid-event, which upstream proxies do
 * constantly under load.
 */
export async function* readOpenAiStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Events are separated by a blank line; \r\n shows up from some gateways.
      const parts = buffer.split(/\r?\n\r?\n/)
      buffer = parts.pop() ?? ""

      for (const part of parts) {
        for (const line of part.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue
          const payload = line.slice(5).trim()
          if (payload === "" || payload === "[DONE]") continue
          try {
            yield JSON.parse(payload) as Record<string, unknown>
          } catch {
            // A malformed chunk is not worth killing the whole reply over.
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
