import type { Config } from "@netlify/functions"

import { json, settings } from "../lib/settings.js"
import { explain, explainStatus } from "../lib/errors.js"
import { encodeEvent, readOpenAiStream, sseHeaders } from "../lib/sse.js"

/**
 * Netlify caps streaming functions at 60s (all plans), versus 10s for a plain
 * synchronous one. We leave headroom so a slow model produces a clean timeout
 * event instead of a severed connection.
 */
const STREAM_BUDGET_MS = 55_000

interface ChatRequest {
  temperature?: number
  messages: Array<{
    role: "system" | "user" | "assistant"
    content: string | Array<Record<string, unknown>>
  }>
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return json({ error: "Use POST" }, 405)
  }

  let payload: ChatRequest
  try {
    payload = (await request.json()) as ChatRequest
  } catch {
    return json({ error: "Body must be JSON" }, 400)
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return json({ error: "messages must be a non-empty array" }, 400)
  }

  if (!settings.apiKey) {
    return json(
      {
        error: "The chat service is not configured yet",
        hint: "GATEWAY_API_KEY is missing from the site environment.",
      },
      503
    )
  }

  // Visitors do not choose a model. The server picks one, and by default that
  // is an auto-router which picks per prompt.
  const model = settings.defaultModel

  /**
   * The chosen model first, then the configured fallbacks. OpenRouter walks
   * this list on a 429 or a provider error and serves from the first one that
   * answers, so a rate-limited primary degrades to a free model instead of
   * failing the request.
   *
   * Capped at three because that is OpenRouter's hard limit -- a longer list
   * is rejected outright with a 400, taking the whole request down with it.
   * Enforced here rather than trusted to FALLBACK_MODELS being set carefully.
   */
  // An auto-router already picks per request, so handing it a fallback list
  // would be arguing with it.
  const isAutoRouter = model.startsWith("openrouter/")
  const chain = isAutoRouter
    ? [model]
    : [model, ...settings.fallbackModels.filter((m) => m !== model)].slice(0, 3)
  const abort = new AbortController()

  // Propagate the browser hanging up (the Stop button) to the gateway, so a
  // cancelled reply stops burning provider tokens immediately.
  request.signal.addEventListener("abort", () => abort.abort(), { once: true })
  const budget = setTimeout(() => abort.abort(), STREAM_BUDGET_MS)

  let upstreamResponse: Response
  try {
    upstreamResponse = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: "POST",
      signal: abort.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model,
        // Omitted entirely when no fallbacks are configured: a gateway that
        // does not understand these fields should never have to ignore them.
        ...(chain.length > 1
          ? { models: chain, provider: { allow_fallbacks: true } }
          : {}),
        messages: payload.messages,
        temperature: payload.temperature ?? 0.7,
        max_tokens: settings.maxTokens,
        stream: true,
        // Not every provider honours this; when it is ignored we simply never
        // emit a usage event and the UI hides the token counter.
        stream_options: { include_usage: true },
      }),
    })
  } catch (err) {
    clearTimeout(budget)
    const friendly = explain(err, settings.baseUrl)
    return json(friendly, friendly.status)
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    clearTimeout(budget)
    const text = await upstreamResponse.text().catch(() => "")
    const friendly = explainStatus(upstreamResponse.status, text)
    return json(friendly, friendly.status)
  }

  const body = upstreamResponse.body
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const send = (event: Parameters<typeof encodeEvent>[0]) => {
        if (!closed) controller.enqueue(encodeEvent(event))
      }

      send({ type: "meta", model })

      let finishReason: string | null = null
      let servedBy = model
      try {
        for await (const chunk of readOpenAiStream(body)) {
          // On a fallback the reply comes from a different model than we
          // asked for. Say so, rather than mislabelling it in the transcript.
          const actual = typeof chunk.model === "string" ? chunk.model : null
          if (actual && actual !== servedBy) {
            servedBy = actual
            send({ type: "meta", model: actual })
          }

          const choices = chunk.choices as
            | Array<{ delta?: { content?: string }; finish_reason?: string | null }>
            | undefined

          const text = choices?.[0]?.delta?.content
          if (typeof text === "string" && text.length > 0) {
            send({ type: "delta", text })
          }

          const reason = choices?.[0]?.finish_reason
          if (reason) finishReason = reason

          const usage = chunk.usage as
            | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
            | undefined
          if (usage) {
            send({
              type: "usage",
              promptTokens: usage.prompt_tokens ?? 0,
              completionTokens: usage.completion_tokens ?? 0,
              totalTokens:
                usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
            })
          }
        }
        send({ type: "done", finishReason })
      } catch (err) {
        if (abort.signal.aborted && !request.signal.aborted) {
          send({
            type: "error",
            error: "The reply hit the 60 second streaming limit",
            hint: "Netlify caps a streaming function at 60s. Ask for a shorter answer, or lower MAX_TOKENS.",
          })
        } else if (!request.signal.aborted) {
          const friendly = explain(err, settings.baseUrl)
          send({ type: "error", error: friendly.error, hint: friendly.hint })
        }
      } finally {
        clearTimeout(budget)
        closed = true
        controller.close()
      }
    },
    cancel() {
      abort.abort()
    },
  })

  return new Response(stream, { headers: sseHeaders })
}

export const config: Config = { path: "/api/chat" }
