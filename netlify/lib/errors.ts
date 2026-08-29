export interface FriendlyError {
  status: number
  error: string
  hint?: string
}

/**
 * Turns whatever went wrong into something a visitor can read.
 *
 * The audience here is a person who just wants an answer, not the person who
 * deployed this. "Set GATEWAY_API_KEY" is useless advice to them and leaks how
 * the thing is wired, so operator detail goes to the function logs and the
 * visitor gets a plain sentence and some idea of whether to retry.
 */
function operatorLog(context: string, detail: unknown): void {
  console.error(`[chat] ${context}`, detail)
}

export function explain(err: unknown, baseUrl: string): FriendlyError {
  const e = err as { name?: string; message?: string; cause?: { code?: string } }
  const code = e?.cause?.code

  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || e?.name === "TypeError") {
    operatorLog(`could not reach ${baseUrl}`, e?.message ?? code)
    return {
      status: 503,
      error: "The chat service is unreachable right now",
      hint: "This is on our side, not yours. Try again in a moment.",
    }
  }

  if (e?.name === "AbortError") {
    return { status: 499, error: "Request cancelled" }
  }

  operatorLog("unexpected failure", e?.message ?? err)
  return { status: 500, error: "Something went wrong handling that message" }
}

export function explainStatus(status: number, body: string): FriendlyError {
  operatorLog(`upstream returned ${status}`, body.slice(0, 400))

  if (status === 401 || status === 403) {
    return {
      status: 503,
      error: "The chat service is not set up correctly",
      hint: "Nothing you can fix from here -- this one is on the operator.",
    }
  }
  if (status === 404) {
    return {
      status: 503,
      error: "The chat service could not route that request",
      hint: "This is on our side. Try again in a moment.",
    }
  }
  if (status === 429) {
    return {
      status: 429,
      error: "Too many requests right now",
      hint: "Every model we can reach is busy or rate limited. Waiting a minute usually clears it.",
    }
  }
  if (status >= 500) {
    return {
      status: 502,
      error: "The model provider is having a bad time",
      hint: "Nothing wrong with your message. Try sending it again.",
    }
  }

  return { status, error: "That message could not be sent" }
}
