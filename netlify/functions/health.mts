import type { Config } from "@netlify/functions"

import { json, settings } from "../lib/settings.js"

/**
 * Answers the only question a visitor's browser needs: can we serve a reply
 * right now? Deliberately reports nothing about how -- no base URL, no model,
 * no key state. That is the operator's business, and this endpoint is public.
 */
export default async (): Promise<Response> => {
  const startedAt = Date.now()

  if (!settings.apiKey) {
    return json({ ok: false, reachable: false, reason: "unconfigured" })
  }

  let reachable = false
  try {
    const probe = await fetch(`${settings.baseUrl}/models`, {
      headers: { authorization: `Bearer ${settings.apiKey}` },
      signal: AbortSignal.timeout(5000),
    })
    reachable = probe.ok
  } catch {
    reachable = false
  }

  return json({
    ok: reachable,
    reachable,
    reason: reachable ? null : "upstream",
    latencyMs: Date.now() - startedAt,
  })
}

export const config: Config = { path: "/api/health" }
