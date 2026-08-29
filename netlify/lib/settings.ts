/**
 * Every setting the functions need, resolved once per cold start.
 *
 * Nothing here reaches the browser: these come from Netlify's environment
 * variables (or the local .env that `netlify dev` loads). Visitors configure
 * nothing and supply no credentials -- that is the whole point of the product.
 */

function str(name: string, fallback = ""): string {
  const raw = process.env[name]
  return raw === undefined || raw.trim() === "" ? fallback : raw.trim()
}

export const settings = {
  /** Any OpenAI-compatible base URL. OpenRouter by default. */
  baseUrl: str("GATEWAY_BASE_URL", "https://openrouter.ai/api/v1").replace(/\/+$/, ""),
  apiKey: str("GATEWAY_API_KEY"),

  /**
   * `openrouter/auto` hands model choice to the gateway, which picks per
   * prompt. A concrete model id pins it instead.
   */
  defaultModel: str("DEFAULT_MODEL", "openrouter/auto"),

  /** Upper bound on tokens per reply; keeps a runaway model inside the 60s streaming budget. */
  maxTokens: Number(str("MAX_TOKENS", "4096")),

  /**
   * Ordered fallback chain, tried when the chosen model errors out or is rate
   * limited. Put the free ones last for tiered routing on a gateway that has
   * none built in.
   *
   * Rides on OpenRouter's `models` field. Empty by default, because a gateway
   * that does not understand the field is better off never seeing it.
   */
  fallbackModels: str("FALLBACK_MODELS")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean),
} as const

export const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}
