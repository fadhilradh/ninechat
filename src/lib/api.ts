import type { AppSettings, Message, StreamEvent } from "./types"

export interface HealthReport {
  ok: boolean
  reachable: boolean
  reason: string | null
  latencyMs?: number
}

type WireContent = string | Array<Record<string, unknown>>

interface WireMessage {
  role: "system" | "user" | "assistant"
  content: WireContent
}

/**
 * Builds the request body. Messages with images become multi-part content;
 * plain text stays a bare string, because a handful of models still reject
 * the array form for text-only turns.
 */
export function toWireMessages(systemPrompt: string, messages: Message[]): WireMessage[] {
  const wire: WireMessage[] = []

  if (systemPrompt.trim()) {
    wire.push({ role: "system", content: systemPrompt.trim() })
  }

  for (const message of messages) {
    if (message.role === "system") continue
    // A failed turn never happened as far as the model is concerned.
    if (message.role === "assistant" && (message.error || !message.content.trim())) continue

    if (message.role === "assistant") {
      wire.push({ role: "assistant", content: message.content })
      continue
    }

    if (message.attachments.length === 0) {
      wire.push({ role: "user", content: message.content })
      continue
    }

    wire.push({
      role: "user",
      content: [
        ...message.attachments.map((a) => ({
          type: "image_url",
          image_url: { url: a.dataUrl },
        })),
        { type: "text", text: message.content || "Describe the attached image." },
      ],
    })
  }

  return wire
}

async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const blocks = buffer.split(/\r?\n\r?\n/)
      buffer = blocks.pop() ?? ""

      for (const block of blocks) {
        for (const line of block.split(/\r?\n/)) {
          if (line.startsWith("data:")) yield line.slice(5).trim()
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export interface ChatRequest {
  temperature: number
  systemPrompt: string
  messages: Message[]
  signal: AbortSignal
}

/**
 * Streams a reply.
 *
 * No model is sent: the server holds one key and lets the gateway route each
 * request, so there is nothing here for a visitor to choose or misconfigure.
 * Which model answered comes back as a `meta` event.
 */
export async function* streamChat(request: ChatRequest): AsyncGenerator<StreamEvent> {
  const { temperature, systemPrompt, messages, signal } = request

  let response: Response
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: toWireMessages(systemPrompt, messages), temperature }),
    })
  } catch (err) {
    if (signal.aborted) return
    yield {
      type: "error",
      error: "Could not reach the chat service",
      hint: String((err as Error)?.message ?? err),
    }
    return
  }

  if (!response.ok || !response.body) {
    const detail = (await response.json().catch(() => null)) as
      | { error?: string; hint?: string }
      | null
    yield {
      type: "error",
      error: detail?.error ?? `Request failed (${response.status})`,
      hint: detail?.hint,
    }
    return
  }

  for await (const payload of readSse(response.body)) {
    if (!payload) continue
    try {
      yield JSON.parse(payload) as StreamEvent
    } catch {
      // Ignore a torn frame rather than abandoning a good reply.
    }
  }
}

export async function fetchHealth(): Promise<HealthReport | null> {
  try {
    const response = await fetch("/api/health")
    if (!response.ok) return null
    return (await response.json()) as HealthReport
  } catch {
    return null
  }
}

const TITLE_SYSTEM_PROMPT =
  "Summarise this conversation as a title of at most five words. " +
  "Reply with the title only: no quotes, no trailing punctuation, no preamble."

/** Names the conversation from its opening turns. Best-effort; never blocks a reply. */
export async function suggestTitle(
  settings: AppSettings,
  messages: Message[]
): Promise<string | null> {
  if (!settings.autoTitle) return null

  const transcript = messages
    .filter((m) => m.role !== "system" && !m.error)
    .slice(0, 4)
    .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 500)}`)
    .join("\n\n")

  if (!transcript.trim()) return null

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        temperature: 0.2,
        messages: [
          { role: "system", content: TITLE_SYSTEM_PROMPT },
          { role: "user", content: transcript },
        ],
      }),
    })
    if (!response.ok || !response.body) return null

    let title = ""
    for await (const payload of readSse(response.body)) {
      if (!payload) continue
      try {
        const event = JSON.parse(payload) as StreamEvent
        if (event.type === "delta") title += event.text
      } catch {
        continue
      }
    }

    return title.trim().replace(/^["'`]+|["'`.]+$/g, "").slice(0, 60) || null
  } catch {
    return null
  }
}

export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}
