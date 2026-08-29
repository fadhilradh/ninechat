/**
 * Creates the Better Auth tables.
 *
 *   npm run auth:migrate
 *
 * Reads DATABASE_URL, or NETLIFY_DATABASE_URL if the Netlify Neon extension
 * set it, from the environment or from .env. Applies netlify/lib/auth-schema.sql,
 * which is written with IF NOT EXISTS throughout -- running it twice is a no-op,
 * so it is safe against a database that is already migrated.
 *
 * The `@better-auth/cli migrate` command does the same job by introspecting the
 * config. This exists because it is one command with no interactive prompts,
 * which matters when the database lives on a deploy rather than your machine.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import pg from "pg"

function fromDotEnv(name) {
  try {
    const text = readFileSync(new URL("../.env", import.meta.url), "utf8")
    return text.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() ?? ""
  } catch {
    return ""
  }
}

const url =
  process.env.DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL ||
  fromDotEnv("DATABASE_URL") ||
  fromDotEnv("NETLIFY_DATABASE_URL")

if (!url) {
  console.error("No DATABASE_URL or NETLIFY_DATABASE_URL found.")
  console.error()
  console.error("On Netlify: enable the Neon extension, then pull the value down with")
  console.error("  npx netlify env:list")
  console.error("Locally: put DATABASE_URL in .env")
  process.exit(1)
}

const schemaPath = fileURLToPath(new URL("../netlify/lib/auth-schema.sql", import.meta.url))
const schema = readFileSync(schemaPath, "utf8")
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url)

const client = new pg.Client({
  connectionString: url,
  ssl: isLocal ? undefined : { rejectUnauthorized: true },
})

const redacted = url.replace(/\/\/[^@]*@/, "//***@")
console.log(`Connecting to ${redacted}`)

try {
  await client.connect()

  // One transaction: a half-created auth schema is worse than none.
  await client.query("BEGIN")
  await client.query(schema)
  await client.query("COMMIT")

  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN ('user','session','account','verification')
     ORDER BY table_name`
  )
  console.log(`\nTables present: ${rows.map((r) => r.table_name).join(", ") || "none"}`)
  console.log("\nDone. Redeploy for the auth routes to pick it up.")
} catch (err) {
  await client.query("ROLLBACK").catch(() => {})
  console.error(`\nMigration failed: ${err.message}`)
  process.exitCode = 1
} finally {
  await client.end()
}
