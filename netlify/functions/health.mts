import type { Config } from "@netlify/functions"

import { json, resolveUpstream, settings } from "../lib/settings.js"

/**
 * Answers the only two questions worth asking on startup: is a key configured,
 * and can we actually reach the gateway from here?
 */
export default async (request: Request): Promise<Response> => {
  const upstream = resolveUpstream(request)
  const startedAt = Date.now()

  if (!upstream.apiKey) {
    return json({
      ok: false,
      reachable: false,
      reason: "no-key",
      baseUrl: upstream.baseUrl,
      defaultModel: settings.defaultModel,
      acceptsClientKey: settings.allowClientKey,
    })
  }

  let reachable = false
  let reason: string | null = null
  try {
    const probe = await fetch(`${upstream.baseUrl}/models`, {
      headers: { authorization: `Bearer ${upstream.apiKey}` },
      signal: AbortSignal.timeout(5000),
    })
    reachable = probe.ok
    if (!probe.ok) reason = `gateway-${probe.status}`
  } catch {
    reason = "unreachable"
  }

  return json({
    ok: reachable,
    reachable,
    reason,
    baseUrl: upstream.baseUrl,
    defaultModel: settings.defaultModel,
    acceptsClientKey: settings.allowClientKey,
    latencyMs: Date.now() - startedAt,
  })
}

export const config: Config = { path: "/api/health" }
