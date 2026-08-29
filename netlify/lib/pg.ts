import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

import { Pool } from "pg"

/**
 * The one Postgres connection the site uses, shared by accounts and by the
 * chat history that hangs off them.
 *
 * NETLIFY_DATABASE_URL is what Netlify's own database integration injects; an
 * explicit DATABASE_URL wins, for a database that is not Netlify's.
 */
export const databaseUrl =
  process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || ""

export const databaseEnabled = databaseUrl !== ""

let cached: Pool | null = null

/**
 * One Pool per cold start, and never more than one connection from it. Point
 * the URL at a *pooled* endpoint (Neon hands you one) -- serverless functions
 * opening direct connections will exhaust the database's slots under load.
 */
export function pool(): Pool {
  if (cached) return cached

  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl)
  cached = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    // Neon and every other hosted Postgres require TLS; a local one usually
    // has none configured at all.
    ssl: isLocal ? undefined : { rejectUnauthorized: true },
  })
  return cached
}

/**
 * Creates the tables if they are not there yet, once per cold start.
 *
 * Normally schema changes belong in a migration you run deliberately, and
 * `npm run auth:migrate` still does exactly that. This exists because on
 * Netlify the connection string is a *secret* environment variable: functions
 * receive the real value at runtime, while the CLI can only ever read back a
 * masked one. So there is no way to run a migration against the deployed
 * database from a laptop -- the only thing holding the credential is the
 * deploy itself.
 *
 * Safe to leave in: the schema is IF NOT EXISTS throughout, and the advisory
 * lock keeps two cold starts from racing each other into a duplicate-object
 * error.
 */
const SCHEMA_LOCK = 4_120_641

let schemaReady: Promise<void> | null = null

export function ensureSchema(): Promise<void> {
  schemaReady ??= applySchema().catch((error) => {
    // Let the next request try again rather than caching the failure for the
    // lifetime of the instance.
    schemaReady = null
    throw error
  })
  return schemaReady
}

/**
 * esbuild collapses this module into the calling function, so `import.meta.url`
 * ends up in netlify/functions/ while `included_files` puts the schema in
 * netlify/lib/ -- next to the *source*, not next to the bundle. Both layouts
 * are tried rather than assumed, so `netlify dev` and the deploy agree.
 */
async function readSchema(): Promise<string> {
  const candidates = [
    new URL("../lib/auth-schema.sql", import.meta.url),
    new URL("./auth-schema.sql", import.meta.url),
  ]

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8")
    } catch {
      continue
    }
  }
  throw new Error("auth-schema.sql was not bundled with the function")
}

async function applySchema(): Promise<void> {
  const sql = await readSchema()
  // Short enough to read in a table, long enough that two different schemas
  // will not collide.
  const fingerprint = createHash("sha256").update(sql).digest("hex").slice(0, 16)

  const client = await pool().connect()
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_state (
         fingerprint TEXT PRIMARY KEY,
         applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`
    )

    // Applying forty-odd idempotent DDL statements on every cold start would
    // work and would also be forty-odd round trips of nothing. One SELECT is
    // enough to know the database already matches this exact schema.
    const seen = await client.query("SELECT 1 FROM schema_state WHERE fingerprint = $1", [
      fingerprint,
    ])
    if (seen.rowCount !== 0) return

    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_LOCK])
    await client.query(sql)
    await client.query(
      "INSERT INTO schema_state (fingerprint) VALUES ($1) ON CONFLICT DO NOTHING",
      [fingerprint]
    )
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
