import type { Config } from "@netlify/functions"

import { auth, authEnabled } from "../lib/auth.js"
import { ensureSchema } from "../lib/pg.js"

/**
 * Better Auth ships a standard fetch handler, which is exactly what a Netlify
 * v2 function receives -- so the whole auth surface is this one passthrough.
 */
export default async (request: Request): Promise<Response> => {
  if (!authEnabled || !auth) {
    return new Response(
      JSON.stringify({
        error: "Accounts are not configured on this deploy",
        hint: "Set DATABASE_URL (and BETTER_AUTH_SECRET) in the Netlify site environment to enable sign-in. Chat works without an account either way.",
      }),
      { status: 503, headers: { "content-type": "application/json" } }
    )
  }

  try {
    // First request after a cold start creates the tables if the database is
    // brand new; every later one is a resolved promise.
    await ensureSchema()
  } catch (error) {
    console.error("[auth] schema", error)
    return new Response(
      JSON.stringify({ error: "Accounts are temporarily unavailable. Chat still works." }),
      { status: 503, headers: { "content-type": "application/json" } }
    )
  }

  return auth.handler(request)
}

export const config: Config = { path: "/api/auth/*" }
