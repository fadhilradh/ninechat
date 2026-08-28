import type { Config } from "@netlify/functions"

import { json, resolveUpstream, settings } from "../lib/settings.js"
import { explain, explainStatus } from "../lib/errors.js"

export interface ModelInfo {
  id: string
  provider: string
  label: string
}

function labelFor(id: string): string {
  const tail = id.includes("/") ? id.slice(id.indexOf("/") + 1) : id
  return tail
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bGpt\b/g, "GPT")
    .replace(/\bAi\b/g, "AI")
}

/**
 * 9Router fans a single request out across dozens of providers, so its model
 * list is long and prefixed (`anthropic/...`, `openai/...`). We keep the
 * prefix as a grouping key so the picker can stay navigable.
 */
export default async (request: Request): Promise<Response> => {
  const upstream = resolveUpstream(request)

  if (!upstream.apiKey) {
    return json({ models: [], defaultModel: settings.defaultModel, configured: false })
  }

  let response: Response
  try {
    response = await fetch(`${upstream.baseUrl}/models`, {
      headers: { authorization: `Bearer ${upstream.apiKey}` },
      signal: AbortSignal.timeout(8000),
    })
  } catch (err) {
    const friendly = explain(err, upstream.baseUrl)
    return json(friendly, friendly.status)
  }

  if (!response.ok) {
    const friendly = explainStatus(response.status, await response.text().catch(() => ""))
    return json(friendly, friendly.status)
  }

  const payload = (await response.json()) as { data?: Array<{ id?: string }> }
  const seen = new Set<string>()
  const models: ModelInfo[] = []

  for (const entry of payload.data ?? []) {
    const id = entry.id
    if (!id || seen.has(id)) continue
    seen.add(id)
    models.push({
      id,
      provider: id.includes("/") ? id.slice(0, id.indexOf("/")) : "other",
      label: labelFor(id),
    })
  }

  models.sort((a, b) =>
    a.provider === b.provider ? a.id.localeCompare(b.id) : a.provider.localeCompare(b.provider)
  )

  return json({ models, defaultModel: settings.defaultModel, configured: true })
}

export const config: Config = { path: "/api/models" }
