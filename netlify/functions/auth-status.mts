import type { Config } from "@netlify/functions"

import { authEnabled, googleEnabled } from "../lib/auth.js"

/**
 * Lets the sign-in page explain itself instead of throwing a raw 503 at
 * someone who just clicked "Sign up".
 */
export default async (): Promise<Response> =>
  new Response(JSON.stringify({ enabled: authEnabled, google: googleEnabled }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  })

export const config: Config = { path: "/api/auth-status" }
