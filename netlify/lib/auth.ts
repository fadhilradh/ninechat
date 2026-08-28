import { betterAuth } from "better-auth"
import { Pool } from "pg"

/**
 * Signing in is optional in Nine AI, so auth is optional in the deployment
 * too: with no DATABASE_URL the site still works end to end as a guest, and
 * only the auth routes report that they are switched off.
 */
const databaseUrl = process.env.DATABASE_URL ?? ""
const googleClientId = process.env.GOOGLE_CLIENT_ID ?? ""
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? ""

export const authEnabled = databaseUrl !== ""
export const googleEnabled = googleClientId !== "" && googleClientSecret !== ""

function trustedOrigins(): string[] {
  const configured = (process.env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

  // Netlify injects URL (the production address) and DEPLOY_PRIME_URL (the
  // branch/preview address) at build and run time.
  return [
    ...configured,
    process.env.BETTER_AUTH_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    "http://localhost:8888",
    "http://localhost:5173",
  ].filter((origin): origin is string => Boolean(origin))
}

function build() {
  /**
   * One Pool per cold start. Point DATABASE_URL at a *pooled* connection string
   * (Netlify DB and Neon both hand you one) -- serverless functions opening
   * direct connections will exhaust the database's slots under load.
   */
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  })

  return betterAuth({
    database: pool,
    baseURL: process.env.BETTER_AUTH_URL || process.env.URL || "http://localhost:8888",
    secret: process.env.BETTER_AUTH_SECRET,
    basePath: "/api/auth",
    trustedOrigins: trustedOrigins(),
    emailAndPassword: {
      enabled: true,
      // No mail provider is wired up, so demanding verification would lock
      // every new account out. Turn this on once you add one.
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    socialProviders: googleEnabled
      ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
      : {},
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    advanced: {
      cookiePrefix: "nineai",
    },
  })
}

/**
 * Null when DATABASE_URL is unset.
 *
 * Building Better Auth without a database would fall back to an in-memory
 * adapter, which on serverless means every request gets its own empty user
 * table -- accounts that appear to work and then vanish. An honest 503 is
 * better than that.
 */
export const auth = authEnabled ? build() : null
