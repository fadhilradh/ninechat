import type { Config } from "@netlify/functions"

import { authEnabled, googleEnabled } from "../lib/auth.js"

/**
 * Lets the sign-in page explain itself instead of throwing a raw 503 at
 * someone who just clicked "Sign up".
 *
 * While accounts are switched off it also reports which database-ish
 * environment variables the function can actually see -- names only, never
 * values. Netlify extensions inject their variables at runtime, so they do not
 * show up in `netlify env:list`, and without this there is no way to tell
 * "extension not attached" from "attached under a different name". The list is
 * omitted once auth is working, so it is a setup aid rather than a permanent
 * disclosure.
 */
export default async (): Promise<Response> => {
  const body: Record<string, unknown> = {
    enabled: authEnabled,
    google: googleEnabled,
  }

  if (!authEnabled) {
    body.databaseEnvSeen = Object.keys(process.env)
      .filter((name) => /DATABASE|POSTGRES|NEON/i.test(name))
      .filter((name) => (process.env[name] ?? "").trim() !== "")
      .sort()
  }

  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  })
}

export const config: Config = { path: "/api/auth-status" }
