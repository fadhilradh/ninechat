import type { AppSettings, Message, ModelInfo, StreamEvent } from "./types"

export interface HealthReport {
  ok: boolean
  reachable: boolean
  reason: string | null
  baseUrl: string
  defaultModel: string
  acceptsClientKey: boolean
  latencyMs?: number
}

type WireContent = string | Array<Record<string, unknown>>

interface WireMessage {
  role: "system" | "user" | "assistant"
  content: WireContent
}

/**
 * Builds the request body. Messages with images become multi-part content;
 * plain text stays a bare string, because a handful of providers behind the
 * gateway still reject the array form for text-only turns.
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

function directHeaders(settings: AppSettings): HeadersInit {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${settings.directApiKey}`,
  }
}

function proxyHeaders(settings: AppSettings): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" }
  // Optional: lets a visitor use their own key against a shared deploy.
  if (settings.directApiKey) headers["x-ninechat-key"] = settings.directApiKey
  return headers
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

const stripSlash = (url: string) => url.replace(/\/+$/, "")

export interface ChatRequest {
  model: string
  temperature: number
  systemPrompt: string
  messages: Message[]
  settings: AppSettings
  signal: AbortSignal
}

/**
 * Streams a completion, normalising both transports onto one event shape.
 *
 * In `proxy` mode the Netlify function has already normalised the events. In
 * `direct` mode we get raw OpenAI chunks straight from the gateway and
 * translate them here, so the UI never has to know which path it took.
 */
export async function* streamChat(request: ChatRequest): AsyncGenerator<StreamEvent> {
  const { settings, model, temperature, systemPrompt, messages, signal } = request
  const wire = toWireMessages(systemPrompt, messages)
  const direct = settings.transport === "direct"

  if (direct && !settings.directApiKey) {
    yield {
      type: "error",
      error: "Direct mode needs an API key",
      hint: "Direct mode sends requests from this browser, so it needs its own key. Paste one under Settings, or switch back to \"Via this site\".",
    }
    return
  }

  const url = direct ? `${stripSlash(settings.directBaseUrl)}/chat/completions` : "/api/chat"

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      signal,
      headers: direct ? directHeaders(settings) : proxyHeaders(settings),
      body: JSON.stringify(
        direct
          ? {
              model,
              messages: wire,
              temperature,
              stream: true,
              stream_options: { include_usage: true },
            }
          : { model, messages: wire, temperature }
      ),
    })
  } catch (err) {
    if (signal.aborted) return
    yield {
      type: "error",
      error: direct
        ? `Could not reach ${settings.directBaseUrl}`
        : "Could not reach the ninechat API",
      hint: direct
        ? "Is the gateway reachable from this browser, and does it allow this origin via CORS?"
        : String((err as Error)?.message ?? err),
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

  if (!direct) {
    for await (const payload of readSse(response.body)) {
      if (!payload) continue
      try {
        yield JSON.parse(payload) as StreamEvent
      } catch {
        // Ignore a torn frame rather than abandoning a good reply.
      }
    }
    return
  }

  yield { type: "meta", model }
  let finishReason: string | null = null
  let servedBy = model

  for await (const payload of readSse(response.body)) {
    if (!payload || payload === "[DONE]") continue

    let chunk: {
      model?: string
      choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    try {
      chunk = JSON.parse(payload)
    } catch {
      continue
    }

    // A gateway that fell back answers as a different model than we asked for.
    if (chunk.model && chunk.model !== servedBy) {
      servedBy = chunk.model
      yield { type: "meta", model: chunk.model }
    }

    const text = chunk.choices?.[0]?.delta?.content
    if (typeof text === "string" && text) yield { type: "delta", text }

    const reason = chunk.choices?.[0]?.finish_reason
    if (reason) finishReason = reason

    if (chunk.usage) {
      const prompt = chunk.usage.prompt_tokens ?? 0
      const completion = chunk.usage.completion_tokens ?? 0
      yield {
        type: "usage",
        promptTokens: prompt,
        completionTokens: completion,
        totalTokens: chunk.usage.total_tokens ?? prompt + completion,
      }
    }
  }

  yield { type: "done", finishReason }
}

export async function fetchModels(settings: AppSettings): Promise<ModelInfo[]> {
  if (settings.transport === "direct") {
    const response = await fetch(`${stripSlash(settings.directBaseUrl)}/models`, {
      headers: { authorization: `Bearer ${settings.directApiKey}` },
    })
    if (!response.ok) throw new Error(`Gateway returned ${response.status}`)
    const payload = (await response.json()) as { data?: Array<{ id?: string }> }
    return (payload.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id))
      .map((id) => ({
        id,
        provider: id.includes("/") ? id.slice(0, id.indexOf("/")) : "other",
        label: id.includes("/") ? id.slice(id.indexOf("/") + 1) : id,
      }))
      .sort((a, b) =>
        a.provider === b.provider ? a.id.localeCompare(b.id) : a.provider.localeCompare(b.provider)
      )
  }

  const response = await fetch("/api/models", { headers: proxyHeaders(settings) })
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(detail?.error ?? `Request failed (${response.status})`)
  }
  const payload = (await response.json()) as { models: ModelInfo[] }
  return payload.models
}

export async function fetchHealth(settings: AppSettings): Promise<HealthReport | null> {
  if (settings.transport === "direct") return null
  const response = await fetch("/api/health", { headers: proxyHeaders(settings) })
  if (!response.ok) return null
  return (await response.json()) as HealthReport
}

const TITLE_SYSTEM_PROMPT =
  "Summarise this conversation as a title of at most five words. " +
  "Reply with the title only: no quotes, no trailing punctuation, no preamble."

/** Names the conversation from its opening turns. Best-effort; never blocks a reply. */
export async function suggestTitle(
  settings: AppSettings,
  model: string,
  messages: Message[]
): Promise<string | null> {
  const transcript = messages
    .filter((m) => m.role !== "system" && !m.error)
    .slice(0, 4)
    .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 500)}`)
    .join("\n\n")

  if (!transcript.trim()) return null

  const direct = settings.transport === "direct"
  const url = direct ? `${stripSlash(settings.directBaseUrl)}/chat/completions` : "/api/chat"

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: direct ? directHeaders(settings) : proxyHeaders(settings),
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: TITLE_SYSTEM_PROMPT },
          { role: "user", content: transcript },
        ],
        ...(direct ? { stream: true } : {}),
      }),
    })
    if (!response.ok || !response.body) return null

    let title = ""
    for await (const payload of readSse(response.body)) {
      if (!payload || payload === "[DONE]") continue
      try {
        const chunk = JSON.parse(payload) as
          | StreamEvent
          | { choices?: Array<{ delta?: { content?: string } }> }
        if ("type" in chunk) {
          if (chunk.type === "delta") title += chunk.text
        } else {
          title += chunk.choices?.[0]?.delta?.content ?? ""
        }
      } catch {
        continue
      }
    }

    const cleaned = title.trim().replace(/^["'`]+|["'`.]+$/g, "").slice(0, 60)
    return cleaned || null
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
