export interface FriendlyError {
  status: number
  error: string
  hint?: string
}

/**
 * Turns whatever went wrong into something the chat window can show a human.
 * The hints are the part that matters -- a bare "401" from a gateway that
 * proxies forty providers tells you nothing about which knob to turn.
 */
export function explain(err: unknown, baseUrl: string): FriendlyError {
  if (err instanceof Response) {
    return { status: err.status, error: `Gateway returned ${err.status}` }
  }

  const e = err as { name?: string; message?: string; cause?: { code?: string } }
  const code = e?.cause?.code

  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || e?.name === "TypeError") {
    const isLocal = /localhost|127\.0\.0\.1/.test(baseUrl)
    return {
      status: 503,
      error: `Could not reach the gateway at ${baseUrl}`,
      hint: isLocal
        ? "This function runs on Netlify, which cannot see your laptop's localhost. Either point GATEWAY_BASE_URL at a publicly reachable 9Router, or switch the app to Direct mode in Settings."
        : "Check that 9Router is running and that GATEWAY_BASE_URL is correct.",
    }
  }

  if (e?.name === "AbortError") {
    return { status: 499, error: "Request cancelled" }
  }

  return { status: 500, error: e?.message ?? "Unexpected error" }
}

export function explainStatus(status: number, body: string): FriendlyError {
  const detail = body.slice(0, 400)

  if (status === 401 || status === 403) {
    return {
      status,
      error: "The gateway rejected the API key",
      hint: "Copy the key from the 9Router dashboard into GATEWAY_API_KEY (or paste it under Settings to use your own).",
    }
  }
  if (status === 404) {
    return {
      status,
      error: "That model is not available",
      hint: "No configured provider in 9Router serves this model. Pick a different one from the model list.",
    }
  }
  if (status === 429) {
    return {
      status,
      error: "Every provider tier for this model is exhausted",
      hint: "9Router already tried its fallbacks. Wait for a quota reset, or add another provider account.",
    }
  }
  if (status >= 500) {
    return { status, error: `Gateway error ${status}`, hint: detail || undefined }
  }
  return { status, error: `Request failed (${status})`, hint: detail || undefined }
}
