/**
 * Every setting the functions need, resolved once per cold start.
 *
 * Nothing here is bundled into the browser: these come from Netlify's
 * environment variables (or the local .env that `netlify dev` loads).
 */

function str(name: string, fallback = ""): string {
  const raw = process.env[name]
  return raw === undefined || raw.trim() === "" ? fallback : raw.trim()
}

function bool(name: string, fallback = false): boolean {
  const raw = str(name)
  if (raw === "") return fallback
  return raw === "1" || raw.toLowerCase() === "true"
}

export const settings = {
  /**
   * An OpenAI-compatible base URL. 9Router exposes one at /v1.
   *
   * Note this is resolved server-side, so it has to be reachable *from
   * Netlify*. A 9Router running on your own laptop is not -- use the
   * frontend's Direct mode for that, which talks to localhost from the browser
   * and skips this function entirely.
   */
  baseUrl: str("GATEWAY_BASE_URL", "http://localhost:20128/v1").replace(/\/+$/, ""),
  apiKey: str("GATEWAY_API_KEY"),
  defaultModel: str("DEFAULT_MODEL", "anthropic/claude-sonnet-4-5"),

  /** Accept a per-request key from the browser, so visitors can bring their own. */
  allowClientKey: bool("ALLOW_CLIENT_KEY", true),

  /**
   * Accept a per-request base URL from the browser. Off by default: an open
   * URL parameter on a public deploy turns the function into a request proxy
   * for anyone who finds it.
   */
  allowClientBaseUrl: bool("ALLOW_CLIENT_BASE_URL", false),

  /** Upper bound on tokens per reply; keeps a runaway model inside the 60s streaming budget. */
  maxTokens: Number(str("MAX_TOKENS", "4096")),
} as const

export interface Upstream {
  baseUrl: string
  apiKey: string
}

/** Picks the gateway for a request, honouring the browser overrides we allow. */
export function resolveUpstream(request: Request): Upstream {
  const clientKey = request.headers.get("x-ninechat-key")?.trim() ?? ""
  const clientBaseUrl = request.headers.get("x-ninechat-base-url")?.trim() ?? ""

  return {
    baseUrl:
      settings.allowClientBaseUrl && clientBaseUrl
        ? clientBaseUrl.replace(/\/+$/, "")
        : settings.baseUrl,
    apiKey: settings.allowClientKey && clientKey ? clientKey : settings.apiKey,
  }
}

export const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}
